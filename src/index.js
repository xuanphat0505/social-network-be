// import libraries
import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import mongoose from 'mongoose';
import { createServer } from 'http';
import { Server } from 'socket.io';

// import routes
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import healthRoutes from './routes/health.js';
import contactRoutes from './routes/contact.js';
import notificationRoutes from './routes/notifications.js';
import messageRoutes from './routes/message.js';

// Models
import NotificationModel from './app/models/NotificationModel.js';
import UserModel from './app/models/UserModel.js';

// SOCKET EVENTS
import { emitFriendOnline, emitChangedStatus } from './utils/socket.js';
dotenv.config();

const app = express();
const port = process.env.PORT || 5000;
const httpServer = createServer(app);

// websocket
const io = new Server(httpServer, {
  cors: {
    origin: true, // reflect request origin (supports ngrok)
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

const onlineUsers = new Map();

// Make io available to our routes
app.set('io', io);

// Socket connection handling
io.on('connection', (socket) => {
  socket.on('join', async (userId) => {
    console.log('User join room:', userId);
    if (!userId) return;

    socket.join(userId.toString());
    onlineUsers.set(userId.toString(), socket.id);

    // Cập nhật status = available mỗi lần user join
    let me = await UserModel.findByIdAndUpdate(
      userId,
      { status: 'available' },
      { new: true } // trả về document sau khi update
    )
      .select('_id username avatar status contacts')
      .lean();

    if (!me) return;

    // Gửi thông tin của mình cho toàn bộ bạn bè
    if (me.contacts && me.contacts.length > 0) {
      me.contacts.forEach((friendId) => {
        emitFriendOnline(io, friendId.toString(), me);
        emitChangedStatus(io, friendId.toString(), {
          userId: userId,
          status: me.status,
        });
      });
    }

    console.log('🟢 Online users:', Array.from(onlineUsers.entries()));
  });

  socket.on('typing', ({ senderId, receiverId }) => {
    socket.to(receiverId.toString()).emit('typing', { senderId });
  });

  socket.on('stopTyping', ({ senderId, receiverId }) => {
    socket.to(receiverId.toString()).emit('stopTyping', { senderId });
  });

  // khi user gọi điện
  socket.on('callUser', ({ to, from, signalData, type, isVideo }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('callUser', { from, signalData, type, isVideo });
      console.log(`📞 ${from._id} gọi ${to} (video=${isVideo})`);
    }
  });

  // khi user trả lời
  socket.on('answerCall', ({ to, signalData, type }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('answerCall', { signalData, type });
      console.log(`📡 answerCall gửi từ ${socket.id} tới ${to}`);
    }
  });

  // khi gửi ICE candidate
  socket.on('iceCandidate', ({ to, candidate }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('iceCandidate', { candidate });
      console.log('❄️ ICE gửi tới', to, candidate);
    }
  });

  socket.on('endCall', async ({ to, from, duration, isVideo }) => {
    const targetSocket = onlineUsers.get(to);
    if (targetSocket) {
      io.to(targetSocket).emit('callEnded');
    }

    // Lưu tin nhắn cuộc gọi vào database
    if (from && to && duration !== undefined) {
      try {
        const MessageModel = (await import('./app/models/MessageModel.js')).default;
        
        const callMessage = await MessageModel.create({
          senderId: from._id,
          receiverId: to,
          type: 'call',
          content: isVideo ? 'Video call' : 'Audio call',
          callData: {
            isVideo,
            status: 'ended',
            duration,
          },
        });

        // Populate sender info
        await callMessage.populate('senderId', '_id username avatar');
        await callMessage.populate('receiverId', '_id username avatar');

        // Gửi tin nhắn cuộc gọi cho cả 2 người
        const senderSocket = onlineUsers.get(from._id);
        const receiverSocket = onlineUsers.get(to);

        const messageData = {
          ...callMessage.toObject(),
          showAvatar: true,
        };

        if (senderSocket) {
          io.to(senderSocket).emit('sendMessage', messageData);
        }
        if (receiverSocket) {
          io.to(receiverSocket).emit('sendMessage', messageData);
        }

        console.log('📞 Đã lưu tin nhắn cuộc gọi:', callMessage._id);
      } catch (error) {
        console.error('❌ Lỗi lưu tin nhắn cuộc gọi:', error);
      }
    }
  });

  socket.on('missedCall', async ({ to, from, isVideo }) => {
    try {
      const MessageModel = (await import('./app/models/MessageModel.js')).default;

      // 1. Tạo tin nhắn cuộc gọi nhỡ
      const callMessage = await MessageModel.create({
        senderId: from._id,
        receiverId: to,
        type: 'call',
        content: isVideo ? 'Video call' : 'Audio call',
        callData: {
          isVideo,
          status: 'missed',
          duration: 0,
        },
      });

      await callMessage.populate('senderId', '_id username avatar');
      await callMessage.populate('receiverId', '_id username avatar');

      // 2. Tạo bản ghi notification
      const notification = await NotificationModel.create({
        sender: from._id,
        receiver: to,
        type: 'missed_call',
        isVideo,
      });

      console.log(`⏰ Cuộc gọi nhỡ từ ${from.username} tới userId=${to}`);

      // 3. Gửi tin nhắn cuộc gọi cho cả 2 người
      const senderSocket = onlineUsers.get(from._id);
      const receiverSocket = onlineUsers.get(to);

      const messageData = {
        ...callMessage.toObject(),
        showAvatar: true,
      };

      if (senderSocket) {
        io.to(senderSocket).emit('sendMessage', messageData);
      }
      if (receiverSocket) {
        io.to(receiverSocket).emit('sendMessage', messageData);
      }

      // 4. Gửi notification
      if (receiverSocket) {
        io.to(receiverSocket).emit('missedCallNotification', {
          _id: notification._id,
          sender: from,
          type: 'missed_call',
          createdAt: notification.createdAt,
          isVideo,
        });
      }
    } catch (error) {
      console.error('❌ Lỗi tạo notification missed_call:', error);
    }
  });

  // khi user disconnect
  socket.on('disconnect', async () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);

        // Cập nhật DB thành offline
        const me = await UserModel.findByIdAndUpdate(
          userId,
          { status: 'offline' },
          { new: true }
        ).select('_id username avatar status contacts');

        if (me) {
          // Gửi sự kiện thay đổi trạng thái cho tất cả bạn bè
          if (Array.isArray(me.contacts) && me.contacts.length > 0) {
            me.contacts.forEach((contactId) => {
              emitFriendOnline(io, contactId.toString(), me);
              emitChangedStatus(io, contactId.toString(), {
                userId: userId,
                status: 'offline',
              });
            });
          }
        }

        console.log('🔴 User disconnected:', userId);
        break;
      }
    }
  });
});

// database
mongoose.set('strictQuery', false);
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_CONNECTION);
    console.log('connect database successful');
  } catch (error) {
    console.log('connect database failed:', error.message);
  }
};

// middlewares
app.set('trust proxy', 1); // trust ngrok/reverse proxy for secure cookies
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(cookieParser());

// routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/user', userRoutes);
app.use('/api/v1/contacts', contactRoutes);
app.use('/api/v1/health-check', healthRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/messages', messageRoutes);

httpServer.listen(port, () => {
  connectDB();
  console.log(`connect sever successful at http://localhost:${port}`);
});
