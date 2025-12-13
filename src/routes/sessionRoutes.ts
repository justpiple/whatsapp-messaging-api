import { Router } from "express";
import sessionController from "../controllers/sessionController.js";
import { validateApiKey, requireAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

/**
 * @swagger
 * /session:
 *   get:
 *     summary: List all WhatsApp accounts
 *     description: |
 *       Retrieve a list of all WhatsApp accounts registered in the system.
 *       Returns account information including status, phone number, and timestamps.
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved WhatsApp accounts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Successfully get data"
 *                 accounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/WhatsAppAccount'
 *       401:
 *         description: Unauthorized - Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get("/", validateApiKey, sessionController.getWhatsAppAccounts);

/**
 * @swagger
 * /session:
 *   post:
 *     summary: Register a new WhatsApp account
 *     description: |
 *       Register a new WhatsApp account in the system. After registration, you need to
 *       scan the QR code using the GET /session/{account_id}/qr endpoint to authenticate.
 *
 *       **Note:** This endpoint requires admin privileges.
 *     tags: [Sessions]
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
 *             properties:
 *               phone_number:
 *                 type: string
 *                 description: Phone number for the WhatsApp account (with or without country code)
 *                 example: "6281234567890"
 *           examples:
 *             example1:
 *               summary: Register account example
 *               value:
 *                 phone_number: "6281234567890"
 *     responses:
 *       201:
 *         description: WhatsApp account successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "WhatsApp account created successfully"
 *                 account_id:
 *                   type: integer
 *                   example: 1
 *       400:
 *         description: Bad request - Phone number already registered or invalid format
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
router.post(
  "/",
  validateApiKey,
  requireAdmin,
  sessionController.addWhatsAppAccount
);

/**
 * @swagger
 * /session/{account_id}/qr:
 *   get:
 *     summary: Get QR code for WhatsApp authentication
 *     description: |
 *       Retrieve the QR code required to authenticate a WhatsApp account.
 *       Response behavior depends on the **Accept** header:
 *       - `application/json` (default): JSON with base64 **data URL** (displays directly in Swagger UI)
 *       - `image/png`: raw PNG binary image
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: account_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: WhatsApp account ID
 *         example: 1
 *     responses:
 *       200:
 *         description: QR code retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qr_code:
 *                   type: string
 *                   format: byte
 *                   description: Base64-encoded PNG **data URL**
 *                   example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *           image/png:
 *             schema:
 *               type: string
 *               format: binary
 *             description: Raw PNG image (only with Accept=image/png)
 *       401:
 *         description: Unauthorized — Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Forbidden — Admin privileges required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Account not found or QR code not available yet
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

router.get(
  "/:account_id/qr",
  validateApiKey,
  requireAdmin,
  sessionController.getQRCode
);

/**
 * @swagger
 * /session/{account_id}/status:
 *   get:
 *     summary: Get WhatsApp account status
 *     description: |
 *       Retrieve the current status of a WhatsApp account, including database status
 *       and socket connection status.
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: account_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: WhatsApp account ID
 *         example: 1
 *     responses:
 *       200:
 *         description: Account status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 database:
 *                   type: object
 *                   properties:
 *                     account_id:
 *                       type: integer
 *                       example: 1
 *                     phone_number:
 *                       type: string
 *                       example: "6281234567890"
 *                     status:
 *                       type: string
 *                       enum: [ACTIVE, INACTIVE]
 *                       example: "ACTIVE"
 *                 socket:
 *                   type: string
 *                   nullable: true
 *                   description: Socket connection status (e.g., "open", "close", "connecting")
 *                   example: "open"
 *       401:
 *         description: Unauthorized - Invalid or missing API key
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/:account_id/status",
  validateApiKey,
  sessionController.checkAccountStatus
);

/**
 * @swagger
 * /session/{session_id}:
 *   delete:
 *     summary: Delete a WhatsApp account
 *     description: |
 *       Permanently delete a WhatsApp account and terminate its session. This will:
 *       - Disconnect the WhatsApp session
 *       - Remove the account from the database
 *       - Delete all associated recipient mappings
 *       - Remove session files
 *
 *       **Warning:** This action cannot be undone.
 *
 *       **Note:** This endpoint requires admin privileges.
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: WhatsApp account ID to delete
 *         example: 1
 *     responses:
 *       200:
 *         description: Account successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Session terminated successfully"
 *                 account_id:
 *                   type: integer
 *                   example: 1
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
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete(
  "/:session_id",
  validateApiKey,
  requireAdmin,
  sessionController.terminateSession
);

/**
 * @swagger
 * /session/{session_id}/restart:
 *   post:
 *     summary: Restart WhatsApp connection
 *     description: |
 *       Restart the WhatsApp connection for an account. This will:
 *       - Disconnect the current session
 *       - Clear the connection state
 *       - Reinitialize the connection
 *
 *       Use this endpoint if you're experiencing connection issues or need to refresh
 *       the WhatsApp session.
 *
 *       **Note:** This endpoint requires admin privileges.
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: WhatsApp account ID to restart
 *         example: 1
 *     responses:
 *       200:
 *         description: Restart process initiated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Session restart initiated"
 *                 account_id:
 *                   type: integer
 *                   example: 1
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
 *       404:
 *         description: Account not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post(
  "/:session_id/restart",
  validateApiKey,
  requireAdmin,
  sessionController.restartSession
);

export default router;
