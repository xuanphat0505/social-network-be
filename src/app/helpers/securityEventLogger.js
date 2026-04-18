import SecurityEventModel from "../models/SecurityEventModel.js";

/**
 * Log a security event
 * @param {Object} eventData - Event data
 * @param {string} eventData.eventType - Type of security event
 * @param {string} eventData.userId - User ID (optional)
 * @param {string} eventData.email - Email (optional, for failed logins)
 * @param {string} eventData.ipAddress - IP address
 * @param {string} eventData.userAgent - User agent string
 * @param {Object} eventData.location - Geographic location data
 * @param {string} eventData.severity - Severity level (info/warning/critical)
 * @param {Object} eventData.metadata - Additional metadata
 * @param {boolean} eventData.success - Whether the event was successful
 */
export const logSecurityEvent = async (eventData) => {
  try {
    const event = new SecurityEventModel({
      eventType: eventData.eventType,
      userId: eventData.userId || null,
      email: eventData.email || null,
      ipAddress: eventData.ipAddress,
      userAgent: eventData.userAgent || null,
      location: eventData.location || {},
      severity: eventData.severity || "info",
      metadata: eventData.metadata || {},
      success: eventData.success !== undefined ? eventData.success : true,
    });

    await event.save();
    return event;
  } catch (error) {
    console.error("Error logging security event:", error);
    // Don't throw - we don't want security logging to break the main flow
    return null;
  }
};

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
export const getClientIP = (req) => {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.headers["x-real-ip"] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    "unknown"
  );
};

/**
 * Get basic location from IP (placeholder - in production, use a geolocation service)
 * @param {string} ipAddress - IP address
 * @returns {Object} Location data
 */
export const getLocationFromIP = async (ipAddress) => {
  // TODO: Integrate with a geolocation service like ipapi.co or MaxMind
  // For now, return basic structure
  return {
    country: "Unknown",
    city: "Unknown",
    coordinates: {
      lat: null,
      lon: null,
    },
  };
};

/**
 * Determine event severity based on event type
 * @param {string} eventType - Event type
 * @param {boolean} success - Whether the event was successful
 * @returns {string} Severity level
 */
export const getEventSeverity = (eventType, success) => {
  if (!success) {
    return "warning";
  }

  const criticalEvents = [
    "account_locked",
    "suspicious_activity",
    "permission_changed",
  ];

  if (criticalEvents.includes(eventType)) {
    return "critical";
  }

  return "info";
};
