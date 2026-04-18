import UserModel from "../models/UserModel.js";
import NotificationModel from "../models/NotificationModel.js";
import { emitBroadcastNotification } from "../../utils/socket.js";

export const readSingleNotification = async (req, res) => {
  const userId = req.user._id;
  const { notificationId } = req.params;

  try {
    const notification = await NotificationModel.findOne({
      _id: notificationId,
      receiver: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Notification not found",
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notification,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const readNotifications = async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "You're not authenticated",
      });
    }

    // Cập nhật 10 notifications mới nhất thuộc userId
    await NotificationModel.updateMany(
      { receiver: userId, isRead: false },
      { $set: { isRead: true } },
    );

    // Lấy lại 10 notifications mới nhất sau khi update
    const updatedNotifications = await NotificationModel.find({
      receiver: userId,
    })
      .populate("sender", "username avatar")
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: updatedNotifications,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getNotifications = async (req, res) => {
  const userId = req.user._id;

  try {
    // Kiểm tra user tồn tại
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Lấy 10 notifications mới nhất
    const notifications = await NotificationModel.find({ receiver: userId })
      .populate("sender", "_id username avatar") // chỉ populate các field cần thiết
      .sort({ createdAt: -1 }) // mới nhất trước
      .limit(10); // chỉ lấy 10 notifications mới nhất

    return res.status(200).json({
      success: true,
      message: "Get notifications success",
      data: notifications,
    });
  } catch (error) {
    console.error("❌ Lỗi lấy notifications:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const sendBroadcast = async (req, res) => {
  const { title, message } = req.body;
  const adminId = req.user._id;

  try {
    if (!title || !message) {
      return res
        .status(400)
        .json({ success: false, message: "Title and message are required" });
    }

    // 1. Get all users except admin (sender)
    const users = await UserModel.find({ _id: { $ne: adminId } }).select("_id");

    if (users.length === 0) {
      return res
        .status(200)
        .json({ success: true, message: "No users to broadcast to" });
    }

    // 2. Prepare notifications
    const notifications = users.map((user) => ({
      sender: adminId,
      receiver: user._id,
      type: "system",
      title,
      content: message,
      isRead: false,
    }));

    // 3. Insert into DB
    await NotificationModel.insertMany(notifications);

    // 4. Emit socket
    const io = req.app.get("io");

    // Construct data for socket
    // We can fetch admin details or use req.user if available (usually populate in verifyToken)
    // Assuming req.user is populated by verifyToken
    const senderData = {
      _id: adminId,
      username: "System Administrator",
      avatar:
        "https://res.cloudinary.com/drngsxvb3/image/upload/q_auto/f_auto/v1776490861/user_rnttki.png", // Default or admin avatar
    };

    emitBroadcastNotification(io, {
      sender: senderData,
      type: "system",
      title,
      content: message,
      createdAt: new Date(),
    });

    return res.status(200).json({
      success: true,
      message: `Broadcast sent to ${users.length} users`,
    });
  } catch (error) {
    console.error("Broadcast Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
