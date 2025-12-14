import { Request, Response } from "express";
import whatsappService from "../services/whatsappService.js";
import messageQueue from "../queues/messageQueue.js";
import logger from "../utils/logger.js";

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const {
      phone_number,
      message_type,
      message_content,
      caption,
      buttons,
      footer,
    } = req.body;

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
    } else if (message_type === "button") {
      if (!buttons || !Array.isArray(buttons) || buttons.length === 0) {
        return res.status(400).json({
          error: "buttons array is required for button message type",
        });
      }

      // Validate buttons structure based on type
      for (const button of buttons) {
        if (!button.type || !button.display_text) {
          return res.status(400).json({
            error: "Each button must have 'type' and 'display_text' properties",
          });
        }

        if (button.type === "quick_reply") {
          if (!button.id) {
            return res.status(400).json({
              error: "quick_reply button must have 'id' property",
            });
          }
        } else if (button.type === "cta_url") {
          if (!button.url) {
            return res.status(400).json({
              error: "cta_url button must have 'url' property",
            });
          }
        } else if (button.type === "cta_call") {
          if (!button.id) {
            return res.status(400).json({
              error: "cta_call button must have 'id' property",
            });
          }
        } else if (button.type === "cta_copy") {
          if (!button.id || !button.copy_code) {
            return res.status(400).json({
              error:
                "cta_copy button must have 'id' and 'copy_code' properties",
            });
          }
        } else if (button.type === "single_select") {
          if (
            !button.title ||
            !button.sections ||
            !Array.isArray(button.sections)
          ) {
            return res.status(400).json({
              error:
                "single_select button must have 'title' and 'sections' (array) properties",
            });
          }
          for (const section of button.sections) {
            if (
              !section.title ||
              !section.rows ||
              !Array.isArray(section.rows)
            ) {
              return res.status(400).json({
                error:
                  "Each section in single_select must have 'title' and 'rows' (array) properties",
              });
            }
            for (const row of section.rows) {
              if (!row.title || !row.id) {
                return res.status(400).json({
                  error:
                    "Each row in single_select sections must have 'title' and 'id' properties",
                });
              }
            }
          }
        } else {
          return res.status(400).json({
            error: `Unknown button type: ${button.type}. Supported types: quick_reply, cta_url, cta_call, cta_copy, single_select`,
          });
        }
      }

      jobId = await messageQueue.queueButtonMessage(
        accountId,
        phone_number,
        message_content,
        buttons,
        footer
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
