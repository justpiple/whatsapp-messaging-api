import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { PrismaClient } from "@prisma/client";
import { apiLimiter } from "./middlewares/rateLimitMiddleware";
import messageRoutes from "./routes/messageRoutes";
import sessionRoutes from "./routes/sessionRoutes";
import apiKeyRoutes from "./routes/apiKeyRoutes";
import logger from "./utils/logger";
import { autoConnectWhatsAppAccounts } from "./services/whatsappService";

export const prisma = new PrismaClient();

const app = express();

app.use(cors());
app.use(helmet());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("combined"));
app.use(apiLimiter);

app.use("/message", messageRoutes);
app.use("/session", sessionRoutes);
app.use("/api-key", apiKeyRoutes);

const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "WhatsApp Messaging API",
      version: "1.0.0",
      description: "API for sending messages through WhatsApp",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: "Development server",
      },
      {
        url: `${process.env.HOST_URL}`,
        description: "Production Server",
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date() });
});

app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use((err: unknown, req: express.Request, res: express.Response) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

autoConnectWhatsAppAccounts();

export default app;
