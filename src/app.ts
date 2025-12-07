import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { apiLimiter } from "./middlewares/rateLimitMiddleware";
import messageRoutes from "./routes/messageRoutes";
import sessionRoutes from "./routes/sessionRoutes";
import apiKeyRoutes from "./routes/apiKeyRoutes";
import logger from "./utils/logger";
import { autoConnectWhatsAppAccounts } from "./services/whatsappService";

const app = express();

app.use(cors());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        imgSrc: ["'self'", "data:", "blob:"],
        fontSrc: ["'self'", "data:"],
      },
    },
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(morgan("combined"));
app.set("trust proxy", 1);
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
      description:
        "API for sending WhatsApp messages with support for text, images, videos, and documents. Features include sticky session routing, queue-based message processing, SQLite storage, multiple account management, and QR code authentication. All endpoints require an API key in the X-API-Key header.",
      contact: {
        name: "API Support",
      },
      license: {
        name: "MIT",
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: "Development server",
      },
      ...(process.env.HOST_URL
        ? [
            {
              url: process.env.HOST_URL,
              description: "Production server",
            },
          ]
        : []),
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: "apiKey",
          in: "header",
          name: "X-API-Key",
          description:
            "API key for authentication. Get your API key from the admin panel.",
        },
      },
      schemas: {
        Error: {
          type: "object",
          properties: {
            error: {
              type: "string",
              description: "Error message",
              example: "Invalid request",
            },
          },
          required: ["error"],
        },
        WhatsAppAccount: {
          type: "object",
          properties: {
            id: {
              type: "integer",
              example: 1,
            },
            phoneNumber: {
              type: "string",
              example: "6281234567890",
            },
            status: {
              type: "string",
              enum: ["ACTIVE", "INACTIVE"],
              example: "ACTIVE",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T10:30:00Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2025-01-15T10:30:00Z",
            },
          },
        },
      },
    },
    tags: [
      {
        name: "Messages",
        description: "Endpoints for sending and managing WhatsApp messages",
      },
      {
        name: "Sessions",
        description: "Endpoints for managing WhatsApp accounts and sessions",
      },
      {
        name: "API Keys",
        description: "Endpoints for managing API keys (admin only)",
      },
    ],
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerDocs = swaggerJsdoc(swaggerOptions);
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocs, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "WhatsApp Messaging API",
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true,
    },
  })
);

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
