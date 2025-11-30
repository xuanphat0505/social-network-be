import express from 'express';

import {
  sendMessage,
  getMessage,
  recentChatList,
  reactMessage,
  unreadMessage,
  readMessage,
  revokeMessageForBoth,
  revokeMessageForSelf,
  deleteMessage,
  searchMessage,
  pinnedMessage,
  deleteAllMessage,
  // createCallMessage,
} from '../app/controllers/MessageController.js';
import { verifyToken } from '../middlewares/verify.js';
import { upload } from '../middlewares/upload.js';

const router = express.Router();

router.get('/unread', verifyToken, unreadMessage);
router.get('/recent', verifyToken, recentChatList);
router.get('/:receiverId', verifyToken, getMessage);
// router.post('/call/:receiverId', verifyToken, createCallMessage);
router.put('/read/:senderId', verifyToken, readMessage);
router.put('/react/:messageId', verifyToken, reactMessage);
router.delete('/delete/:messageId', verifyToken, deleteMessage);
router.delete('/delete-all/:receiverId', verifyToken, deleteAllMessage);
router.post('/search/:receiverId', verifyToken, searchMessage);
router.post('/pinned/:messageId', verifyToken, pinnedMessage);
router.post('/revoke/single/:messageId', verifyToken, revokeMessageForSelf);
router.post('/revoke/both/:messageId', verifyToken, revokeMessageForBoth);
router.post('/send/:receiverId', verifyToken, upload.any('files', 10), sendMessage);

export default router;
