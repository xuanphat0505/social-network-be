import UserModel from "../models/UserModel.js";

/**
 * Get User Preferences
 * @route GET /api/v1/user/preferences
 */
export const getPreferences = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await UserModel.findById(userId).select(
      "preferences is2FAEnabled",
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Return preferences or defaults
    const preferences = {
      emailNotifications:
        user.preferences?.emailNotifications !== undefined
          ? user.preferences.emailNotifications
          : true,
      pushNotifications:
        user.preferences?.pushNotifications !== undefined
          ? user.preferences.pushNotifications
          : true,
      is2FAEnabled: user.is2FAEnabled || false,
    };

    return res.status(200).json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error("Get preferences error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update User Preferences
 * @route PUT /api/v1/user/preferences
 */
export const updatePreferences = async (req, res) => {
  try {
    const userId = req.user._id;
    const { emailNotifications, pushNotifications } = req.body;

    const user = await UserModel.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Initialize preferences if not exists
    if (!user.preferences) {
      user.preferences = {};
    }

    // Update preferences
    if (emailNotifications !== undefined) {
      user.preferences.emailNotifications = emailNotifications;
    }
    if (pushNotifications !== undefined) {
      user.preferences.pushNotifications = pushNotifications;
    }

    // Mark as modified for nested object
    user.markModified("preferences");
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Preferences updated successfully",
      data: user.preferences,
    });
  } catch (error) {
    console.error("Update preferences error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
