import { Router } from "express";
import sessionController from "../controllers/sessionController";
import { validateApiKey, requireAdmin } from "../middlewares/authMiddleware";

const router = Router();

/**
 * @swagger
 * /session:
 *   get:
 *     summary: Get list of WhatsApp accounts
 *     description: Retrieve all WhatsApp account records from the database
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
 *                   example: Successfully get data
 *                 accounts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         example: 1
 *                       phoneNumber:
 *                         type: string
 *                         example: "+6281234567890"
 *                       status:
 *                         type: string
 *                         enum: [ACTIVE, INACTIVE]
 *                         example: INACTIVE
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-04-29T10:00:00Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         example: "2025-04-29T10:00:00Z"
 *                       deletedAt:
 *                         type: string
 *                         format: date-time
 *                         nullable: true
 *                         example: null
 *       500:
 *         description: Failed to fetch information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to fetch information
 */
router.get("/", validateApiKey, sessionController.getWhatsAppAccounts);

/**
 * @swagger
 * /session:
 *   post:
 *     summary: Add a new WhatsApp account
 *     description: Create a new WhatsApp account to connect with
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
 *                 description: Phone number for the WhatsApp account
 *     responses:
 *       201:
 *         description: WhatsApp account created successfully
 *       400:
 *         description: Phone number already registered
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin privileges required
 */
router.post(
  "/",
  validateApiKey,
  requireAdmin,
  sessionController.addWhatsAppAccount,
);

/**
 * @swagger
 * /session/{account_id}/qr:
 *   get:
 *     summary: Get QR code for authentication
 *     description: Get the QR code required to authenticate the WhatsApp account
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: account_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the WhatsApp account
 *     responses:
 *       200:
 *         description: QR code data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 qr_code_url:
 *                   type: string
 *                   description: URL of the QR code for authentication
 *           image/png:
 *             description: QR code image in PNG format
 *             content:
 *               image/png:
 *                 schema:
 *                   type: string
 *                   format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin privileges required
 *       404:
 *         description: Account not found or QR code not available
 */

router.get(
  "/:account_id/qr",
  validateApiKey,
  requireAdmin,
  sessionController.getQRCode,
);

/**
 * @swagger
 * /session/{account_id}/status:
 *   get:
 *     summary: Check account status
 *     description: Get the status of a WhatsApp account
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: account_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the WhatsApp account
 *     responses:
 *       200:
 *         description: Account status details
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Account not found
 */
router.get(
  "/:account_id/status",
  validateApiKey,
  sessionController.checkAccountStatus,
);

/**
 * @swagger
 * /session/{session_id}:
 *   delete:
 *     summary: Terminate WhatsApp session
 *     description: End an active WhatsApp session
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the session to terminate
 *     responses:
 *       200:
 *         description: Session terminated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin privileges required
 *       404:
 *         description: Session not found
 */
router.delete(
  "/:session_id",
  validateApiKey,
  requireAdmin,
  sessionController.terminateSession,
);

/**
 * @swagger
 * /session/{session_id}/restart:
 *   post:
 *     summary: Restart WhatsApp session
 *     description: Restart a WhatsApp session
 *     tags: [Sessions]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: session_id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID of the session to restart
 *     responses:
 *       200:
 *         description: Session restart initiated
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - admin privileges required
 *       404:
 *         description: Session not found
 */
router.post(
  "/:session_id/restart",
  validateApiKey,
  requireAdmin,
  sessionController.restartSession,
);

export default router;
