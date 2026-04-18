import express from "express";
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
  exportUsers,
  searchUsersAdmin,
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  getUserDetails,
  sendUserWarning,
} from "../app/controllers/UserController.js";
import {
  getPreferences,
  updatePreferences,
} from "../app/controllers/PreferencesController.js";
import { verifyToken, verifyAdmin } from "../middlewares/verify.js";
import { upload, avatarUpload } from "../middlewares/upload.js";

const router = express.Router();

router.get("/friends", verifyToken, getAvailableFriends);
router.post("/forget-password", forgetPassword);
router.post("/reset-password", resetPassword);
router.put("/change", verifyToken, changeStatus);
router.post("/toggle2fa", verifyToken, toggle2FA);
router.post(
  "/toggle-device-verification",
  verifyToken,
  toggleDeviceVerification,
);
router.post("/toggle-login-alert", verifyToken, toggleLoginAlert);
router.put("/update/info", verifyToken, updateInfo);
router.put(
  "/update/avatar",
  verifyToken,
  upload.single("avatar"),
  updateAvatar,
);
router.get("/code/:receiverId", verifyToken, getCodeFromUser);
router.get("/receiver/:receiverId", verifyToken, getReceiverFriend);
router.put("/block/:receiverId", verifyToken, blockUser);

// Preferences Routes
router.get("/preferences", verifyToken, getPreferences);
router.put("/preferences", verifyToken, updatePreferences);

// Admin Routes
// Upload avatar to Cloudinary, returns URL (used before createUser/updateUser)
router.post(
  "/upload-avatar",
  verifyToken,
  verifyAdmin,
  avatarUpload.single("avatar"),
  (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }
    return res.status(200).json({ success: true, url: req.file.path });
  },
);
// Specific paths BEFORE /:id wildcard
router.get("/export", verifyToken, verifyAdmin, exportUsers);
router.get("/search-admin", verifyToken, verifyAdmin, searchUsersAdmin);
router.get("/", verifyToken, verifyAdmin, getUsers);
router.post("/", verifyToken, verifyAdmin, createUser);
// Wildcard /:id routes last
router.get("/:id/details", verifyToken, verifyAdmin, getUserDetails);
router.post("/:id/warning", verifyToken, verifyAdmin, sendUserWarning);
router.put("/:id", verifyToken, verifyAdmin, updateUser);
router.delete("/:id", verifyToken, verifyAdmin, deleteUser);

export default router;
