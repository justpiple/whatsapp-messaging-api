import { Router } from "express";
import messageController from "../controllers/messageController";
import { validateApiKey } from "../middlewares/authMiddleware";
import { messageLimiter } from "../middlewares/rateLimitMiddleware";

const router = Router();

/**
 * @swagger
 * /message:
 *   post:
 *     summary: Send a message via WhatsApp
 *     description: Send text, image, video, or document messages through WhatsApp
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone_number
 *               - message_type
 *               - message_content
 *             properties:
 *               phone_number:
 *                 type: string
 *                 description: Recipient's phone number
 *               message_type:
 *                 type: string
 *                 enum: [text, image, video, document]
 *                 description: Type of message to send
 *               message_content:
 *                 type: string
 *                 description: Content of the message (text or URL/base64 for media)
 *               caption:
 *                 type: string
 *                 description: Caption for media messages (optional)
 *     responses:
 *       202:
 *         description: Message queued for delivery
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       503:
 *         description: No active WhatsApp account available
 */
router.post("/", validateApiKey, messageLimiter, messageController.sendMessage);

/**
 * @swagger
 * /message/{message_id}:
 *   get:
 *     summary: Check message status
 *     description: Get the status of a message by its ID
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the message
 *     responses:
 *       200:
 *         description: Message status details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message not found
 */
router.get("/:message_id", validateApiKey, messageController.getMessageStatus);

/**
 * @swagger
 * /get-message/{message_id}/{account_id}:
 *   get:
 *     summary: Get message from WhatsApp
 *     description: Retrieve a message from WhatsApp by its ID and account ID
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the message
 *       - in: path
 *         name: account_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the WhatsApp account
 *     responses:
 *       200:
 *         description: Message details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message or account not found
 */
router.get(
  "/get-message/:message_id/:account_id",
  validateApiKey,
  messageController.getMessage,
);

/**
 * @swagger
 * /message/{message_id}/cancel:
 *   post:
 *     summary: Cancel pending message
 *     description: Cancel a message that is still in pending status
 *     tags: [Messages]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID of the message to cancel
 *     responses:
 *       200:
 *         description: Message canceled successfully
 *       400:
 *         description: Message is not in pending status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Message not found
 */
router.post(
  "/:message_id/cancel",
  validateApiKey,
  messageController.cancelPendingMessage,
);

export default router;
