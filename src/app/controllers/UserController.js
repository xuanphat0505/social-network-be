import UserModel from "../models/UserModel.js";
import MessageModel from "../models/MessageModel.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import { sendMail } from "../../services/MailService.js";
import { getPasswordResetTemplate } from "../../services/TemplateEmail.js";
import {
  emitChangedStatus,
  emitFriendOnline,
  emitBlockedByUser,
  emitUnBlockedByUser,
} from "../../utils/socket.js";
import { generateUniqueCode } from "../helpers/generateCode.js";

export const updateInfo = async (req, res) => {
  const userId = req.user._id;
  const { username, location, slogan } = req.body;
  try {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        username,
        location,
        slogan,
      },
      { new: true, runValidators: true },
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    return res
      .status(200)
      .json({ success: true, message: "Update info success", data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const changeStatus = async (req, res) => {
  const { status } = req.query;
  const userId = req.user._id;
  try {
    const user = await UserModel.findByIdAndUpdate(
      userId,
      {
        status: status,
      },
      { new: true, runValidators: true },
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }
    const io = req.app.get("io");
    if (Array.isArray(user.contacts) && user.contacts.length > 0) {
      user.contacts.forEach((contactId) => {
        emitChangedStatus(io, contactId.toString(), {
          userId: userId,
          status: user.status,
        });
        emitFriendOnline(io, contactId.toString(), user);
      });
    }
    return res.status(200).json({ success: true, data: user });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAvatar = async (req, res) => {
  const userId = req.user._id;

  try {
    let avatarUrl;

    // Check if file was uploaded (from multer)
    if (req.file) {
      // File uploaded via multer to Cloudinary
      avatarUrl = req.file.path; // Cloudinary URL
    } else if (req.body.avatar) {
      // Avatar URL from gallery selection
      avatarUrl = req.body.avatar;
    } else {
      return res.status(400).json({
        success: false,
        message: "Please provide an avatar URL or upload an image",
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Avatar updated successfully",
      data: { avatar: user.avatar },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const forgetPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "No account found for this email address. Please enter your email again",
      });
    }
    const randomPassword = crypto.randomBytes(16).toString("hex");
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    user.password = hashedPassword;
    await user.save();

    const html = getPasswordResetTemplate(randomPassword);
    sendMail(email, "🔑 Password Reset - Your new password", html);

    return res.status(200).json({
      success: true,
      message:
        "Please check your email and login to website with new password.",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const resetPassword = async (req, res) => {
  const { email, newPassword, confirmPassword } = req.body;
  try {
    const user = await UserModel.findOne({ email: email });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
    }
    if (newPassword !== confirmPassword) {
      return res.status(401).json({
        success: false,
        message: "The password doesn't match. Please re-enter password",
      });
    }
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    return res
      .status(200)
      .json({ success: true, message: "Reset password successful" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAvailableFriends = async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await UserModel.findById(userId).populate({
      path: "contacts",
      select: "_id status username avatar",
    });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Lọc ra các contacts có status là "available"
    const availableFriends = user.contacts.filter(
      (contact) => contact.status === "available",
    );

    return res.status(200).json({
      success: true,
      message: "Get available friends success",
      data: availableFriends,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error?.message });
  }
};

export const getReceiverFriend = async (req, res) => {
  const userId = req.user._id;
  const { receiverId } = req.params;

  try {
    const sender = await UserModel.findById(userId).select("_id contacts");
    if (!sender) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const isFriend = sender.contacts.some(
      (contactId) => contactId.toString() === receiverId,
    );
    if (!isFriend) {
      return res
        .status(403)
        .json({ success: false, message: "Receiver is not in contacts" });
    }

    const receiver = await UserModel.findById(receiverId);
    if (!receiver) {
      return res
        .status(404)
        .json({ success: false, message: "Receiver not found" });
    }

    const isBlockedByReceiver =
      Array.isArray(receiver.blockedUsers) &&
      receiver.blockedUsers.some((id) => id.toString() === userId.toString());

    // ✅ lấy files như trước
    const messagesWithFiles = await MessageModel.find({
      $or: [
        { senderId: userId, receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
      files: { $exists: true, $ne: [] },
    })
      .sort({ createdAt: -1 })
      .select("files senderId receiverId createdAt type")
      .populate("senderId", "_id username avatar")
      .populate("receiverId", "_id username avatar")
      .lean();

    const allFiles = messagesWithFiles.flatMap((msg) =>
      msg.files.map((f) => ({
        ...f,
        messageId: msg._id,
        sender: msg.senderId,
        createdAt: msg.createdAt,
        messageType: msg.type,
        isImage: msg.type === "image",
      })),
    );

    // ✅ lấy pinned messages
    const pinnedMessages = await MessageModel.find({
      $or: [
        { senderId: userId, receiverId },
        { senderId: receiverId, receiverId: userId },
      ],
      isPinned: true,
    })
      .sort({ updatedAt: -1 }) // mới pin sẽ hiện trên đầu
      .select("_id content senderId receiverId createdAt updatedAt isPinned")
      .populate("senderId", "_id username avatar")
      .populate("receiverId", "_id username avatar")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Get success",
      data: {
        receiver,
        isBlockedByReceiver,
        files: allFiles,
        pinnedMessages: pinnedMessages.map((msg) => ({
          _id: msg._id,
          content: msg.content, // nội dung message
          pinnedBy: msg.senderId, // người pin
          pinnedAt: msg.updatedAt, // khi pin/unpin (dùng updatedAt)
        })),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCodeFromUser = async (req, res) => {
  const userId = req.user._id; // user đang login
  const { receiverId } = req.params; // id của user cần lấy code

  try {
    // Kiểm tra user đang login có tồn tại không
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Lấy thông tin người nhận
    const receiver = await UserModel.findById(receiverId).select("code");
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Get code successfully",
      data: receiver.code,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const blockUser = async (req, res) => {
  const userId = req.user._id; // user hiện tại (người block)
  const { receiverId } = req.params; // người bị block

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const receiver = await UserModel.findById(receiverId);
    if (!receiver) {
      return res
        .status(404)
        .json({ success: false, message: "Receiver not found" });
    }

    const isBlocked = user.blockedUsers.includes(receiverId);

    if (isBlocked) {
      // gỡ block
      user.blockedUsers = user.blockedUsers.filter(
        (id) => id.toString() !== receiverId,
      );
      await user.save();

      // Emit socket cho receiver biết đã được unblock
      const io = req.app.get("io");
      emitUnBlockedByUser(io, receiverId.toString(), { userId });

      return res.status(200).json({
        success: true,
        blocked: false,
        message: "User unblocked successfully",
      });
    } else {
      // block user
      user.blockedUsers.push(receiverId);
      await user.save();

      // Emit socket cho receiver biết bị block
      const io = req.app.get("io");
      emitBlockedByUser(io, receiverId, { userId });

      return res.status(200).json({
        success: true,
        blocked: true,
        message: "User blocked successfully",
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

// Toggle 2FA (Enable/Disable)
export const toggle2FA = async (req, res) => {
  const userId = req.user._id;
  const { enable } = req.body; // true = enable, false = disable

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (enable) {
      user.is2FAEnabled = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Two-Factor Authentication enabled successfully",
        data: user,
      });
    } else {
      user.is2FAEnabled = false;
      user.tempOTP = undefined;
      user.otpExpiresAt = undefined;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Two-Factor Authentication disabled successfully",
        data: user,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Toggle Device Verification (Enable/Disable)
export const toggleDeviceVerification = async (req, res) => {
  const userId = req.user._id;
  const { enable } = req.body; // true = enable, false = disable

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (enable) {
      user.isDeviceVerificationEnabled = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Device Verification enabled successfully",
        data: user,
      });
    } else {
      user.isDeviceVerificationEnabled = false;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Device Verification disabled successfully",
        data: user,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Toggle Login Alerts (Enable/Disable)
export const toggleLoginAlert = async (req, res) => {
  const userId = req.user._id;
  const { enable } = req.body; // true = enable, false = disable

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (enable) {
      user.isLoginAlertEnabled = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Login Alerts enabled successfully",
        data: user,
      });
    } else {
      user.isLoginAlertEnabled = false;
      await user.save();

      return res.status(200).json({
        success: true,
        message: "Login Alerts disabled successfully",
        data: user,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const exportUsers = async (req, res) => {
  try {
    const users = await UserModel.find({}).sort({ createdAt: -1 });

    const fields = [
      "_id",
      "username",
      "email",
      "role",
      "status",
      "createdAt",
      "lastSeenAt",
    ];
    const opts = { fields };

    // Simple CSV conversion
    let csv = fields.join(",") + "\n";
    users.forEach((user) => {
      const row = fields.map((field) => {
        let val = user[field] || "";
        if (val instanceof Date) val = val.toISOString();
        return JSON.stringify(val);
      });
      csv += row.join(",") + "\n";
    });

    res.header("Content-Type", "text/csv");
    res.attachment("users.csv");
    return res.send(csv);
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

import NotificationModel from "../models/NotificationModel.js";

export const searchUsers = async (req, res) => {
  const { keyword } = req.query;
  const userId = req.user._id;
  try {
    const me = await UserModel.findById(userId).select("contacts");
    const myFriends = me.contacts.map((id) => id.toString());

    const query = {
      _id: { $ne: userId },
    };
    if (keyword) {
      query.$or = [
        { username: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
      ];
    }

    const users = await UserModel.find(query)
      .select("_id username email avatar code")
      .limit(10)
      .lean();

    // Check relationship status for each user
    const data = await Promise.all(
      users.map(async (user) => {
        const isFriend = myFriends.includes(user._id.toString());
        let isPending = false;

        if (!isFriend) {
          const pendingRequest = await NotificationModel.findOne({
            sender: userId,
            receiver: user._id,
            type: "friend_request",
          });
          isPending = !!pendingRequest;
        }

        return {
          ...user,
          isFriend,
          isPending,
        };
      }),
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const searchUsersAdmin = async (req, res) => {
  const { keyword } = req.query;
  try {
    const query = {};
    if (keyword) {
      query.$or = [
        { username: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
      ];
    }

    const users = await UserModel.find(query)
      .select("-password") // exclude password
      .limit(20);

    return res.status(200).json({
      success: true,
      data: users,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Get detailed user info for Admin Drawer
export const getUserDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findById(id).select("-password").lean();

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Parallel fetch for stats
    const [friendsCount, reportsCount] = await Promise.all([
      // Assuming friends are stored in contacts with status 'available' or just array length
      // Simplified: adjust based on actual schema logic if needed
      Promise.resolve(user.contacts ? user.contacts.length : 0),
      // Placeholder for Reports count until ReportModel is ready
      Promise.resolve(0),
    ]);

    // Enhance user object with stats
    const userDetails = {
      ...user,
      stats: {
        friends: friendsCount,
        reports: reportsCount,
      },
    };

    return res.status(200).json({
      success: true,
      data: userDetails,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Send Warning Notification
export const sendUserWarning = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const adminId = req.user._id;

    if (!message) {
      return res
        .status(400)
        .json({ success: false, message: "Warning message is required" });
    }

    const user = await UserModel.findById(id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // 1. Create Notification Record (Assuming NotificationModel exists)
    // const notification = await NotificationModel.create({
    //   senderId: adminId,
    //   receiverId: id,
    //   type: "system_warning",
    //   content: message,
    // });

    // 2. Emit Socket Event
    const io = req.app.get("io");
    if (io) {
      // Assuming there's a standard event for notifications
      // io.to(id).emit("new_notification", notification);

      // Also emit a specific warning event if needed for immediate UI alert
      io.to(id).emit("admin_warning", {
        message,
        timestamp: new Date(),
      });
    }

    return res.status(200).json({
      success: true,
      message: "Warning sent successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// --- Admin CRUD ---
export const getUsers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search, status, role } = req.query;
    const skip = (page - 1) * limit;

    const query = {};
    if (search) {
      query.$or = [
        { username: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    if (status) query.status = status;
    if (role) query.role = role;

    const users = await UserModel.find(query)
      .select("-password")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await UserModel.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createUser = async (req, res) => {
  try {
    const { username, email, password, role, avatar, location, slogan } =
      req.body;

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ success: false, message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const code = await generateUniqueCode();

    const newUser = await UserModel.create({
      username,
      email,
      password: hashedPassword,
      code,
      role: role || "user",
      avatar:
        avatar ||
        "https://res.cloudinary.com/dfoj60kx8/image/upload/v1715694760/social-network/avatar-default.png",
      location,
      slogan,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: newUser,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      username,
      email,
      password,
      role,
      status,
      avatar,
      location,
      slogan,
    } = req.body;

    const updateData = {
      username,
      email,
      role,
      status,
      avatar,
      location,
      slogan,
    };

    // Only update password if provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await UserModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: user,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await UserModel.findByIdAndDelete(id);

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
// Update FCM Token
export const updateFCMToken = async (req, res) => {
  const userId = req.user._id;
  const { fcmToken } = req.body;

  if (!fcmToken) {
    return res
      .status(400)
      .json({ success: false, message: "FCM Token is required" });
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Add token if not exists
    if (!user.fcmTokens.includes(fcmToken)) {
      user.fcmTokens.push(fcmToken);
      await user.save();
    }

    return res
      .status(200)
      .json({ success: true, message: "FCM Token updated successfully" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
