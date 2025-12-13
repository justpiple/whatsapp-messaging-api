import {
  Browsers,
  DisconnectReason,
  WASocket,
  useMultiFileAuthState,
} from "baileys";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "node:events";
import logger from "../utils/logger.js";
import prisma from "../lib/prisma.js";
import { WhatsappAccountStatus } from "@prisma/client";
import fs from "node:fs";
import { formatPhoneNumber } from "../utils/atomics.js";

const eventEmitter = new EventEmitter();

const whatsappSockets: Record<number, WASocket> = {};
const socketStatus: Record<number, string> = {};

export const initWhatsAppConnection = async (
  accountId: number
): Promise<string | null> => {
  try {
    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`WhatsApp account with ID ${accountId} not found`);
    }

    const sessionName = `session_${account.id}_${
      account.phoneNumber
    }_${account.createdAt.toLocaleDateString()}`;
    const { state, saveCreds } = await useMultiFileAuthState(
      `sessions/${sessionName}`
    );
    const baileys = await import("baileys");
    const sock = baileys.makeWASocket({
      auth: state,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: false,
      browser: Browsers.macOS("Messaging System"),
    });

    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        eventEmitter.emit("qr", { accountId, qr });
        logger.info(`QR Code received for account ${accountId}`);
      }

      if (connection) {
        socketStatus[accountId] = String(connection);
      }

      if (connection === "close") {
        try {
          await prisma.whatsappAccount.update({
            where: { id: accountId },
            data: { status: WhatsappAccountStatus.INACTIVE },
          });
        } catch (error: unknown) {
          logger.warn(
            `Failed to update account ${accountId} status (might be deleted):`,
            error
          );
          delete whatsappSockets[accountId];
          delete socketStatus[accountId];
          return;
        }

        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        logger.info(
          `Connection closed for account ${accountId}. Reconnecting: ${shouldReconnect}`
        );

        if (shouldReconnect) {
          const reconnectReason = lastDisconnect?.error as Boom;
          if (reconnectReason) {
            const statusCode = reconnectReason.output?.statusCode;
            logger.error(`Reconnecting due to error: ${statusCode}`);
          }

          setTimeout(() => initWhatsAppConnection(accountId), 5000);
        } else {
          delete whatsappSockets[accountId];
          delete socketStatus[accountId];
        }
      } else if (connection === "open") {
        logger.info(`Connection established for account ${accountId}`);

        try {
          await prisma.whatsappAccount.update({
            where: { id: accountId },
            data: { status: WhatsappAccountStatus.ACTIVE },
          });
        } catch (error: unknown) {
          // Account might have been deleted, ignore the error
          logger.warn(
            `Failed to update account ${accountId} status to ACTIVE (might be deleted):`,
            error
          );
        }
      }
    });

    sock.ev.on("creds.update", saveCreds);

    whatsappSockets[accountId] = sock;

    return null;
  } catch (error) {
    logger.error(
      `Failed to initialize WhatsApp connection for account ${accountId}:`,
      error
    );
    return null;
  }
};

export const getOrCreateAccountForRecipient = async (
  recipientNumber: string
): Promise<number> => {
  const formattedNumber = formatPhoneNumber(recipientNumber);

  const existingMapping = await prisma.recipientAccountMap.findUnique({
    where: { recipientNumber: formattedNumber },
    include: {
      whatsappAccount: true,
    },
  });

  if (
    existingMapping &&
    existingMapping.whatsappAccount.status === WhatsappAccountStatus.ACTIVE
  ) {
    const socket = whatsappSockets[existingMapping.whatsappAccountId];
    if (socket) {
      return existingMapping.whatsappAccountId;
    }
  }

  const activeAccount = await prisma.whatsappAccount.findFirst({
    where: { status: WhatsappAccountStatus.ACTIVE },
  });

  if (!activeAccount) {
    throw new Error("No active WhatsApp account available");
  }

  const socket = whatsappSockets[activeAccount.id];
  if (!socket) {
    throw new Error(
      `No active WhatsApp connection for account ${activeAccount.id}`
    );
  }

  await prisma.recipientAccountMap.upsert({
    where: { recipientNumber: formattedNumber },
    update: { whatsappAccountId: activeAccount.id },
    create: {
      recipientNumber: formattedNumber,
      whatsappAccountId: activeAccount.id,
    },
  });

  return activeAccount.id;
};

export const sendTextMessage = async (
  accountId: number,
  to: string,
  text: string
): Promise<string> => {
  const formattedNumber = formatPhoneNumber(to);

  const socket = whatsappSockets[accountId];
  if (!socket) {
    throw new Error(`No active WhatsApp connection for account ${accountId}`);
  }

  try {
    const result = await socket.sendMessage(
      to.includes("@") ? to : `${formattedNumber}@s.whatsapp.net`,
      { text, linkPreview: null }
    );
    const messageId = result?.key.id;

    if (!messageId) throw new Error("Failed to send message");

    await prisma.recipientAccountMap.upsert({
      where: { recipientNumber: formattedNumber },
      update: { whatsappAccountId: accountId },
      create: {
        recipientNumber: formattedNumber,
        whatsappAccountId: accountId,
      },
    });

    return messageId;
  } catch (error) {
    logger.error(
      `Failed to send text message from account ${accountId}:`,
      error
    );

    throw error;
  }
};

export const sendMediaMessage = async (
  accountId: number,
  to: string,
  mediaType: "image" | "video" | "document",
  mediaContent: string,
  caption: string | undefined
): Promise<string> => {
  const formattedNumber = formatPhoneNumber(to);

  const socket = whatsappSockets[accountId];
  if (!socket) {
    throw new Error(`No active WhatsApp connection for account ${accountId}`);
  }

  try {
    let messageContent;

    const isUrl =
      mediaContent.startsWith("http://") || mediaContent.startsWith("https://");

    if (mediaType === "image") {
      messageContent = {
        image: isUrl
          ? { url: mediaContent }
          : Buffer.from(mediaContent, "base64"),
        caption: caption || "",
      };
    } else if (mediaType === "video") {
      messageContent = {
        video: isUrl
          ? { url: mediaContent }
          : Buffer.from(mediaContent, "base64"),
        caption: caption || "",
      };
    } else {
      messageContent = {
        document: isUrl
          ? { url: mediaContent }
          : Buffer.from(mediaContent, "base64"),
        caption: caption || "",
        mimetype: "application/octet-stream",
        fileName: caption || "document.pdf",
      };
    }

    const result = await socket.sendMessage(
      to.includes("@") ? to : `${formattedNumber}@s.whatsapp.net`,
      { ...messageContent, linkPreview: null }
    );
    const messageId = result?.key.id;

    if (!messageId) throw new Error("Failed to send message");

    await prisma.recipientAccountMap.upsert({
      where: { recipientNumber: formattedNumber },
      update: { whatsappAccountId: accountId },
      create: {
        recipientNumber: formattedNumber,
        whatsappAccountId: accountId,
      },
    });

    return messageId;
  } catch (error) {
    logger.error(
      `Failed to send media message from account ${accountId}:`,
      error
    );

    throw error;
  }
};

export const getSocketStatus = (accountId: number) => {
  const socket = whatsappSockets[accountId];
  if (!socket) {
    return null;
  }

  const status = socketStatus[accountId];
  return status ? String(status) : "unknown";
};

export const terminateSession = async (accountId: number): Promise<void> => {
  const socket = whatsappSockets[accountId];

  try {
    await prisma.recipientAccountMap.deleteMany({
      where: { whatsappAccountId: accountId },
    });

    const account = await prisma.whatsappAccount.delete({
      where: { id: accountId },
    });
    try {
      if (socket?.logout) {
        await socket.logout();
      }
      const sessionName = `session_${account.id}_${
        account.phoneNumber
      }_${account.createdAt.toLocaleDateString()}`;
      fs.rmSync(`sessions/${sessionName}`, { recursive: true, force: true });
    } catch {}

    delete whatsappSockets[accountId];
    delete socketStatus[accountId];

    logger.info(`Session terminated for account ${accountId}`);
  } catch (error) {
    logger.error(
      `Failed to terminate session for account ${accountId}:`,
      error
    );
    throw error;
  }
};

export const autoConnectWhatsAppAccounts = async (): Promise<void> => {
  try {
    const accounts = await prisma.whatsappAccount.findMany({});

    for (const account of accounts) {
      await initWhatsAppConnection(account.id);
    }

    logger.info("All WhatsApp accounts are now connected.");
  } catch (error) {
    logger.error("Failed to automatically connect WhatsApp accounts:", error);
  }
};

export const restartWhatsAppConnection = async (
  accountId: number
): Promise<string | null> => {
  try {
    logger.info(
      `Attempting to restart WhatsApp connection for account ${accountId}`
    );

    const existingSocket = whatsappSockets[accountId];
    if (existingSocket) {
      logger.info(`Terminating existing connection for account ${accountId}`);
      try {
        if (existingSocket.logout) {
          await existingSocket.logout().catch((err) => {
            logger.warn(
              `Could not logout cleanly for account ${accountId}: ${err.message}`
            );
          });
        }
      } catch (error) {
        logger.warn(
          `Error during socket logout for account ${accountId}: ${error}`
        );
      }

      delete whatsappSockets[accountId];
      delete socketStatus[accountId];
    }

    try {
      await prisma.whatsappAccount.update({
        where: { id: accountId },
        data: { status: WhatsappAccountStatus.INACTIVE },
      });
    } catch (error: unknown) {
      // Account might have been deleted, ignore the error
      logger.warn(
        `Failed to update account ${accountId} status in restart (might be deleted):`,
        error
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));

    logger.info(
      `Initializing new WhatsApp connection for account ${accountId}`
    );
    const result = await initWhatsAppConnection(accountId);

    if (result === null) {
      logger.info(
        `Successfully initiated reconnection process for account ${accountId}`
      );
      return null;
    } else {
      throw new Error(`Failed to restart connection: ${result}`);
    }
  } catch (error) {
    logger.error(
      `Failed to restart WhatsApp connection for account ${accountId}:`,
      error
    );

    await prisma.whatsappAccount
      .update({
        where: { id: accountId },
        data: { status: WhatsappAccountStatus.INACTIVE },
      })
      .catch((err) => {
        logger.error(`Failed to update account status: ${err.message}`);
      });

    return error instanceof Error ? error.message : "Unknown error occurred";
  }
};

export default {
  initWhatsAppConnection,
  sendTextMessage,
  sendMediaMessage,
  terminateSession,
  eventEmitter,
  getSocketStatus,
  restartWhatsAppConnection,
  getOrCreateAccountForRecipient,
};
