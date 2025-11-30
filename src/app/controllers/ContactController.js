import UserModel from '../models/UserModel.js';
import NotificationModel from '../models/NotificationModel.js';
import MessageModel from '../models/MessageModel.js';

import { emitAddedContact } from '../../utils/socket.js';

export const groupedContacts = (user) => {
  const groupedContacts = {};
  user.contacts.forEach((contact) => {
    const letter = contact.username.charAt(0).toUpperCase();
    if (!groupedContacts[letter]) {
      groupedContacts[letter] = [];
    }
    groupedContacts[letter].push({
      _id: contact._id,
      username: contact.username,
    });
  });

  const result = Object.keys(groupedContacts)
    .sort()
    .map((letter) => ({
      contactLetter: letter,
      contactList: groupedContacts[letter],
    }));
  return result;
};

export const getContacts = async (req, res) => {
  const userId = req.user._id;
  try {
    const user = await UserModel.findById(userId).populate('contacts', '_id username');
    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const result = groupedContacts(user);

    return res.status(200).json({
      success: true,
      message: 'Get contacts successful',
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addContact = async (req, res) => {
  const userId = req.user._id;
  const { email, username, code } = req.body; // lấy cả code từ body
  try {
    // Lấy thông tin người gửi
    const sender = await UserModel.findById(userId);
    if (!sender) {
      return res.status(401).json({
        success: false,
        message: "You're not authenticated",
      });
    }

    // Xác định người nhận theo code hoặc theo email + username
    let receiver;
    if (code) {
      receiver = await UserModel.findOne({ code });
    } else if (email && username) {
      receiver = await UserModel.findOne({ email, username });
    }

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Invalid email/username or code',
      });
    }

    // Không cho tự add chính mình
    if (receiver._id.toString() === sender._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot add yourself as a contact',
      });
    }

    // Đã là bạn bè chưa?
    if (sender.contacts.includes(receiver._id)) {
      return res.status(400).json({
        success: false,
        message: 'This user is already in your contacts.',
      });
    }

    // Kiểm tra đã gửi yêu cầu trước đó chưa
    const existingRequest = await NotificationModel.findOne({
      sender: sender._id,
      receiver: receiver._id,
      type: 'friend_request',
      isRead: false,
    });

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'Friend request already sent.',
      });
    }

    // Tạo notification mới
    const notification = new NotificationModel({
      sender: sender._id,
      receiver: receiver._id,
      type: 'friend_request',
    });
    await notification.save();

    // Lưu reference notification vào receiver
    await UserModel.findByIdAndUpdate(receiver._id, {
      $push: { notifications: notification._id },
    });

    // Emit socket tới receiver
    const io = req.app.get('io');
    emitAddedContact(io, receiver._id, {
      _id: notification._id,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      sender: {
        _id: sender._id,
        username: sender.username,
        avatar: sender.avatar,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Friend request sent successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const responseContact = async (req, res) => {
  const userId = req.user._id; // receiver
  const { senderId, status, notificationId } = req.body;

  try {
    // 1. Kiểm tra receiver tồn tại
    const receiver = await UserModel.findById(userId);
    if (!receiver) {
      return res.status(401).json({
        success: false,
        message: "You're not authenticated",
      });
    }

    // 2. Kiểm tra sender tồn tại
    const sender = await UserModel.findById(senderId);
    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender not found',
      });
    }

    // 3. Tìm notification friend_request cho user hiện tại
    const notification = await NotificationModel.findById(notificationId);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Friend request notification not found',
      });
    }

    // 4. Nếu accept thì thêm vào contacts
    if (status === 'success') {
      await UserModel.findByIdAndUpdate(senderId, {
        $addToSet: { contacts: userId },
      });
      await UserModel.findByIdAndUpdate(userId, {
        $addToSet: { contacts: senderId },
      });

      const io = req.app.get('io');
      io.to(senderId.toString()).emit('contactAccepted');
    }

    // 5. Xóa notification khỏi NotificationModel và User.notifications
    await NotificationModel.findByIdAndDelete(notificationId);

    await UserModel.findByIdAndUpdate(userId, {
      $pull: { notifications: notification._id },
    });

    return res.status(200).json({
      success: true,
      message: `Contact request has been ${status === 'success' ? 'accepted' : 'denied'}`,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const searchContacts = async (req, res) => {
  const userId = req.user._id;
  const { keyword } = req.query; // FE gửi ?keyword=abc
  try {
    const user = await UserModel.findById(userId).populate({
      path: 'contacts',
      match: { username: { $regex: keyword, $options: 'i' } }, // Tìm không phân biệt hoa thường
      select: '_id username',
    });

    if (!user) {
      return res.status(400).json({ success: false, message: 'User not found' });
    }

    const groupedContacts = {};
    user.contacts.forEach((contact) => {
      const letter = contact.username.charAt(0).toUpperCase();
      if (!groupedContacts[letter]) {
        groupedContacts[letter] = [];
      }
      groupedContacts[letter].push({
        _id: contact._id,
        username: contact.username,
      });
    });

    const result = Object.keys(groupedContacts)
      .sort()
      .map((letter) => ({
        contactLetter: letter,
        contactList: groupedContacts[letter],
      }));

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// DELETE /contacts/:contactId
export const deleteContact = async (req, res) => {
  const userId = req.user._id;
  const { contactId } = req.params;

  try {
    // Kiểm tra người dùng tồn tại
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Kiểm tra contact tồn tại
    const contact = await UserModel.findById(contactId);
    if (!contact) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found',
      });
    }

    // Xóa contact ở cả hai phía
    await UserModel.findByIdAndUpdate(userId, {
      $pull: { contacts: contactId },
    });
    await UserModel.findByIdAndUpdate(contactId, {
      $pull: { contacts: userId },
    });

    // Xóa tất cả tin nhắn giữa hai user (2 chiều)
    await MessageModel.deleteMany({
      $or: [
        { senderId: userId, receiverId: contactId },
        { senderId: contactId, receiverId: userId },
      ],
    });

    const io = req.app.get('io');
    io.to(contactId.toString()).emit('contactDeleted');

    const updatedUser = await UserModel.findById(userId).populate('contacts', '_id username');

    const result = groupedContacts(updatedUser);

    return res.status(200).json({
      success: true,
      message: 'Contact deleted successfully',
      data: result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
