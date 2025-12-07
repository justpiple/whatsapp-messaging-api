import { Request, Response } from "express";
import { ApiKeyRole } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import logger from "../utils/logger";
import prisma from "../lib/prisma";

export const createApiKey = async (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: "Name is required" });
    }

    const apiKey = `wapi_${uuidv4().replace(/-/g, "")}`;

    const newApiKey = await prisma.apiKey.create({
      data: {
        name,
        apiKey,
      },
    });

    return res.status(201).json({
      message: "API key created successfully",
      api_key: {
        id: newApiKey.id,
        name: newApiKey.name,
        key: apiKey,
        role: newApiKey.role,
      },
    });
  } catch (error) {
    logger.error("Error creating API key:", error);
    return res.status(500).json({ error: "Failed to create API key" });
  }
};

export const getApiKeys = async (req: Request, res: Response) => {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        apiKey: true,
        role: true,
        createdAt: true,
      },
    });

    return res.json({
      api_keys: apiKeys.map((key) => ({
        id: key.id,
        name: key.name,
        key: key.apiKey,
        role: key.role,
        created_at: key.createdAt,
      })),
    });
  } catch (error) {
    logger.error("Error getting API keys:", error);
    return res.status(500).json({ error: "Failed to get API keys" });
  }
};

export const deleteApiKey = async (req: Request, res: Response) => {
  try {
    const { key_id } = req.params;
    const keyId = Number.parseInt(key_id, 10);

    if (Number.isNaN(keyId)) {
      return res.status(400).json({ error: "Invalid API key ID" });
    }

    const apiKey = await prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      return res.status(404).json({ error: "API key not found" });
    }

    if (apiKey.role === ApiKeyRole.ADMIN) {
      return res.status(403).json({ error: "Cannot delete admin API key" });
    }

    await prisma.apiKey.update({
      where: { id: keyId },
      data: { deletedAt: new Date() },
    });

    return res.json({
      message: "API key deleted successfully",
      key_id: keyId,
    });
  } catch (error) {
    logger.error("Error deleting API key:", error);
    return res.status(500).json({ error: "Failed to delete API key" });
  }
};

export default {
  createApiKey,
  getApiKeys,
  deleteApiKey,
};
