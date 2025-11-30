import UserModel from '../models/UserModel.js';
import NotificationModel from '../models/NotificationModel.js';

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
        message: 'Notification not found',
      });
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await notification.save();
    }

    return res.status(200).json({
      success: true,
      message: 'Notification marked as read',
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
      { $set: { isRead: true } }
    );

    // Lấy lại 10 notifications mới nhất sau khi update
    const updatedNotifications = await NotificationModel.find({
      receiver: userId,
    })
      .populate('sender', 'username avatar')
      .sort({ createdAt: -1 })
      .limit(10);

    return res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
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
      return res.status(404).json({ message: 'User not found' });
    }

    // Lấy 10 notifications mới nhất
    const notifications = await NotificationModel.find({ receiver: userId })
      .populate('sender', '_id username avatar') // chỉ populate các field cần thiết
      .sort({ createdAt: -1 }) // mới nhất trước
      .limit(10); // chỉ lấy 10 notifications mới nhất

    return res.status(200).json({
      success: true,
      message: 'Get notifications success',
      data: notifications,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy notifications:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
