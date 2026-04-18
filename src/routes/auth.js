import express from "express";

import {
  register,
  login,
  refreshToken,
  logout,
  checkOTP,
  resendOTP,
  changePassword,
  enable2FA,
  verify2FA,
  disable2FA,
} from "../app/controllers/AuthController.js";
import { verifyToken } from "../middlewares/verify.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/refreshToken", refreshToken);
router.post("/logout", verifyToken, logout);
router.post("/check-otp", checkOTP);
router.post("/resend-otp", resendOTP);

// Password & 2FA Management
router.post("/changePassword", verifyToken, changePassword);
router.post("/enable2FA", verifyToken, enable2FA);
router.post("/verify2FA", verifyToken, verify2FA);
router.post("/disable2FA", verifyToken, disable2FA);

export default router;
