import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true, // tạo index để tìm nhanh bằng code
    },
    location: {
      type: String,
      default: "-",
    },
    slogan: {
      type: String,
      default: "Say something about yourself 👋",
    },
    avatar: {
      type: String,
      default:
        "https://res.cloudinary.com/drngsxvb3/image/upload/q_auto/f_auto/v1776490861/user_rnttki.png",
    },
    contacts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],

    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "users",
      },
    ],
    notifications: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "notifications",
      },
    ],
    status: {
      type: String,
      enum: ["available", "busy", "invisible", "offline"],
      default: "available",
    },
    lastSeenAt: {
      type: Date,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    is2FAEnabled: {
      type: Boolean,
      default: false,
    },
    tempOTP: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    isDeviceVerificationEnabled: {
      type: Boolean,
      default: false,
    },
    isLoginAlertEnabled: {
      type: Boolean,
      default: false,
    },
    trustedDevices: [
      {
        type: String,
      },
    ],
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      pushNotifications: { type: Boolean, default: true },
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "user",
    },
    fcmTokens: [
      {
        type: String,
      },
    ],
  },

  { timestamps: true },
);

UserSchema.index({ status: 1 });
UserSchema.index({ lastSeenAt: -1 });

const UserModel = mongoose.model("users", UserSchema);

export default UserModel;
