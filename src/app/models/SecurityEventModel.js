import mongoose from "mongoose";

const securityEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      enum: [
        "login_success",
        "login_failed",
        "logout",
        "password_changed",
        "password_reset_requested",
        "password_reset_completed",
        "two_factor_enabled",
        "two_factor_disabled",
        "api_key_generated",
        "api_key_revoked",
        "permission_changed",
        "account_locked",
        "account_unlocked",
        "suspicious_activity",
      ],
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "users", // Must match model name in UserModel.js line 105
      default: null, // Can be null for failed login attempts from unknown users
    },
    email: {
      type: String,
      default: null, // Store email for failed attempts
    },
    ipAddress: {
      type: String,
      required: true,
    },
    userAgent: {
      type: String,
      default: null,
    },
    location: {
      country: { type: String, default: null },
      city: { type: String, default: null },
      coordinates: {
        lat: { type: Number, default: null },
        lon: { type: Number, default: null },
      },
    },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    success: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  },
);

// Indexes for efficient querying
securityEventSchema.index({ createdAt: -1 }); // Recent events first
securityEventSchema.index({ userId: 1, createdAt: -1 }); // User event history
securityEventSchema.index({ eventType: 1, createdAt: -1 }); // Events by type
securityEventSchema.index({ ipAddress: 1 }); // IP-based queries
securityEventSchema.index({ success: 1, createdAt: -1 }); // Failed events

const SecurityEventModel = mongoose.model("SecurityEvent", securityEventSchema);

export default SecurityEventModel;
