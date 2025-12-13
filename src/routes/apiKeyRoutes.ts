import { Router } from "express";
import apiKeyController from "../controllers/apiKeyController.js";
import { validateApiKey, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

/**
 * @swagger
 * /api-key:
 *   post:
 *     summary: Create a new API key
 *     description: |
 *       Generate a new API key for accessing the WhatsApp Messaging API.
 *       The API key will be automatically generated and returned in the response.
 *
 *       **Note:** This endpoint requires admin privileges.
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
 *                 description: Descriptive name for the API key (e.g., "Production API", "Test Environment")
 *                 example: "Production API Key"
 *           examples:
 *             example1:
 *               summary: Create API key example
 *               value:
 *                 name: "Production API Key"
 *     responses:
 *       201:
 *         description: API key successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "API key created successfully"
 *                 api_key:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       example: 1
 *                     name:
 *                       type: string
 *                       example: "Production API Key"
 *                     key:
 *                       type: string
 *                       description: The generated API key (save this securely, it won't be shown again)
 *                       example: "wapi_550e8400e29b41d4a716446655440000"
 *                     role:
 *                       type: string
 *                       enum: [ADMIN, SYSTEM]
 *                       example: "SYSTEM"
 *       400:
 *         description: Bad request - Name is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post("/", validateApiKey, requireAdmin, apiKeyController.createApiKey);

/**
 * @swagger
 * /api-key:
 *   get:
 *     summary: List all API keys
 *     description: |
 *       Retrieve a list of all API keys in the system. Only active (non-deleted) keys are returned.
 *
 *       **Note:** This endpoint requires admin privileges.
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 api_keys:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "Production API Key"
 *                       key:
 *                         type: string
 *                         example: "wapi_550e8400e29b41d4a716446655440000"
 *                       role:
 *                         type: string
 *                         enum: [ADMIN, SYSTEM]
 *                         example: "SYSTEM"
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-01-15T10:30:00Z"
 *       401:
 *         description: Unauthorized - Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", validateApiKey, requireAdmin, apiKeyController.getApiKeys);

/**
 * @swagger
 * /api-key/{key_id}:
 *   delete:
 *     summary: Delete an API key
 *     description: |
 *       Soft delete an API key. The key will be marked as deleted and can no longer be used
 *       for authentication. Admin API keys cannot be deleted.
 *
 *       **Note:** This endpoint requires admin privileges.
 *     tags: [API Keys]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: key_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: API key ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: API key successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "API key deleted successfully"
 *                 key_id:
 *                   type: integer
 *                   example: 1
 *       401:
 *         description: Unauthorized - Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden - Admin privileges required, or attempting to delete admin key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: API key not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  "/:key_id",
  validateApiKey,
  requireAdmin,
  apiKeyController.deleteApiKey
);

export default router;
