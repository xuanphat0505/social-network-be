import express from "express";
import {
  getFailedLoginTrends,
  getGeographicDistribution,
  getTopIPAddresses,
  getRecentSecurityEvents,
  getSecurityOverview,
} from "../app/controllers/SecurityAnalyticsController.js";
import { verifyAdmin } from "../middlewares/verify.js";

const router = express.Router();

// All routes require admin authentication
router.get("/overview", verifyAdmin, getSecurityOverview);
router.get("/failed-login-trends", verifyAdmin, getFailedLoginTrends);
router.get("/geographic-distribution", verifyAdmin, getGeographicDistribution);
router.get("/top-ips", verifyAdmin, getTopIPAddresses);
router.get("/recent-events", verifyAdmin, getRecentSecurityEvents);

export default router;
