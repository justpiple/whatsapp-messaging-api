import { Router } from "express";
import apiKeyController from "../controllers/apiKeyController";
import { validateApiKey, requireAdmin } from "../middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * /api-key:
 *   post:
 *     summary: Create a new API key
 *     description: Create a new API key (admin only)
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Name for the API key
 *     responses:
 *       201:
 *         description: API key created successfully
 *       400:
 *         description: Name is required
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin privileges required
 */
router.post("/", validateApiKey, requireAdmin, apiKeyController.createApiKey);

/**
 * @swagger
 * /api-key:
 *   get:
 *     summary: Get all API keys
 *     description: Get a list of all API keys (admin only)
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: List of API keys
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin privileges required
 */
router.get("/", validateApiKey, requireAdmin, apiKeyController.getApiKeys);

/**
 * @swagger
 * /api-key/{key_id}:
 *   delete:
 *     summary: Delete an API key
 *     description: Delete an API key (admin only)
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: key_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the API key to delete
 *     responses:
 *       200:
 *         description: API key deleted successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin privileges required
 *       404:
 *         description: API key not found
 */
router.delete(
  "/:key_id",
  validateApiKey,
  requireAdmin,
  apiKeyController.deleteApiKey,
);

export default router;
