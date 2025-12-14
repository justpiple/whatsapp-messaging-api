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

export type ButtonAction =
  | {
      type: "quick_reply";
      display_text: string;
      id: string;
    }
  | {
      type: "cta_url";
      display_text: string;
      url: string;
      merchant_url?: string;
    }
  | {
      type: "cta_call";
      display_text: string;
      id: string;
    }
  | {
      type: "cta_copy";
      display_text: string;
      id: string;
      copy_code: string;
    }
  | {
      type: "single_select";
      display_text: string;
      title: string;
      sections: Array<{
        title: string;
        rows: Array<{
          title: string;
          id: string;
          description?: string;
          header?: string;
        }>;
        highlight_label?: string;
      }>;
    };

interface ButtonMessageJob {
  id: string;
  type: "button";
  accountId: number;
  to: string;
  text: string;
  buttons: Array<ButtonAction>;
  footer?: string;
  messageId?: string;
}

type MessageJob = TextMessageJob | MediaMessageJob | ButtonMessageJob;

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
    } else if (job.type === "media") {
      messageId = await whatsappService.sendMediaMessage(
        job.accountId,
        job.to,
        job.mediaType,
        job.mediaContent,
        job.caption
      );
    } else if (job.type === "button") {
      messageId = await whatsappService.sendButtonMessage(
        job.accountId,
        job.to,
        job.text,
        job.buttons,
        job.footer
      );
    } else {
      throw new Error(
        `Unknown message type: ${(job as MessageJob & { type: string }).type}`
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

export const queueButtonMessage = async (
  accountId: number,
  to: string,
  text: string,
  buttons: Array<ButtonAction>,
  footer?: string
): Promise<string> => {
  const jobId = uuidv4();

  const job: ButtonMessageJob = {
    id: jobId,
    type: "button",
    accountId,
    to,
    text,
    buttons,
    footer,
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
  queueButtonMessage,
  getQueueStats,
};
