import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema(
  {
    originalName: { type: String },
    fileUrl: { type: String },
    type: { type: String, enum: ['image', 'file'] },
    sizeMB: { type: Number },
  },
  { _id: false }
);

const emojiSchema = new mongoose.Schema(
  {
    icon: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
  },
  { _id: false }
);

const callDataSchema = new mongoose.Schema(
  {
    isVideo: { type: Boolean, default: false },
    status: { type: String, enum: ['missed', 'ended'], default: 'ended' },
    duration: { type: Number, default: 0 }, // seconds
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true },
    type: { type: String, enum: ['text', 'image', 'file', 'call'], default: 'text' },
    content: { type: String }, // đã mã hóa
    files: [fileSchema],
    callData: callDataSchema,
    isRead: { type: Boolean, default: false },
    isRevoked: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],
    deletedPermanentlyBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'users' }],
    emoji: [emojiSchema],
  },
  {
    timestamps: true, // tự động tạo createdAt, updatedAt
  }
);
const MessageModel = mongoose.model('messages', messageSchema);

export default MessageModel;
