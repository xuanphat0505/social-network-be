import SecurityEventModel from "../models/SecurityEventModel.js";

/**
 * Get failed login trends over time
 * @route GET /api/admin/security/analytics/failed-login-trends
 */
export const getFailedLoginTrends = async (req, res) => {
  try {
    const { timeRange = "7d" } = req.query;

    // Calculate time range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Aggregate failed login events
    const trends = await SecurityEventModel.aggregate([
      {
        $match: {
          eventType: "login_failed",
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      success: true,
      data: trends.map((t) => ({
        date: t._id,
        count: t.count,
      })),
    });
  } catch (error) {
    console.error("Error fetching failed login trends:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get geographic distribution of login attempts
 * @route GET /api/admin/security/analytics/geographic-distribution
 */
export const getGeographicDistribution = async (req, res) => {
  try {
    const { timeRange = "7d" } = req.query;

    // Calculate time range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Aggregate by country
    const distribution = await SecurityEventModel.aggregate([
      {
        $match: {
          eventType: { $in: ["login_success", "login_failed"] },
          createdAt: { $gte: startDate },
          "location.country": { $exists: true, $ne: null, $ne: "Unknown" },
        },
      },
      {
        $group: {
          _id: "$location.country",
          loginAttempts: { $sum: 1 },
          successfulLogins: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "login_success"] }, 1, 0],
            },
          },
          failedLogins: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "login_failed"] }, 1, 0],
            },
          },
        },
      },
      { $sort: { loginAttempts: -1 } },
      { $limit: 20 }, // Top 20 countries
    ]);

    return res.status(200).json({
      success: true,
      data: distribution.map((d) => ({
        country: d._id,
        loginAttempts: d.loginAttempts,
        successfulLogins: d.successfulLogins,
        failedLogins: d.failedLogins,
      })),
    });
  } catch (error) {
    console.error("Error fetching geographic distribution:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get top IP addresses by activity
 * @route GET /api/admin/security/analytics/top-ips
 */
export const getTopIPAddresses = async (req, res) => {
  try {
    const { timeRange = "7d", limit = 10 } = req.query;

    // Calculate time range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Aggregate by IP address
    const topIPs = await SecurityEventModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: "$ipAddress",
          totalEvents: { $sum: 1 },
          failedLogins: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "login_failed"] }, 1, 0],
            },
          },
          successfulLogins: {
            $sum: {
              $cond: [{ $eq: ["$eventType", "login_success"] }, 1, 0],
            },
          },
          lastActivity: { $max: "$createdAt" },
        },
      },
      { $sort: { totalEvents: -1 } },
      { $limit: parseInt(limit) },
    ]);

    return res.status(200).json({
      success: true,
      data: topIPs.map((ip) => ({
        ipAddress: ip._id,
        totalEvents: ip.totalEvents,
        failedLogins: ip.failedLogins,
        successfulLogins: ip.successfulLogins,
        lastActivity: ip.lastActivity,
      })),
    });
  } catch (error) {
    console.error("Error fetching top IP addresses:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get recent security events
 * @route GET /api/admin/security/analytics/recent-events
 */
export const getRecentSecurityEvents = async (req, res) => {
  try {
    const { page = 1, limit = 20, eventType, severity } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build match query
    const matchQuery = {};
    if (eventType) {
      const types = eventType
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      matchQuery.eventType = types.length === 1 ? types[0] : { $in: types };
    }
    if (severity) {
      matchQuery.severity = severity;
    }

    // Get events with user details
    const events = await SecurityEventModel.find(matchQuery)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("userId", "username email avatar")
      .lean();

    const total = await SecurityEventModel.countDocuments(matchQuery);

    return res.status(200).json({
      success: true,
      data: events,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching recent security events:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get security overview stats
 * @route GET /api/admin/security/analytics/overview
 */
export const getSecurityOverview = async (req, res) => {
  try {
    const { timeRange = "24h" } = req.query;

    // Calculate time range
    const now = new Date();
    let startDate;
    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get aggregated statistics
    const stats = await SecurityEventModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $facet: {
          totalEvents: [{ $count: "count" }],
          failedLogins: [
            { $match: { eventType: "login_failed" } },
            { $count: "count" },
          ],
          successfulLogins: [
            { $match: { eventType: "login_success" } },
            { $count: "count" },
          ],
          criticalEvents: [
            { $match: { severity: "critical" } },
            { $count: "count" },
          ],
          uniqueIPs: [{ $group: { _id: "$ipAddress" } }, { $count: "count" }],
        },
      },
    ]);

    const result = stats[0];

    return res.status(200).json({
      success: true,
      data: {
        totalEvents: result.totalEvents[0]?.count || 0,
        failedLogins: result.failedLogins[0]?.count || 0,
        successfulLogins: result.successfulLogins[0]?.count || 0,
        criticalEvents: result.criticalEvents[0]?.count || 0,
        uniqueIPs: result.uniqueIPs[0]?.count || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching security overview:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
