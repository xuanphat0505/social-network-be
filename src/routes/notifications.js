import express from "express";

import {
  readNotifications,
  readSingleNotification,
  getNotifications,
  sendBroadcast,
} from "../app/controllers/NotificationControllers.js";

import { verifyToken, verifyAdmin } from "../middlewares/verify.js";

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.put("/read", verifyToken, readNotifications);
router.put("/read/:notificationId", verifyToken, readSingleNotification);
router.post("/broadcast", verifyToken, verifyAdmin, sendBroadcast);

export default router;
