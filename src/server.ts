import dotenv from "dotenv";
import app from "./app";
import logger from "./utils/logger";

dotenv.config();

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(
    `API Documentation available at http://localhost:${PORT}/api-docs`,
  );
});
process.on("unhandledRejection", (err: Error) => {
  logger.error("UNHANDLED REJECTION! Shutting down...", err);
  server.close(() => {
    process.exit(1);
  });
});

export default server;
