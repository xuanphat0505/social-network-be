import MessageModel from "../models/MessageModel.js";
import UserModel from "../models/UserModel.js";
import crypto from "crypto";
import { sendPushNotification } from "../helpers/fcmHelper.js";

import {
  emitSendedMessage,
  emitReactedMessage,
  emitStopTypingMessage,
  emitGetUnreadMessages,
  emitUpdateChatList,
  emitRevokeMessage,
  emitPinnedMessage,
} from "../../utils/socket.js";

const algorithm = "aes-256-cbc";
const secretKey = Buffer.from(process.env.MESSAGE_ENCRYPTION_KEY, "hex"); // parse hex -> 32 bytes

// Encrypt
const encryptMessage = (text) => {
  if (!text) return text;
  const iv = crypto.randomBytes(16); // Tạo IV mới cho mỗi message
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  // Lưu cả IV cùng với message để giải mã
  return iv.toString("hex") + ":" + encrypted;
};

// Decrypt
const decryptMessage = (encryptedText) => {
  if (!encryptedText) return encryptedText;

  // Kiểm tra nếu là tin nhắn cũ (chưa mã hóa) - không có format IV:encrypted
  if (!encryptedText.includes(":")) {
    // Tin nhắn cũ chưa mã hóa, trả về nguyên bản
    return encryptedText;
  }

  try {
    const parts = encryptedText.split(":");
    if (parts.length < 2) {
      // Format không đúng, trả về nguyên bản
      return encryptedText;
    }

    const ivHex = parts.shift();
    const encrypted = parts.join(":");

    // Validate IV length (should be 32 hex chars = 16 bytes)
    if (ivHex.length !== 32) {
      // IV không đúng độ dài, có thể là tin nhắn cũ
      return encryptedText;
    }

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    // Nếu giải mã thất bại, có thể là tin nhắn cũ chưa mã hóa
    console.log(
      "Decryption failed, returning original text (likely old unencrypted message)",
    );
    return encryptedText;
  }
};

export const sendMessage = async (req, res) => {
  const userId = req.user._id;
  const { receiverId } = req.params;
  let { content, type } = req.body;
  const io = req.app.get("io");

  try {
    // 1. Kiểm tra sender & receiver tồn tại song song
    const [sender, receiver] = await Promise.all([
      UserModel.findById(userId).lean(),
      UserModel.findById(receiverId).lean(),
    ]);

    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "Sender not found" });
    }

    if (!receiver) {
      return res
        .status(404)
        .json({ success: false, message: "Receiver not found" });
    }

    // 2. Kiểm tra bạn bè
    const isFriend =
      Array.isArray(sender.contacts) &&
      sender.contacts.some((id) => id.toString() === receiverId.toString());
    if (!isFriend) {
      return res.status(403).json({
        success: false,
        message: "Receiver is not in your contacts",
      });
    }

    // 3. Kiểm tra block (cả 2 chiều)
    const senderBlocked =
      Array.isArray(sender.blockedUsers) &&
      sender.blockedUsers.some((id) => id.toString() === receiverId.toString());
    const receiverBlocked =
      Array.isArray(receiver.blockedUsers) &&
      receiver.blockedUsers.some((id) => id.toString() === userId.toString());

    if (senderBlocked || receiverBlocked) {
      return res.status(403).json({
        success: false,
        message: "You can't reply to this conversation.",
      });
    }

    // 4. Xử lý file upload (nếu có)
    let filesData = [];
    if (req.files && req.files.length > 0) {
      filesData = req.files.map((file) => {
        const isImage = file.mimetype.startsWith("image/");
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        return {
          originalName: file.originalname,
          fileUrl: file.path,
          type: isImage ? "image" : "file",
          sizeMB: Number(sizeMB),
        };
      });
    }

    // 5. Kiểm tra nội dung tin nhắn
    if (!filesData.length && (!content || content.trim() === "")) {
      return res.status(400).json({
        success: false,
        message: "Message content is required",
      });
    }

    // 6. Xác định type của message
    const messageType = filesData.length
      ? filesData.every((f) => f.type === "image")
        ? "image"
        : "file"
      : type || "text";

    // 7. Thực hiện các truy vấn phụ trợ song song: 
    // Lấy tin nhắn cuối để check showAvatar và đếm unreadCount
    const [lastMessage, unreadCount] = await Promise.all([
      MessageModel.findOne({
        $or: [
          { senderId: userId, receiverId },
          { senderId: receiverId, receiverId: userId },
        ],
      })
        .sort({ createdAt: -1 })
        .select("senderId")
        .lean(),
      MessageModel.countDocuments({
        senderId: userId,
        receiverId: receiverId,
        isRead: false,
      }),
    ]);

    const showAvatar =
      !lastMessage || lastMessage.senderId.toString() !== userId.toString();

    // 8. Tạo và lưu message
    const message = new MessageModel({
      senderId: userId,
      receiverId,
      content: content ? encryptMessage(content) : null,
      files: filesData,
      type: messageType,
      isRead: false,
    });

    await message.save();

    // 9. Prepare payload (dùng thông tin đã có từ sender/receiver để tránh populate thêm)
    const payload = {
      _id: message._id,
      senderId: {
        _id: sender._id,
        username: sender.username,
        avatar: sender.avatar,
        status: sender.status,
      },
      receiverId: {
        _id: receiver._id,
        username: receiver.username,
        avatar: receiver.avatar,
        status: receiver.status,
      },
      content: content, // Content gốc chưa mã hóa để gửi socket cho nhanh
      type: message.type,
      files: message.files,
      createdAt: message.createdAt,
      showAvatar,
    };

    // 10. Emit socket realtime
    // Emit to receiver
    emitSendedMessage(io, receiverId.toString(), payload);
    emitStopTypingMessage(io, receiverId.toString(), userId);
    emitGetUnreadMessages(io, receiverId.toString(), message);
    emitUpdateChatList(io, receiverId.toString(), {
      partnerId: payload.senderId._id,
      lastMessage: payload,
      unreadCount: unreadCount + 1, // +1 vì tin nhắn này vừa mới lưu
    });

    // 11. Gửi Push Notification qua FCM
    sendPushNotification(receiverId, {
      title: sender.username,
      body: content || (filesData.length > 0 ? "Đã gửi tệp đính kèm" : "Tin nhắn mới"),
      data: {
        type: "new_message",
        senderId: userId.toString(),
        senderName: sender.username,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: payload,
    });

  } catch (error) {
    console.error("❌ sendMessage error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};


export const getMessage = async (req, res) => {
  const userId = req.user._id;
  const { receiverId } = req.params;
  const { page = 1, limit = 30 } = req.query;

  try {
    // Kiểm tra người gửi
    const sender = await UserModel.findById(userId).select("_id");
    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "Sender not found" });
    }

    // Kiểm tra người nhận
    const receiver = await UserModel.findById(receiverId).select("_id");
    if (!receiver) {
      return res
        .status(404)
        .json({ success: false, message: "Receiver not found" });
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Lấy tin nhắn với pagination (mới nhất trước)
    const messages = await MessageModel.find({
      $or: [
        { senderId: userId, receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
    })
      .populate([
        { path: "senderId", select: "_id username avatar" },
        { path: "emoji.userId", select: "_id username avatar" },
      ])
      .sort({ createdAt: -1 }) // mới nhất trước
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Đếm tổng số tin nhắn để xác định có còn tin nhắn cũ hơn không
    const totalMessages = await MessageModel.countDocuments({
      $or: [
        { senderId: userId, receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
    });

    // Đảo lại để client hiển thị từ cũ → mới
    const reversed = messages.reverse();

    const data = reversed.map((m, idx) => {
      const next = idx < reversed.length - 1 ? reversed[idx + 1] : null;
      const showAvatar =
        !next || next.senderId._id.toString() !== m.senderId._id.toString();
      return {
        ...m,
        showAvatar,
        content: m.content ? decryptMessage(m.content) : null,
      };
    });

    const hasMore = skip + limitNum < totalMessages;

    return res.status(200).json({
      success: true,
      message: "Get messages success",
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalMessages,
        hasMore,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message });
  }
};

export const recentChatList = async (req, res) => {
  const userId = req.user._id;

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Lấy tất cả tin nhắn liên quan đến user
    const messages = await MessageModel.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .sort({ createdAt: -1 }) // tin mới nhất trước
      .populate("senderId", "_id username avatar status")
      .populate("receiverId", "_id username avatar status")
      .lean();

    // Gom theo partner
    const chatMap = new Map();

    messages.forEach((msg) => {
      const partner =
        msg.senderId._id.toString() === userId.toString()
          ? msg.receiverId
          : msg.senderId;

      const partnerId = partner._id.toString();

      // Chỉ lấy tin nhắn mới nhất của mỗi partner
      if (!chatMap.has(partnerId)) {
        chatMap.set(partnerId, msg); // Lưu trực tiếp tin nhắn
      }
    });

    const recentChats = Array.from(chatMap.values()).map((chat) => {
      const partnerId =
        chat.senderId._id.toString() === userId.toString()
          ? chat.receiverId._id.toString()
          : chat.senderId._id.toString();

      // Đếm số tin chưa đọc từ partner đó gửi cho user hiện tại
      const unreadCount = messages.filter(
        (m) =>
          m.senderId._id.toString() === partnerId &&
          m.receiverId._id.toString() === userId.toString() &&
          !m.isRead,
      ).length;

      return {
        ...chat,
        content: chat.content ? decryptMessage(chat.content) : null, // Giải mã content cho chat list
        unreadCount, // thêm số tin chưa đọc
      };
    });

    // Sắp xếp lại theo thời gian
    recentChats.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      success: true,
      message: "Recent chat list fetched successfully",
      data: recentChats,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reactMessage = async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;
  const { icon } = req.body;

  try {
    const user = await UserModel.findById(userId).select("_id username avatar");
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    const message = await MessageModel.findById(messageId);
    if (!message)
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });

    const isParticipant =
      message.senderId.toString() === userId.toString() ||
      message.receiverId?.toString() === userId.toString();
    if (!isParticipant) {
      return res
        .status(403)
        .json({ success: false, message: "Not allowed to react this message" });
    }

    const io = req.app.get("io");
    const targetUserId =
      message.senderId.toString() === userId.toString()
        ? message.receiverId
        : message.senderId;

    // Nếu không có icon => xóa reaction của user
    if (!icon) {
      await MessageModel.updateOne(
        { _id: messageId },
        { $pull: { emoji: { userId } } },
      );

      const updated = await MessageModel.findById(messageId).populate(
        "emoji.userId",
        "_id username avatar",
      );

      emitReactedMessage(io, targetUserId, {
        messageId,
        emoji: updated.emoji, // luôn gửi full array emoji
      });

      return res.status(200).json({
        success: true,
        message: "Reaction removed",
        data: updated,
      });
    }

    // Kiểm tra user đã react chưa
    const existing = message.emoji.find(
      (e) => e.userId.toString() === userId.toString(),
    );

    if (existing) {
      // Cập nhật icon
      await MessageModel.updateOne(
        { _id: messageId, "emoji.userId": userId },
        { $set: { "emoji.$.icon": icon } },
      );
    } else {
      // Thêm mới reaction
      await MessageModel.updateOne(
        { _id: messageId },
        { $push: { emoji: { userId, icon } } },
      );
    }

    const updated = await MessageModel.findById(messageId).populate(
      "emoji.userId",
      "_id username avatar",
    );

    emitReactedMessage(io, targetUserId, {
      messageId,
      emoji: updated.emoji, // Luôn là mảng
    });

    return res.status(200).json({
      success: true,
      message: "Reaction added successfully",
      data: updated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const unreadMessage = async (req, res) => {
  const userId = req.user._id;
  try {
    // 1. Kiểm tra user tồn tại
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 2. Lấy toàn bộ tin nhắn chưa đọc gửi cho user này
    const unreadMessages = await MessageModel.find({
      receiverId: userId,
      isRead: false,
    })
      .populate("senderId", "_id username avatar") // lấy info người gửi
      .populate("receiverId", "_id username avatar") // lấy info người nhận
      .sort({ createdAt: -1 }); // sắp xếp mới nhất lên đầu

    // 3. Trả về dữ liệu
    return res.status(200).json({
      success: true,
      message: "Get unread messages success",
      data: unreadMessages,
      total: unreadMessages.length,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const readMessage = async (req, res) => {
  const userId = req.user._id;
  const senderId = req.params.senderId;

  try {
    // Kiểm tra user và sender tồn tại
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const sender = await UserModel.findById(senderId);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: "Sender not found",
      });
    }

    // 📌 Cập nhật tất cả tin nhắn chưa đọc từ sender → đã đọc
    await MessageModel.updateMany(
      {
        senderId: senderId,
        receiverId: userId,
        isRead: false,
      },
      { $set: { isRead: true } },
    );

    // 📌 Lấy lại tất cả tin nhắn chưa đọc còn lại (từ người khác)
    const remainingUnreadMessages = await MessageModel.find({
      receiverId: userId,
      isRead: false,
    })
      .populate("senderId", "_id username avatar")
      .populate("receiverId", "_id username avatar")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      message: "Marked messages as read",
      data: remainingUnreadMessages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Ẩn tin nhắn cho riêng mình
export const revokeMessageForSelf = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;

    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Check quyền: chỉ cho phép sender hoặc receiver ẩn
    if (
      message.senderId.toString() !== userId.toString() &&
      message.receiverId.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to hide this message",
      });
    }

    // Nếu chưa có thì thêm user vào deletedBy
    const deletedByStr = (message.deletedBy || []).map((id) => id.toString());
    if (!deletedByStr.includes(userId.toString())) {
      message.deletedBy.push(userId);
      await message.save();
    }

    // populate thêm nếu cần (senderId, receiverId) để client dùng được luôn
    const updatedMessage = await MessageModel.findById(messageId)
      .populate("senderId", "_id username avatar")
      .populate("receiverId", "_id username avatar");

    return res.status(200).json({
      success: true,
      message: "Message hidden for you",
      data: updatedMessage,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Thu hồi tin nhắn cho cả hai
export const revokeMessageForBoth = async (req, res) => {
  try {
    const userId = req.user._id;
    const { messageId } = req.params;

    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Chỉ cho phép người gửi thu hồi
    if (message.senderId.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ success: false, message: "You can't revoke this message" });
    }

    if (message.isRevoked) {
      return res
        .status(400)
        .json({ success: false, message: "Message already revoked" });
    }

    // 🔹 Cập nhật trạng thái và nội dung (mã hóa nội dung thu hồi)
    message.isRevoked = true;
    message.content = encryptMessage("Tin nhắn đã được thu hồi");
    message.files = []; // nếu muốn xoá file đính kèm khi thu hồi
    await message.save();

    await message.populate("senderId", "_id username avatar status");
    await message.populate("receiverId", "_id username avatar status");

    const io = req.app.get("io");

    // Emit cho cả 2 bên để cập nhật UI tin nhắn (với content đã giải mã)
    emitRevokeMessage(io, message.receiverId._id.toString(), {
      messageId,
      isRevoked: true,
      content: decryptMessage(message.content),
    });

    emitRevokeMessage(io, userId.toString(), {
      messageId,
      isRevoked: true,
      content: decryptMessage(message.content),
    });

    // 🔹 Cập nhật chatList cho cả 2 bên (với content đã giải mã)
    const chatListPayload = {
      _id: message._id,
      senderId: message.senderId,
      receiverId: message.receiverId,
      content: decryptMessage(message.content),
      type: "text",
      files: [],
      createdAt: message.createdAt,
      showAvatar: true,
      isRevoked: true,
    };

    // Người nhận
    emitUpdateChatList(io, message.receiverId._id.toString(), {
      partnerId: message.senderId._id.toString(),
      lastMessage: chatListPayload,
      unreadCount: 0,
    });

    // Người gửi
    emitUpdateChatList(io, userId.toString(), {
      partnerId: message.receiverId._id.toString(),
      lastMessage: chatListPayload,
      unreadCount: 0,
    });

    return res.status(200).json({
      success: true,
      message: "Message revoked for both",
      data: message,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteMessage = async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;

  try {
    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // Chỉ cho phép nếu đã revoke trước đó
    if (!message.isRevoked && !message.deletedBy) {
      return res.status(400).json({
        success: false,
        message: "Message must be revoked before it can be deleted permanently",
      });
    }

    // Đảm bảo field tồn tại
    if (!message.deletedPermanentlyBy) {
      message.deletedPermanentlyBy = [];
    }

    // Thêm userId nếu chưa có
    const arr = message.deletedPermanentlyBy.map((id) => id.toString());
    if (!arr.includes(userId.toString())) {
      message.deletedPermanentlyBy.push(userId);
      await message.save();
    }

    // Nếu cả sender và receiver đều đã xóa => xóa hẳn khỏi DB
    if (
      message.deletedPermanentlyBy.includes(message.senderId.toString()) &&
      message.deletedPermanentlyBy.includes(message.receiverId.toString())
    ) {
      await MessageModel.findByIdAndDelete(messageId);
      return res.status(200).json({
        success: true,
        message: "Message permanently deleted from DB",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Message deleted for you",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAllMessage = async (req, res) => {
  const userId = req.user._id;
  const { receiverId } = req.params;

  try {
    // kiểm tra user tồn tại
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // xóa tất cả tin nhắn giữa userId và receiverId (2 chiều)
    await MessageModel.deleteMany({
      $or: [
        { senderId: userId, receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "All messages have been deleted successfully",
    });
  } catch (error) {
    console.error("❌ deleteAllMessage error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const searchMessage = async (req, res) => {
  const userId = req.user._id;
  const { receiverId } = req.params;
  const { keyword } = req.body;

  try {
    // kiểm tra user có tồn tại không
    const sender = await UserModel.findById(userId);
    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "Sender not found" });
    }

    // nếu không có từ khóa thì trả rỗng
    if (!keyword || keyword.trim() === "") {
      return res
        .status(400)
        .json({ success: false, message: "Keyword is required" });
    }

    // tìm tin nhắn giữa 2 user chứa keyword (không phân biệt hoa thường)
    const allMessages = await MessageModel.find({
      $or: [
        { senderId: userId, receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
    }).sort({ createdAt: 1 }); // lấy toàn bộ history theo thứ tự

    if (!allMessages || allMessages.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No messages found or messages are too old",
      });
    }

    // tìm match (giải mã content trước khi search)
    const matchedMessages = allMessages
      .map((msg, index) => ({
        ...msg.toObject(),
        index,
        content: msg.content ? decryptMessage(msg.content) : null,
      }))
      .filter(
        (msg) => msg.content && new RegExp(keyword, "i").test(msg.content), // ✅ check trước
      );

    return res.status(200).json({
      success: true,
      count: matchedMessages.length,
      messages: matchedMessages,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

export const pinnedMessage = async (req, res) => {
  const userId = req.user._id;
  const { messageId } = req.params;

  try {
    // 1. Tìm user
    const sender = await UserModel.findById(userId);
    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 2. Tìm message
    const message = await MessageModel.findById(messageId);
    if (!message) {
      return res
        .status(404)
        .json({ success: false, message: "Message not found" });
    }

    // 3. Kiểm tra user có quyền pin (phải là sender hoặc receiver)
    if (
      message.senderId.toString() !== userId.toString() &&
      message.receiverId.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to pin this message",
      });
    }

    // 4. Toggle pin/unpin
    message.isPinned = !message.isPinned;
    await message.save();

    const payload = {
      _id: messageId,
      receiverId: message.receiverId,
      senderId: message.senderId,
      isPinned: message.isPinned,
    };
    // gửi realtime cho cả sender và receiver
    const io = req.app.get("io");
    emitPinnedMessage(io, message.receiverId.toString(), payload);
    emitPinnedMessage(io, message.senderId.toString(), payload);

    return res.status(200).json({
      success: true,
      data: message,
      message: message.isPinned
        ? "Message pinned successfully"
        : "Message unpinned successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
