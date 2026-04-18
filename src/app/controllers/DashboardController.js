import UserModel from "../models/UserModel.js";
import MessageModel from "../models/MessageModel.js";

export const getStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const lastMonth = new Date(today);
    lastMonth.setDate(lastMonth.getDate() - 30);

    const [
      totalUsers,
      newUsersToday,
      activeUsersToday,
      totalMessages,
      messagesToday,
      messagesChart,
      recentNewUsers,
      recentActiveUsers,
      userStatus,
    ] = await Promise.all([
      // 1. Total Users
      UserModel.countDocuments({}),

      // 2. New Users Today
      UserModel.countDocuments({
        createdAt: { $gte: today },
      }),

      // 3. Active Users (Login within last 24h)
      UserModel.countDocuments({
        lastSeenAt: { $gte: yesterday },
      }),

      // 4. Total Messages
      MessageModel.countDocuments({}),

      // 5. Messages Today
      MessageModel.countDocuments({
        createdAt: { $gte: today },
      }),

      // 6. Messages Chart (Last 7 days)
      MessageModel.aggregate([
        {
          $match: {
            createdAt: { $gte: lastWeek },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),

      // 7. Recent New Users
      UserModel.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .select("_id username email avatar createdAt"),

      // 8. Recent Active Users (Login)
      UserModel.find({ lastSeenAt: { $exists: true } })
        .sort({ lastSeenAt: -1 })
        .limit(5)
        .select("_id username email avatar lastSeenAt"),
      // 9. User Status Distribution
      UserModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Process Recent Activities
    const activities = [];

    // Add New Users
    recentNewUsers.forEach((user) => {
      activities.push({
        id: `new_${user._id}`,
        type: "user",
        title: "New user registered",
        description: `${user.username || user.email} joined the platform`,
        time: user.createdAt,
        icon: "RiUserAddLine",
        iconBg: "bg-green-100 dark:bg-green-900/30",
        iconColor: "text-green-600 dark:text-green-400",
      });
    });

    // Add Active Users
    recentActiveUsers.forEach((user) => {
      // Avoid adding duplicate activity if user just registered (created within same minute)
      const createdTime = new Date(user.createdAt).getTime();
      const lastSeenTime = new Date(user.lastSeenAt).getTime();

      // If login is significantly later than creation (> 5 mins), count it as separate activity
      if (lastSeenTime - createdTime > 5 * 60 * 1000) {
        activities.push({
          id: `active_${user._id}`,
          type: "security",
          title: "User Active",
          description: `${user.username || user.email} was active`,
          time: user.lastSeenAt,
          icon: "RiShieldCheckLine",
          iconBg: "bg-blue-100 dark:bg-blue-900/30",
          iconColor: "text-blue-600 dark:text-blue-400",
        });
      }
    });

    // Sort by time desc and take top 5
    const recentActivities = activities
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 5);

    // Fill missing days in chart with 0
    const filledChartData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split("T")[0];
      const found = messagesChart.find((item) => item._id === dateString);
      filledChartData.push({
        date: dateString,
        count: found ? found.count : 0,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          newToday: newUsersToday,
          activeToday: activeUsersToday,
        },
        userStatus,
        messages: {
          total: totalMessages,
          today: messagesToday,
          chart: filledChartData,
        },
        recentActivities,
      },
    });
  } catch (error) {
    next(error);
  }
};
