import Queue from "better-queue";
import whatsappService from "../services/whatsappService.js";
import logger from "../utils/logger.js";
import { config } from "../config/whatsapp.js";
import { v4 as uuidv4 } from "uuid";

interface TextMessageJob {
  id: string;
  type: "text";
  accountId: number;
  to: string;
  text: string;
  messageId?: string;
}

interface MediaMessageJob {
  id: string;
  type: "media";
  accountId: number;
  to: string;
  mediaType: "image" | "video" | "document";
  mediaContent: string;
  caption?: string;
  messageId?: string;
}

type MessageJob = TextMessageJob | MediaMessageJob;

const processMessage = async (
  job: MessageJob,
  callback: (error?: Error, result?: string) => void
) => {
  try {
    let messageId: string;

    if (job.type === "text") {
      messageId = await whatsappService.sendTextMessage(
        job.accountId,
        job.to,
        job.text
      );
    } else {
      messageId = await whatsappService.sendMediaMessage(
        job.accountId,
        job.to,
        job.mediaType,
        job.mediaContent,
        job.caption
      );
    }

    callback(undefined, messageId);
  } catch (error) {
    logger.error("Failed to process message job:", error);
    callback(error as Error);
  }
};

const queue = new Queue<MessageJob, string>(processMessage, {
  store: {
    type: "memory",
  },
  maxRetries: config.maxRetryCount,
  retryDelay: config.retryDelay,
  concurrent: config.queueConcurrent,
  maxTimeout: config.queueTimeout,
});

queue.on("task_finish", (taskId: string, result: string) => {
  logger.info(`Message job ${taskId} completed successfully: ${result}`);
});

queue.on("task_failed", (taskId: string, error: Error) => {
  logger.error(`Message job ${taskId} failed:`, error);
});

queue.on("task_progress", (taskId: string, progress: number) => {
  logger.debug(`Message job ${taskId} progress: ${progress}`);
});

export const queueTextMessage = async (
  accountId: number,
  to: string,
  text: string
): Promise<string> => {
  const jobId = uuidv4();

  const job: TextMessageJob = {
    id: jobId,
    type: "text",
    accountId,
    to,
    text,
  };

  queue.push(job);

  return jobId;
};

export const queueMediaMessage = async (
  accountId: number,
  to: string,
  mediaType: "image" | "video" | "document",
  mediaContent: string,
  caption?: string
): Promise<string> => {
  const jobId = uuidv4();

  const job: MediaMessageJob = {
    id: jobId,
    type: "media",
    accountId,
    to,
    mediaType,
    mediaContent,
    caption,
  };

  queue.push(job);

  return jobId;
};

export const getQueueStats = () => {
  // better-queue doesn't expose stats directly
  // We can return basic info
  return {
    message: "Queue stats not available. Better-queue manages jobs internally.",
  };
};

export default {
  queueTextMessage,
  queueMediaMessage,
  getQueueStats,
};
