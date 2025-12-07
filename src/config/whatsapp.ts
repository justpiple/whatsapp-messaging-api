import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  maxRetryCount: Number.parseInt(process.env.MAX_RETRY_COUNT || "3", 10),
  queueConcurrent: Number.parseInt(process.env.QUEUE_CONCURRENT || "5", 10),
  queueTimeout: Number.parseInt(process.env.QUEUE_TIMEOUT || "30000", 10),
  retryDelay: Number.parseInt(process.env.RETRY_DELAY || "2000", 10),
};
