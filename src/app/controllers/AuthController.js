import UserModel from "../models/UserModel.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { sendMail } from "../../services/MailService.js";
import {
  getLoginAlertTemplate,
  getOTPTemplate,
} from "../../services/TemplateEmail.js";
import {
  logSecurityEvent,
  getClientIP,
  getLocationFromIP,
  getEventSeverity,
} from "../helpers/securityEventLogger.js";
import { generateUniqueCode } from "../helpers/generateCode.js";

const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
};

const generateAccessToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      role: user.role,
    },
    process.env.JWT_ACCESSTOKEN_KEY,
    {
      expiresIn: "1d",
    },
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    {
      _id: user._id,
      role: user.role,
    },
    process.env.JWT_REFRESHTOKEN_KEY,
    {
      expiresIn: "365d",
    },
  );
};

// Helper: send login alert email (fire-and-forget)
const sendLoginAlertEmail = (req, toEmail) => {
  const userAgent = req.headers["user-agent"] || "Unknown device";
  const ipAddress = (req.headers["x-forwarded-for"] || req.ip || "").toString();
  const loginTime = new Date().toLocaleString();
  const html = getLoginAlertTemplate(loginTime, ipAddress, userAgent);
  sendMail(toEmail, "🔐 Login Alert - Your account was accessed", html).catch(
    () => {},
  );
};

export const register = async (req, res) => {
  const { email, password, username } = req.body;
  const salt = await bcrypt.genSalt(10);
  const hash = bcrypt.hashSync(password, salt);

  try {
    const user = await UserModel.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: "Email has been used",
      });
    }

    const code = await generateUniqueCode();

    const newUser = new UserModel({
      email,
      username,
      password: hash,
      code, // gán code vào user
    });

    await newUser.save();

    return res.status(200).json({
      success: true,
      message: "Register successfully",
      code: newUser.code, // trả về code để client có thể hiển thị
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const login = async (req, res) => {
  const { email, otp, deviceId } = req.body;
  try {
    const user = await UserModel.findOne({ email }).populate({
      path: "notifications",
      populate: [
        {
          path: "sender",
          select: "_id username avatar",
        },
      ],
    });
    if (!user) {
      // Log failed login attempt for non-existent user
      const ipAddress = getClientIP(req);
      const location = await getLocationFromIP(ipAddress);
      await logSecurityEvent({
        eventType: "login_failed",
        userId: null,
        email: req.body.email,
        ipAddress,
        userAgent: req.headers["user-agent"],
        location,
        severity: "warning",
        success: false,
        metadata: { reason: "User not found" },
      });

      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    const ismatch = await bcrypt.compare(req.body.password, user.password);
    if (!ismatch) {
      // Log failed login attempt
      const ipAddress = getClientIP(req);
      const location = await getLocationFromIP(ipAddress);
      await logSecurityEvent({
        eventType: "login_failed",
        userId: user._id,
        email: user.email,
        ipAddress,
        userAgent: req.headers["user-agent"],
        location,
        severity: "warning",
        success: false,
        metadata: { reason: "Invalid password" },
      });

      return res.status(400).json({
        success: false,
        message: "Password is incorrect",
      });
    }

    // Determine whether OTP is required due to 2FA or device verification
    const isDeviceVerificationOn = Boolean(user.isDeviceVerificationEnabled);
    const hasDeviceId =
      typeof deviceId === "string" && deviceId.trim().length > 0;
    const isTrustedDevice = hasDeviceId
      ? Array.isArray(user.trustedDevices) &&
        user.trustedDevices.includes(deviceId)
      : false;

    const requiresOTP =
      Boolean(user.is2FAEnabled) ||
      (isDeviceVerificationOn && (!hasDeviceId || !isTrustedDevice));

    if (requiresOTP) {
      // If OTP is not provided, send OTP and require verification
      if (!otp) {
        const otpCode = generateOTP();
        user.tempOTP = otpCode;
        user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
        await user.save();

        // Send OTP via email
        const html = getOTPTemplate(otpCode);

        // fire-and-forget: don't block response on email sending
        sendMail(user.email, "Your Login Verification Code", html).catch(
          (emailError) => {
            console.error("Failed to send OTP email:", emailError);
          },
        );

        return res.status(200).json({
          success: true,
          message: "Verification code sent to your email",
          requires2FA: true,
          email: user.email,
          expiresAt: user.otpExpiresAt,
        });
      }

      // Verify OTP
      if (!user.tempOTP || !user.otpExpiresAt) {
        return res.status(400).json({
          success: false,
          message: "No verification code found. Please request a new one.",
        });
      }

      if (new Date() > user.otpExpiresAt) {
        return res.status(400).json({
          success: false,
          message: "Verification code has expired. Please request a new one.",
        });
      }

      if (user.tempOTP !== otp) {
        return res.status(400).json({
          success: false,
          message: "Invalid verification code",
        });
      }

      // Clear OTP after successful verification
      user.tempOTP = undefined;
      user.otpExpiresAt = undefined;

      // Trust device if device verification is enabled and deviceId provided
      if (isDeviceVerificationOn && hasDeviceId) {
        user.trustedDevices = Array.isArray(user.trustedDevices)
          ? user.trustedDevices
          : [];
        if (!user.trustedDevices.includes(deviceId)) {
          user.trustedDevices.push(deviceId);
        }
      }
    }

    const firstLogin = user.isFirstLogin;

    if (firstLogin) {
      user.isFirstLogin = false;
    }

    await user.save();

    const {
      password: userPassword,
      tempOTP,
      otpExpiresAt,
      ...rest
    } = user._doc;
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // save refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, // Required for cross-site cookies
      sameSite: "none", // Required for cross-site cookies
      maxAge: 365 * 24 * 60 * 60 * 1000, // 365 ngày (ms) - Bắt buộc để cookie không bị mất khi reload trang
    });

    // Fire-and-forget login alert email
    if (user.isLoginAlertEnabled) {
      sendLoginAlertEmail(req, user.email);
    }

    // Log successful login
    const ipAddress = getClientIP(req);
    const location = await getLocationFromIP(ipAddress);
    await logSecurityEvent({
      eventType: "login_success",
      userId: user._id,
      email: user.email,
      ipAddress,
      userAgent: req.headers["user-agent"],
      location,
      severity: "info",
      success: true,
      metadata: { firstLogin },
    });

    return res.status(200).json({
      success: true,
      message: "Login successfully",
      data: { ...rest, accessToken, isFirstLogin: firstLogin },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const logout = async (req, res) => {
  const userId = req.user._id;
  try {
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 0, // Xoá cookie ngay lập tức khi logout
    });
    return res
      .status(200)
      .json({ success: true, message: "Logout successful" });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const refreshToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  try {
    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "You're not authenticated" });
    }
    jwt.verify(refreshToken, process.env.JWT_REFRESHTOKEN_KEY, (err, user) => {
      if (err) {
        return res
          .status(404)
          .json({ success: false, message: "Refreshtoken is invalid" });
      }
      const newAccessToken = generateAccessToken(user);
      const newRefreshToken = generateRefreshToken(user);
      res.cookie("refreshToken", newRefreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 365 * 24 * 60 * 60 * 1000, // 365 ngày (ms)
      });

      return res
        .status(200)
        .json({ success: true, accessToken: newAccessToken });
    });
  } catch (error) {
    return res.status(400).json({ success: true, message: error.message });
  }
};

// Check OTP and complete login (2FA verification step)
export const checkOTP = async (req, res) => {
  try {
    const { email, otp, deviceId } = req.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    const user = await UserModel.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (!user.tempOTP || !user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "No verification code found. Please request a new one.",
      });
    }
    if (new Date() > user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "Verification code has expired. Please request a new one.",
      });
    }
    if (user.tempOTP !== otp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid verification code" });
    }

    // Clear OTP after successful verification
    user.tempOTP = undefined;
    user.otpExpiresAt = undefined;

    // Trust device if device verification is enabled and deviceId provided
    if (
      user.isDeviceVerificationEnabled &&
      typeof deviceId === "string" &&
      deviceId.trim()
    ) {
      user.trustedDevices = Array.isArray(user.trustedDevices)
        ? user.trustedDevices
        : [];
      if (!user.trustedDevices.includes(deviceId)) {
        user.trustedDevices.push(deviceId);
      }
    }

    const firstLogin = user.isFirstLogin;
    if (firstLogin) {
      user.isFirstLogin = false;
    }
    await user.save();

    const {
      password: userPassword,
      tempOTP,
      otpExpiresAt,
      ...rest
    } = user._doc || {};
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    // save refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true, // Required for cross-site cookies
      sameSite: "none", // Required for cross-site cookies
      maxAge: 365 * 24 * 60 * 60 * 1000, // 365 ngày (ms)
    });

    // Fire-and-forget login alert email for 2FA completion as well
    if (user.isLoginAlertEnabled) {
      sendLoginAlertEmail(req, user.email);
    }
    return res.status(200).json({
      success: true,
      message: "Login successfully",
      data: { ...rest, accessToken, isFirstLogin: firstLogin },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Resend OTP for 2FA
export const resendOTP = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await UserModel.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.is2FAEnabled) {
      return res.status(400).json({
        success: false,
        message: "Two-Factor Authentication is not enabled for this account",
      });
    }

    const otpCode = generateOTP();
    user.tempOTP = otpCode;
    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    // Send OTP via email
    const html = getOTPTemplate(otpCode, true);

    await sendMail(user.email, "Your New Login Verification Code", html);

    return res.status(200).json({
      success: true,
      message: "New verification code sent to your email",
      expiresAt: user.otpExpiresAt,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Change Password
 * @route POST /api/v1/auth/changePassword
 */
export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user._id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Old password and new password are required",
      });
    }

    // Find user
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Verify old password
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Log security event
    const ipAddress = getClientIP(req);
    const location = await getLocationFromIP(ipAddress);

    await logSecurityEvent({
      eventType: "password_changed",
      userId: user._id,
      email: user.email,
      ipAddress,
      userAgent: req.headers["user-agent"],
      location,
      success: true,
    });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Enable 2FA - Generate OTP secret and QR code
 * @route POST /api/v1/auth/enable2FA
 */
export const enable2FA = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.is2FAEnabled) {
      return res.status(400).json({
        success: false,
        message: "2FA is already enabled",
      });
    }

    // Generate 6-digit OTP
    const otp = generateOTP();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save OTP temporarily
    user.tempOTP = otp;
    user.otpExpiresAt = otpExpiresAt;
    await user.save();

    // Send OTP via email
    const html = getOTPTemplate(otp);
    await sendMail(user.email, "🔐 Enable 2FA - Verification Code", html);

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email. Please verify to enable 2FA.",
      otpSentTo: user.email,
    });
  } catch (error) {
    console.error("Enable 2FA error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Verify 2FA OTP and enable 2FA
 * @route POST /api/v1/auth/verify2FA
 */
export const verify2FA = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.user._id;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Verification code is required",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if OTP exists and not expired
    if (!user.tempOTP || new Date() > user.otpExpiresAt) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    // Verify OTP
    if (user.tempOTP !== code) {
      return res.status(401).json({
        success: false,
        message: "Invalid verification code",
      });
    }

    // Enable 2FA
    user.is2FAEnabled = true;
    user.tempOTP = null;
    user.otpExpiresAt = null;
    await user.save();

    // Log security event
    const ipAddress = getClientIP(req);
    const location = await getLocationFromIP(ipAddress);

    await logSecurityEvent({
      eventType: "two_factor_enabled",
      userId: user._id,
      email: user.email,
      ipAddress,
      userAgent: req.headers["user-agent"],
      location,
      success: true,
    });

    return res.status(200).json({
      success: true,
      message: "2FA enabled successfully",
    });
  } catch (error) {
    console.error("Verify 2FA error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Disable 2FA
 * @route POST /api/v1/auth/disable2FA
 */
export const disable2FA = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (!user.is2FAEnabled) {
      return res.status(400).json({
        success: false,
        message: "2FA is not enabled",
      });
    }

    // Disable 2FA
    user.is2FAEnabled = false;
    user.tempOTP = null;
    user.otpExpiresAt = null;
    await user.save();

    // Log security event
    const ipAddress = getClientIP(req);
    const location = await getLocationFromIP(ipAddress);

    await logSecurityEvent({
      eventType: "two_factor_disabled",
      userId: user._id,
      email: user.email,
      ipAddress,
      userAgent: req.headers["user-agent"],
      location,
      success: true,
    });

    return res.status(200).json({
      success: true,
      message: "2FA disabled successfully",
    });
  } catch (error) {
    console.error("Disable 2FA error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
