import express from 'express';
import {
  updateInfo,
  changeStatus,
  updateAvatar,
  forgetPassword,
  resetPassword,
  getAvailableFriends,
  getReceiverFriend,
  getCodeFromUser,
  blockUser,
  toggle2FA,
  toggleDeviceVerification,
  toggleLoginAlert,
} from '../app/controllers/UserController.js';
import { verifyToken } from '../middlewares/verify.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.get('/friends', verifyToken, getAvailableFriends);
router.post('/forget-password', forgetPassword);
router.post('/reset-password', resetPassword);
router.put('/change', verifyToken, changeStatus);
router.post('/toggle2fa', verifyToken, toggle2FA);
router.post('/toggle-device-verification', verifyToken, toggleDeviceVerification);
router.post('/toggle-login-alert', verifyToken, toggleLoginAlert);
router.put('/update/info', verifyToken, updateInfo);
router.put('/update/avatar', verifyToken, upload.single('avatar'), updateAvatar);
router.get('/code/:receiverId', verifyToken, getCodeFromUser);
router.get('/receiver/:receiverId', verifyToken, getReceiverFriend);
router.put('/block/:receiverId', verifyToken, blockUser);

export default router;
