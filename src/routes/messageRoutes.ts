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
 *       - **button**: Interactive message with quick reply buttons
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
 *                 enum: [text, image, video, document, button]
 *                 description: Type of message to send
 *                 example: "text"
 *               message_content:
 *                 type: string
 *                 description: |
 *                   Message content:
 *                   - For text: plain text string
 *                   - For media: URL (http/https) or base64 encoded string
 *                   - For button: body text of the button message
 *                 example: "Hello, this is a test message"
 *               caption:
 *                 type: string
 *                 description: Optional caption for media messages (image, video, document)
 *                 example: "Check out this image"
 *               buttons:
 *                 type: array
 *                 description: |
 *                   Required for button message type. Array of buttons with different actions.
 *                   Supported button types:
 *                   - **quick_reply**: Quick reply button (requires: type, display_text, id)
 *                   - **cta_url**: URL button (requires: type, display_text, url; optional: merchant_url)
 *                   - **cta_call**: Call button (requires: type, display_text, id)
 *                   - **cta_copy**: Copy button (requires: type, display_text, id, copy_code)
 *                   - **single_select**: List message button (requires: type, display_text, title, sections)
 *                 items:
 *                   type: object
 *                   required:
 *                     - type
 *                     - display_text
 *                   properties:
 *                     type:
 *                       type: string
 *                       enum: [quick_reply, cta_url, cta_call, cta_copy, single_select]
 *                       description: Type of button action
 *                       example: "quick_reply"
 *                     display_text:
 *                       type: string
 *                       description: Text displayed on the button
 *                       example: "Yes"
 *                     id:
 *                       type: string
 *                       description: |
 *                         Unique identifier (required for: quick_reply, cta_call, cta_copy)
 *                         Not required for single_select
 *                       example: "yes_button"
 *                     url:
 *                       type: string
 *                       description: URL for cta_url button type
 *                       example: "https://example.com"
 *                     merchant_url:
 *                       type: string
 *                       description: Optional merchant URL for cta_url button type
 *                       example: "https://merchant.example.com"
 *                     copy_code:
 *                       type: string
 *                       description: Copy code for cta_copy button type
 *                       example: "ABC123"
 *                     title:
 *                       type: string
 *                       description: Title for single_select button type
 *                       example: "List Menu"
 *                     sections:
 *                       type: array
 *                       description: Sections array for single_select button type
 *                       items:
 *                         type: object
 *                         required:
 *                           - title
 *                           - rows
 *                         properties:
 *                           title:
 *                             type: string
 *                             description: Section title
 *                             example: "Menu Options"
 *                           highlight_label:
 *                             type: string
 *                             description: Optional highlight label for section
 *                             example: "Popular"
 *                           rows:
 *                             type: array
 *                             description: Array of row items
 *                             items:
 *                               type: object
 *                               required:
 *                                 - title
 *                                 - id
 *                               properties:
 *                                 header:
 *                                   type: string
 *                                   description: Optional header text
 *                                   example: "Header"
 *                                 title:
 *                                   type: string
 *                                   description: Row title
 *                                   example: "All Menu"
 *                                 description:
 *                                   type: string
 *                                   description: Optional row description
 *                                   example: "View all available menus"
 *                                 id:
 *                                   type: string
 *                                   description: Row identifier
 *                                   example: "allmenu"
 *                 example:
 *                   - type: "quick_reply"
 *                     display_text: "Yes"
 *                     id: "yes_button"
 *                   - type: "quick_reply"
 *                     display_text: "No"
 *                     id: "no_button"
 *                   - type: "cta_url"
 *                     display_text: "Visit Website"
 *                     url: "https://example.com"
 *                   - type: "cta_call"
 *                     display_text: "Call Us"
 *                     id: "call_button"
 *                   - type: "cta_copy"
 *                     display_text: "Copy Code"
 *                     id: "copy_button"
 *                     copy_code: "ABC123"
 *               footer:
 *                 type: string
 *                 description: Optional footer text for button messages
 *                 example: "Please select an option"
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
 *             buttonMessage:
 *               summary: Button message example with multiple button types including list message
 *               value:
 *                 phone_number: "6281234567890"
 *                 message_type: "button"
 *                 message_content: "Choose an action:"
 *                 buttons:
 *                   - type: "quick_reply"
 *                     display_text: "Yes"
 *                     id: "yes_button"
 *                   - type: "quick_reply"
 *                     display_text: "No"
 *                     id: "no_button"
 *                   - type: "cta_url"
 *                     display_text: "Visit Website"
 *                     url: "https://example.com"
 *                   - type: "cta_call"
 *                     display_text: "Call Us"
 *                     id: "call_button"
 *                   - type: "cta_copy"
 *                     display_text: "Copy Code"
 *                     id: "copy_button"
 *                     copy_code: "ABC123"
 *                   - type: "single_select"
 *                     display_text: "List Menu"
 *                     title: "List Menu"
 *                     sections:
 *                       - title: "Menu Options"
 *                         rows:
 *                           - title: "Top Menu"
 *                             id: "topmenu"
 *                           - title: "Special Menu"
 *                             id: "specialmenu"
 *                           - title: "Other Menu"
 *                             id: "othermenu"
 *                 footer: "Please select an option"
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
