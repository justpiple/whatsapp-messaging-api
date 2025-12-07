import { Request, Response } from "express";
import whatsappService, {
  getSocketStatus,
  restartWhatsAppConnection,
} from "../services/whatsappService";
import logger from "../utils/logger";
import prisma from "../lib/prisma";
import { WhatsappAccountStatus } from "@prisma/client";
import qrcode from "qrcode";

const qrCodeMap: Record<number, string> = {};

whatsappService.eventEmitter.on(
  "qr",
  (data: { accountId: number; qr: string }) => {
    qrCodeMap[data.accountId] = data.qr;
  }
);

export const addWhatsAppAccount = async (req: Request, res: Response) => {
  try {
    const { phone_number } = req.body;

    const existingAccount = await prisma.whatsappAccount.findFirst({
      where: {
        phoneNumber: phone_number,
      },
    });

    if (existingAccount) {
      return res.status(400).json({ error: "Phone number already registered" });
    }

    const newAccount = await prisma.whatsappAccount.create({
      data: {
        phoneNumber: phone_number,
        status: WhatsappAccountStatus.INACTIVE,
      },
    });

    await whatsappService.initWhatsAppConnection(newAccount.id);

    return res.status(201).json({
      message: "WhatsApp account created successfully",
      account_id: newAccount.id,
    });
  } catch (error) {
    logger.error("Error adding WhatsApp account:", error);
    return res.status(500).json({ error: "Failed to add WhatsApp account" });
  }
};

export const getQRCode = async (req: Request, res: Response) => {
  try {
    const { account_id } = req.params;
    const accountId = Number.parseInt(account_id, 10);

    if (Number.isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: "WhatsApp account not found" });
    }

    const acceptHeader = (req.get("Accept") || "").toLowerCase().trim();
    const wantsPng =
      acceptHeader.includes("image/png") &&
      !acceptHeader.includes("application/json");

    let qrCodeString = qrCodeMap[accountId];

    if (!qrCodeString) {
      await whatsappService.initWhatsAppConnection(accountId);

      await new Promise((resolve) => setTimeout(resolve, 5000));

      qrCodeString = qrCodeMap[accountId];

      if (!qrCodeString) {
        return res.status(404).json({
          error:
            "QR code not available yet. Please try again in a few seconds.",
        });
      }
    }

    if (!wantsPng) {
      const qrDataURL = await qrcode.toDataURL(qrCodeString);
      return res.json({ qr_code: qrDataURL });
    }

    const qrBuffer = await qrcode.toBuffer(qrCodeString, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 300,
    });

    res.status(200);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", qrBuffer.length);
    res.setHeader("Content-Disposition", "inline; filename=qrcode.png");
    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, max-age=0"
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");

    return res.send(qrBuffer);
  } catch (error) {
    logger.error("Error getting QR code:", error);
    return res.status(500).json({ error: "Failed to get QR code" });
  }
};

export const checkAccountStatus = async (req: Request, res: Response) => {
  try {
    const { account_id } = req.params;
    const accountId = Number.parseInt(account_id, 10);

    if (Number.isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: "WhatsApp account not found" });
    }

    const socketStatus = getSocketStatus(accountId);

    return res.json({
      database: {
        account_id: account.id,
        phone_number: account.phoneNumber,
        status: account.status,
      },
      socket: socketStatus ?? null,
    });
  } catch (error) {
    logger.error("Error checking account status:", error);
    return res.status(500).json({ error: "Failed to check account status" });
  }
};

export const terminateSession = async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    const accountId = Number.parseInt(session_id, 10);

    if (Number.isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: "WhatsApp account not found" });
    }

    await whatsappService.terminateSession(accountId);

    delete qrCodeMap[accountId];

    return res.json({
      message: "Session terminated successfully",
      account_id: accountId,
    });
  } catch (error) {
    logger.error("Error terminating session:", error);
    return res.status(500).json({ error: "Failed to terminate session" });
  }
};

export const restartSession = async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    const accountId = Number.parseInt(session_id, 10);

    if (Number.isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid session ID" });
    }

    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      return res.status(404).json({ error: "WhatsApp account not found" });
    }

    await restartWhatsAppConnection(account.id);

    return res.json({
      message: "Session restart initiated",
      account_id: accountId,
    });
  } catch (error) {
    logger.error("Error restarting session:", error);
    return res.status(500).json({ error: "Failed to restart session" });
  }
};

export const getWhatsAppAccounts = async (req: Request, res: Response) => {
  try {
    const existingAccount = await prisma.whatsappAccount.findMany();

    return res.status(200).json({
      message: "Successfully get data",
      accounts: existingAccount,
    });
  } catch (error) {
    logger.error("Error adding WhatsApp account:", error);
    return res.status(500).json({ error: "Failed to fetch information" });
  }
};

export default {
  addWhatsAppAccount,
  getQRCode,
  checkAccountStatus,
  terminateSession,
  restartSession,
  getWhatsAppAccounts,
};
