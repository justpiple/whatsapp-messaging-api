import { Request, Response } from "express";
import { MessageStatus, WhatsappAccountStatus } from "@prisma/client";
import messageQueue from "../queues/messageQueue";
import whatsappService from "../services/whatsappService";
import logger from "../utils/logger";
import prisma from "../lib/prisma";

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { phone_number, message_type, message_content, caption } = req.body;
    const apiKeyId = req.apiKey.id;

    if (!message_content) {
      return res
        .status(400)
        .send({ status: 400, message: "message_content is required" });
    }

    const activeAccount = await prisma.whatsappAccount.findFirst({
      where: { status: WhatsappAccountStatus.ACTIVE, deletedAt: null },
      orderBy: [
        {
          messageLog: {
            _count: "asc",
          },
        },
      ],
    });

    if (!activeAccount) {
      return res
        .status(503)
        .json({ error: "No active WhatsApp account available" });
    }

    let messageId: string;

    if (message_type === "text") {
      messageId = await messageQueue.queueTextMessage(
        activeAccount.id,
        phone_number,
        message_content,
        apiKeyId,
      );
    } else if (["image", "video", "document"].includes(message_type)) {
      messageId = await messageQueue.queueMediaMessage(
        activeAccount.id,
        phone_number,
        message_type as "image" | "video" | "document",
        message_content,
        caption,
        apiKeyId,
      );
    } else {
      return res.status(400).json({ error: "Invalid message type" });
    }

    return res.status(202).json({
      message: "Message queued for delivery",
      message_id: messageId,
    });
  } catch (error) {
    logger.error("Error sending message:", error);
    return res.status(500).json({ error: "Failed to send message" });
  }
};

export const getMessageStatus = async (req: Request, res: Response) => {
  try {
    const { message_id } = req.params;

    const messageLog = await prisma.messageLog.findUnique({
      where: { id: message_id },
    });

    if (!messageLog) {
      return res.status(404).json({ error: "Message not found" });
    }

    return res.json({
      message_id: messageLog.id,
      status: messageLog.status,
      sent_time: messageLog.sentTime,
    });
  } catch (error) {
    logger.error("Error getting message status:", error);
    return res.status(500).json({ error: "Failed to get message status" });
  }
};

export const getMessage = async (req: Request, res: Response) => {
  try {
    const { message_id, account_id } = req.params;

    const accountId = parseInt(account_id, 10);

    if (isNaN(accountId)) {
      return res.status(400).json({ error: "Invalid account ID" });
    }

    const account = await prisma.whatsappAccount.findUnique({
      where: { id: accountId },
    });

    if (!account || account.status !== WhatsappAccountStatus.ACTIVE) {
      return res
        .status(404)
        .json({ error: "WhatsApp account not found or inactive" });
    }

    const message = await whatsappService.getMessageById(accountId, message_id);

    if (!message) {
      return res.status(404).json({ error: "Message not found in WhatsApp" });
    }

    return res.json({
      message_id,
      message,
    });
  } catch (error) {
    logger.error("Error getting message:", error);
    return res.status(500).json({ error: "Failed to get message" });
  }
};

export const cancelPendingMessage = async (req: Request, res: Response) => {
  try {
    const { message_id } = req.params;

    const messageLog = await prisma.messageLog.findUnique({
      where: { id: message_id },
    });

    if (!messageLog) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (messageLog.status !== MessageStatus.PENDING) {
      return res
        .status(400)
        .json({ error: "Message is not in pending status" });
    }

    await prisma.messageLog.update({
      where: { id: message_id },
      data: { status: MessageStatus.FAILED },
    });

    messageQueue.cancelJob(message_id);

    return res.json({
      message: "Message canceled successfully",
      message_id,
    });
  } catch (error) {
    logger.error("Error canceling message:", error);
    return res.status(500).json({ error: "Failed to cancel message" });
  }
};

export default {
  sendMessage,
  getMessageStatus,
  getMessage,
  cancelPendingMessage,
};
