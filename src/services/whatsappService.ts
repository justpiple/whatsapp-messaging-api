import makeWASocket, {
  Browsers,
  DisconnectReason,
  WASocket,
  useMultiFileAuthState,
} from "baileys";
import { Boom } from "@hapi/boom";
import { EventEmitter } from "events";
import logger from "../utils/logger";
import prisma from "../lib/prisma";
import { WhatsappAccountStatus } from "@prisma/client";
import fs from "fs";
import { formatPhoneNumber } from "../utils/atomics";

const eventEmitter = new EventEmitter();

const whatsappSockets: Record<number, WASocket> = {};
const socketStatus: Record<number, string> = {};

export const initWhatsAppConnection = async (
  accountId: number,
): Promise<string | null> => {
  try {
    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new Error(`WhatsApp account with ID ${accountId} not found`);
    }

    const sessionName = `session_${account.id}_${account.phoneNumber}_${account.createdAt.toLocaleDateString()}`;
    const { state, saveCreds } = await useMultiFileAuthState(
      `sessions/${sessionName}`,
    );
    const sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      generateHighQualityLinkPreview: true,
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
        await prisma.whatsappAccount.update({
          where: { id: accountId },
          data: { status: WhatsappAccountStatus.INACTIVE },
        });

        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        logger.info(
          `Connection closed for account ${accountId}. Reconnecting: ${shouldReconnect}`,
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
        }
      } else if (connection === "open") {
        logger.info(`Connection established for account ${accountId}`);

        await prisma.whatsappAccount.update({
          where: { id: accountId },
          data: { status: WhatsappAccountStatus.ACTIVE },
        });
      }
    });

    sock.ev.on("creds.update", saveCreds);

    whatsappSockets[accountId] = sock;

    return null;
  } catch (error) {
    logger.error(
      `Failed to initialize WhatsApp connection for account ${accountId}:`,
      error,
    );
    return null;
  }
};

export const sendTextMessage = async (
  accountId: number,
  to: string,
  text: string,
): Promise<string> => {
  const formattedNumber = formatPhoneNumber(to);

  const socket = whatsappSockets[accountId];
  if (!socket) {
    throw new Error(`No active WhatsApp connection for account ${accountId}`);
  }

  try {
    const result = await socket.sendMessage(
      `${formattedNumber}@s.whatsapp.net`,
      { text },
    );
    const messageId = result?.key.id;

    if (!messageId) throw Error("Failed to send message");

    return messageId;
  } catch (error) {
    logger.error(
      `Failed to send text message from account ${accountId}:`,
      error,
    );

    throw error;
  }
};

export const sendMediaMessage = async (
  accountId: number,
  to: string,
  mediaType: "image" | "video" | "document",
  mediaContent: string,
  caption: string | undefined,
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
      `${formattedNumber}@s.whatsapp.net`,
      messageContent,
    );
    const messageId = result?.key.id;

    if (!messageId) throw Error("Failed to send message");

    return messageId;
  } catch (error) {
    logger.error(
      `Failed to send media message from account ${accountId}:`,
      error,
    );

    throw error;
  }
};

export const getMessageById = async (accountId: number, messageId: string) => {
  const socket = whatsappSockets[accountId];
  if (!socket) {
    throw new Error(`No active WhatsApp connection for account ${accountId}`);
  }

  return null;

  // try {
  //   // const message = await socket.loadMessage(messageId);
  //   // return message;
  // } catch (error) {
  //   logger.error(
  //     `Failed to get message ${messageId} from account ${accountId}:`,
  //     error,
  //   );
  //   throw error;
  // }
};

export const getSocketStatus = async (accountId: number) => {
  const socket = whatsappSockets[accountId];
  if (!socket) {
    return null;
  }

  return socketStatus[accountId] || "unknown";
};

export const terminateSession = async (accountId: number): Promise<void> => {
  const socket = whatsappSockets[accountId];

  try {
    const account = await prisma.whatsappAccount.delete({
      where: { id: accountId },
    });
    try {
      if (socket.logout) {
        await socket.logout();
      }
      const sessionName = `session_${account.id}_${account.phoneNumber}_${account.createdAt.toLocaleDateString()}`;
      fs.rmSync(`sessions/${sessionName}`, { recursive: true, force: true });
    } catch {}

    delete whatsappSockets[accountId];

    logger.info(`Session terminated for account ${accountId}`);
  } catch (error) {
    logger.error(
      `Failed to terminate session for account ${accountId}:`,
      error,
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
  accountId: number,
): Promise<string | null> => {
  try {
    logger.info(
      `Attempting to restart WhatsApp connection for account ${accountId}`,
    );

    const existingSocket = whatsappSockets[accountId];
    if (existingSocket) {
      logger.info(`Terminating existing connection for account ${accountId}`);
      try {
        await existingSocket.logout().catch((err) => {
          logger.warn(
            `Could not logout cleanly for account ${accountId}: ${err.message}`,
          );
        });
      } catch (error) {
        logger.warn(
          `Error during socket logout for account ${accountId}: ${error}`,
        );
      }

      delete whatsappSockets[accountId];
    }

    await prisma.whatsappAccount.update({
      where: { id: accountId },
      data: { status: WhatsappAccountStatus.INACTIVE },
    });

    logger.info(
      `Initializing new WhatsApp connection for account ${accountId}`,
    );
    const result = await initWhatsAppConnection(accountId);

    if (result === null) {
      logger.info(
        `Successfully initiated reconnection process for account ${accountId}`,
      );
      return null;
    } else {
      throw new Error(`Failed to restart connection: ${result}`);
    }
  } catch (error) {
    logger.error(
      `Failed to restart WhatsApp connection for account ${accountId}:`,
      error,
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
  getMessageById,
  terminateSession,
  eventEmitter,
  getSocketStatus,
  restartWhatsAppConnection,
};
