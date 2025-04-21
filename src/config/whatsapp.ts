import * as dotenv from "dotenv";

dotenv.config();

export const config = {
  maxRetryCount: parseInt(process.env.MAX_RETRY_COUNT || "3", 10),
};
