import admin from "../../config/firebase.js";
import UserModel from "../models/UserModel.js";

/**
 * Gửi thông báo Push Notification tới một người dùng
 * @param {String} userId - ID người nhận
 * @param {Object} notificationPayload - Nội dung thông báo
 * @param {String} notificationPayload.title - Tiêu đề
 * @param {String} notificationPayload.body - Nội dung
 * @param {Object} notificationPayload.data - Dữ liệu kèm theo (optional)
 */
export const sendPushNotification = async (userId, { title, body, data }) => {
  try {
    // Nếu Firebase chưa được khởi tạo thì bỏ qua
    if (!admin.apps.length) return;

    const user = await UserModel.findById(userId).select(
      "fcmTokens preferences",
    );

    // Kiểm tra cài đặt nhận thông báo của user
    if (!user || !user.preferences?.pushNotifications) return;

    if (!user.fcmTokens || user.fcmTokens.length === 0) return;

    const message = {
      notification: { title, body },
      data: data || {},
      tokens: user.fcmTokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Dọn dẹp các token hết hạn hoặc không hợp lệ
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === "messaging/registration-token-not-registered" ||
            errorCode === "messaging/invalid-registration-token"
          ) {
            failedTokens.push(user.fcmTokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        await UserModel.findByIdAndUpdate(userId, {
          $pull: { fcmTokens: { $in: failedTokens } },
        });
        console.log(`🧹 Cleaned up ${failedTokens.length} invalid FCM tokens`);
      }
    }

    return response;
  } catch (error) {
    console.error("❌ Error sending FCM notification:", error);
  }
};
