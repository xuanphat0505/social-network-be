import express from "express";
import { verifyAdmin } from "../middlewares/verify.js";
import { getStats } from "../app/controllers/DashboardController.js";

const router = express.Router();

router.get("/stats", verifyAdmin, getStats);

export default router;
