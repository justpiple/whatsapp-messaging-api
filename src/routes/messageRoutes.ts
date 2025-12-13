import { Router } from "express";
import messageController from "../controllers/messageController.js";
import { validateApiKey } from "../middlewares/authMiddleware.js";
import { messageLimiter } from "../middlewares/rateLimitMiddleware.js";

const router = Router();

/**
 * @swagger
 * /message:
 *   post:
 *     summary: Send a WhatsApp message
 *     description: |
 *       Queue a message for delivery via WhatsApp. The message will be sent using a sticky session
 *       (the same account will be used for the same recipient number if available).
 *
 *       Supported message types:
 *       - **text**: Plain text message
 *       - **image**: Image with optional caption (URL or base64)
 *       - **video**: Video with optional caption (URL or base64)
 *       - **document**: Document file with optional caption (URL or base64)
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
 *                 description: Recipient's phone number (with or without country code)
 *                 example: "6281234567890"
 *               message_type:
 *                 type: string
 *                 enum: [text, image, video, document]
 *                 description: Type of message to send
 *                 example: "text"
 *               message_content:
 *                 type: string
 *                 description: |
 *                   Message content:
 *                   - For text: plain text string
 *                   - For media: URL (http/https) or base64 encoded string
 *                 example: "Hello, this is a test message"
 *               caption:
 *                 type: string
 *                 description: Optional caption for media messages (image, video, document)
 *                 example: "Check out this image"
 *           examples:
 *             textMessage:
 *               summary: Text message example
 *               value:
 *                 phone_number: "6281234567890"
 *                 message_type: "text"
 *                 message_content: "Hello, this is a test message"
 *             imageMessage:
 *               summary: Image message example
 *               value:
 *                 phone_number: "6281234567890"
 *                 message_type: "image"
 *                 message_content: "https://example.com/image.jpg"
 *                 caption: "Check out this image"
 *     responses:
 *       202:
 *         description: Message successfully queued for delivery
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Message queued for delivery"
 *                 job_id:
 *                   type: string
 *                   description: Unique job identifier for tracking
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 account_id:
 *                   type: integer
 *                   description: WhatsApp account ID used for sending
 *                   example: 1
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid message type"
 *       401:
 *         description: Unauthorized - Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Invalid API key"
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to send message"
 *       503:
 *         description: No active WhatsApp account available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "No active WhatsApp account available"
 */
router.post("/", validateApiKey, messageLimiter, messageController.sendMessage);

export default router;
