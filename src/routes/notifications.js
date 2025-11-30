import express from "express";

import {
  readNotifications,
  readSingleNotification,
  getNotifications,
} from "../app/controllers/NotificationControllers.js";

import { verifyToken } from "../middlewares/verify.js";

const router = express.Router();

router.get("/", verifyToken, getNotifications);
router.put("/read", verifyToken, readNotifications);
router.put("/read/:notificationId", verifyToken, readSingleNotification);

export default router;
