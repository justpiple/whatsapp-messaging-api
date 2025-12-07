import { Request, Response } from "express";
import whatsappService from "../services/whatsappService";
import messageQueue from "../queues/messageQueue";
import logger from "../utils/logger";

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const { phone_number, message_type, message_content, caption } = req.body;

    if (!message_content) {
      return res
        .status(400)
        .send({ status: 400, message: "message_content is required" });
    }

    const accountId =
      await whatsappService.getOrCreateAccountForRecipient(phone_number);

    let jobId: string;

    if (message_type === "text") {
      jobId = await messageQueue.queueTextMessage(
        accountId,
        phone_number,
        message_content
      );
    } else if (["image", "video", "document"].includes(message_type)) {
      jobId = await messageQueue.queueMediaMessage(
        accountId,
        phone_number,
        message_type as "image" | "video" | "document",
        message_content,
        caption
      );
    } else {
      return res.status(400).json({ error: "Invalid message type" });
    }

    return res.status(202).json({
      message: "Message queued for delivery",
      job_id: jobId,
      account_id: accountId,
    });
  } catch (error) {
    logger.error("Error sending message:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Failed to send message";
    return res.status(500).json({ error: errorMessage });
  }
};

export default {
  sendMessage,
};
