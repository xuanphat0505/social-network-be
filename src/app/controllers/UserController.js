import UserModel from '../models/UserModel.js';
import MessageModel from '../models/MessageModel.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { sendMail } from '../../services/MailService.js';
import { getPasswordResetTemplate } from '../../services/TemplateEmail.js';
import {
  emitChangedStatus,
  emitFriendOnline,
  emitBlockedByUser,
  emitUnBlockedByUser,
} from '../../utils/socket.js';

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
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    return res.status(200).json({ success: true, message: 'Update info success', data: user });
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
      { new: true, runValidators: true }
    );
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found',
      });
    }
    const io = req.app.get('io');
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
        message: 'Please provide an avatar URL or upload an image',
      });
    }

    const user = await UserModel.findByIdAndUpdate(
      userId,
      { avatar: avatarUrl },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Avatar updated successfully',
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
        message: 'No account found for this email address. Please enter your email again',
      });
    }
    const randomPassword = crypto.randomBytes(16).toString('hex');
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    user.password = hashedPassword;
    await user.save();

    const html = getPasswordResetTemplate(randomPassword);
    sendMail(email, '🔑 Password Reset - Your new password', html);

    return res.status(200).json({
      success: true,
      message: 'Please check your email and login to website with new password.',
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
      return res.status(401).json({ success: false, message: 'User not found' });
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

    return res.status(200).json({ success: true, message: 'Reset password successful' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getAvailableFriends = async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await UserModel.findById(userId).populate({
      path: 'contacts',
      select: '_id status username avatar',
    });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Lọc ra các contacts có status là "available"
    const availableFriends = user.contacts.filter((contact) => contact.status === 'available');

    return res.status(200).json({
      success: true,
      message: 'Get available friends success',
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
    const sender = await UserModel.findById(userId).select('_id contacts');
    if (!sender) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isFriend = sender.contacts.some((contactId) => contactId.toString() === receiverId);
    if (!isFriend) {
      return res.status(403).json({ success: false, message: 'Receiver is not in contacts' });
    }

    const receiver = await UserModel.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
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
      .select('files senderId receiverId createdAt type')
      .populate('senderId', '_id username avatar')
      .populate('receiverId', '_id username avatar')
      .lean();

    const allFiles = messagesWithFiles.flatMap((msg) =>
      msg.files.map((f) => ({
        ...f,
        messageId: msg._id,
        sender: msg.senderId,
        createdAt: msg.createdAt,
        messageType: msg.type,
        isImage: msg.type === 'image',
      }))
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
      .select('_id content senderId receiverId createdAt updatedAt isPinned')
      .populate('senderId', '_id username avatar')
      .populate('receiverId', '_id username avatar')
      .lean();

    return res.status(200).json({
      success: true,
      message: 'Get success',
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
        message: 'User not found',
      });
    }

    // Lấy thông tin người nhận
    const receiver = await UserModel.findById(receiverId).select('code');
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Get code successfully',
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
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const receiver = await UserModel.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ success: false, message: 'Receiver not found' });
    }

    const isBlocked = user.blockedUsers.includes(receiverId);

    if (isBlocked) {
      // gỡ block
      user.blockedUsers = user.blockedUsers.filter((id) => id.toString() !== receiverId);
      await user.save();

      // Emit socket cho receiver biết đã được unblock
      const io = req.app.get('io');
      emitUnBlockedByUser(io, receiverId.toString(), { userId });

      return res.status(200).json({
        success: true,
        blocked: false,
        message: 'User unblocked successfully',
      });
    } else {
      // block user
      user.blockedUsers.push(receiverId);
      await user.save();

      // Emit socket cho receiver biết bị block
      const io = req.app.get('io');
      emitBlockedByUser(io, receiverId, { userId });

      return res.status(200).json({
        success: true,
        blocked: true,
        message: 'User blocked successfully',
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Server error',
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
        message: 'User not found',
      });
    }

    if (enable) {
      user.is2FAEnabled = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Two-Factor Authentication enabled successfully',
        data: user,
      });
    } else {
      user.is2FAEnabled = false;
      user.tempOTP = undefined;
      user.otpExpiresAt = undefined;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Two-Factor Authentication disabled successfully',
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
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (enable) {
      user.isDeviceVerificationEnabled = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Device Verification enabled successfully',
        data: user,
      });
    } else {
      user.isDeviceVerificationEnabled = false;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Device Verification disabled successfully',
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
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (enable) {
      user.isLoginAlertEnabled = true;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Login Alerts enabled successfully',
        data: user,
      });
    } else {
      user.isLoginAlertEnabled = false;
      await user.save();

      return res.status(200).json({
        success: true,
        message: 'Login Alerts disabled successfully',
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
