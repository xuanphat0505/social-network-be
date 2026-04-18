import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users",
      required: true,
    },
    type: {
      type: String,
      enum: ["friend_request", "missed_call", "system"],
      required: true,
    },
    title: {
      type: String,
    },
    content: {
      type: String,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    isVideo: {
      type: Boolean,
    },
  },
  { timestamps: true },
);

const NotificationModel = mongoose.model("notifications", NotificationSchema);

export default NotificationModel;
