import express from "express";
import {
  getConversationMetrics,
  searchConversations,
} from "../app/controllers/AdminController.js";
import { verifyAdmin } from "../middlewares/verify.js";

const router = express.Router();

router.get("/stats/conversations/metrics", verifyAdmin, getConversationMetrics);
router.get("/stats/conversations/search", verifyAdmin, searchConversations);

export default router;
