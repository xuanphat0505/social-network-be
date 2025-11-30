import express from 'express';

import {
  register,
  login,
  refreshToken,
  logout,
  checkOTP,
  resendOTP,
} from '../app/controllers/AuthController.js';
import { verifyToken } from '../middlewares/verify.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/refreshToken', refreshToken);
router.post('/logout', verifyToken, logout);
router.post('/check-otp', checkOTP);
router.post('/resend-otp', resendOTP);

export default router;
