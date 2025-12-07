import { Request, Response, NextFunction } from "express";
import { ApiKeyRole } from "@prisma/client";
import logger from "../utils/logger";
import prisma from "../lib/prisma";

interface ApiKeyData {
  id: number;
  name: string;
  apiKey: string;
  role: string;
}

declare module "express-serve-static-core" {
  interface Request {
    apiKey: ApiKeyData;
  }
}

export const validateApiKey = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.header("X-API-Key");

    if (!apiKey) {
      return res.status(401).json({ error: "API key is required" });
    }

    const validApiKey = await prisma.apiKey.findFirst({
      where: {
        apiKey,
        deletedAt: null,
      },
    });

    if (!validApiKey) {
      return res.status(401).json({ error: "Invalid API key" });
    }

    req.apiKey = {
      id: validApiKey.id,
      name: validApiKey.name,
      apiKey: validApiKey.apiKey,
      role: validApiKey.role,
    };

    next();
  } catch (error) {
    logger.error("Error validating API key:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const requireAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.apiKey.role !== ApiKeyRole.ADMIN) {
    return res.status(403).json({ error: "Admin privileges required" });
  }

  next();
};

export default {
  validateApiKey,
  requireAdmin,
};
