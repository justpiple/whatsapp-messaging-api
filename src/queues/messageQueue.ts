import PgBoss from "pg-boss";
import whatsappService from "../services/whatsappService";
import logger from "../utils/logger";
import prisma from "../lib/prisma";
import { MessageStatus, WhatsappAccountStatus } from "@prisma/client";
import { config } from "../config/whatsapp";

const boss = new PgBoss({
  connectionString: process.env.DATABASE_URL,
  schema: "message_schedule",
});

interface TextMessageJob {
  type: "text";
  accountId: number;
  to: string;
  text: string;
  apiKeyId: number;
  messageId?: string;
}

interface MediaMessageJob {
  type: "media";
  accountId: number;
  to: string;
  mediaType: "image" | "video" | "document";
  mediaContent: string;
  caption?: string;
  apiKeyId: number;
  messageId?: string;
}

type MessageJob = TextMessageJob | MediaMessageJob;

boss.work<MessageJob>(
  "send-message",
  async (jobs: PgBoss.Job<MessageJob>[]) => {
    for (let job of jobs) {
      const data = job.data;
      try {
        const account = await prisma.whatsappAccount.findUnique({
          where: { id: data.accountId },
        });

        if (!account || account.status !== WhatsappAccountStatus.ACTIVE) {
          throw new Error(`WhatsApp account ${data.accountId} is not active`);
        }

        if (data.type === "text") {
          await whatsappService.sendTextMessage(
            data.accountId,
            data.to,
            data.text,
          );
        } else {
          await whatsappService.sendMediaMessage(
            data.accountId,
            data.to,
            data.mediaType,
            data.mediaContent,
            data.caption,
          );
        }

        if (data.messageId) {
          await prisma.messageLog.update({
            where: { id: data.messageId },
            data: {
              status: MessageStatus.SENT,
              sentTime: new Date(),
            },
          });
          boss.deleteJob("send-message", job.id);
        }
      } catch (error: unknown) {
        logger.error("Failed to send message:", error);

        if (data.messageId) {
          await prisma.messageLog.update({
            where: { id: data.messageId },
            data: {
              status: MessageStatus.FAILED,
            },
          });
        }

        throw error;
      }
    }
  },
);

export const queueTextMessage = async (
  accountId: number,
  to: string,
  text: string,
  apiKeyId: number,
): Promise<string> => {
  const messageLog = await prisma.messageLog.create({
    data: {
      messageId: "",
      accountId,
      status: MessageStatus.PENDING,
      retryCount: 0,
      sendBy: apiKeyId,
    },
  });

  await boss.send(
    "send-message",
    {
      type: "text",
      accountId,
      to,
      text,
      apiKeyId,
      messageId: messageLog.id,
      id: messageLog.id,
    },
    { retryLimit: config.maxRetryCount },
  );

  return messageLog.id;
};

export const queueMediaMessage = async (
  accountId: number,
  to: string,
  mediaType: "image" | "video" | "document",
  mediaContent: string,
  caption: string | undefined,
  apiKeyId: number,
): Promise<string> => {
  const messageLog = await prisma.messageLog.create({
    data: {
      messageId: "",
      accountId,
      status: MessageStatus.PENDING,
      retryCount: 0,
      sendBy: apiKeyId,
    },
  });

  await boss.send(
    "send-message",
    {
      type: "media",
      accountId,
      to,
      mediaType,
      mediaContent,
      caption,
      apiKeyId,
      messageId: messageLog.id,
      id: messageLog.id,
    },
    { retryLimit: config.maxRetryCount },
  );

  return messageLog.id;
};

const cancelJob = async (jobId: string): Promise<boolean> => {
  try {
    const job = await boss.getJobById("send-message", jobId);

    if (!job) {
      logger.error(`Job with ID ${jobId} does not exist.`);
      return false;
    }

    if (job.state === "failed" || job.state === "cancelled") {
      logger.info(`Job ${jobId} is already processed or being processed.`);
      return false;
    }

    await boss.cancel("send-message", jobId);
    logger.info(`Job ${jobId} has been successfully canceled.`);

    return true;
  } catch (error) {
    logger.error(`Failed to cancel job ${jobId}:`, error);
    return false;
  }
};

boss
  .start()
  .then(async () => {
    logger.info("pg-boss started successfully");
    await boss.createQueue("send-message");
  })
  .catch((error) => {
    logger.error("Failed to start pg-boss:", error);
  });

export default {
  queueTextMessage,
  queueMediaMessage,
  cancelJob,
};
