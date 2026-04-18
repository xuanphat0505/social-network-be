import MessageModel from "../models/MessageModel.js";
import UserModel from "../models/UserModel.js";
import mongoose from "mongoose";

export const getConversationMetrics = async (req, res) => {
  try {
    // Calculate metrics for last 24 hours
    const last24Hours = new Date();
    last24Hours.setHours(last24Hours.getHours() - 24);

    // Aggregate conversation data
    const metrics = await MessageModel.aggregate([
      {
        $facet: {
          // Active conversations in last 24h
          activeConversations: [
            { $match: { createdAt: { $gte: last24Hours } } },
            {
              $group: {
                _id: {
                  user1: { $min: ["$senderId", "$receiverId"] },
                  user2: { $max: ["$senderId", "$receiverId"] },
                },
              },
            },
            { $count: "count" },
          ],
          // Average messages per conversation
          avgMessagesPerConversation: [
            {
              $group: {
                _id: {
                  user1: { $min: ["$senderId", "$receiverId"] },
                  user2: { $max: ["$senderId", "$receiverId"] },
                },
                messageCount: { $sum: 1 },
              },
            },
            {
              $group: {
                _id: null,
                avgMessages: { $avg: "$messageCount" },
              },
            },
          ],
          // Total media shared
          mediaShared: [
            { $match: { files: { $exists: true, $ne: [] } } },
            { $unwind: "$files" },
            { $count: "count" },
          ],
          // Peak activity hours (distribution)
          peakHours: [
            {
              $group: {
                _id: { $hour: "$createdAt" },
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 3 },
          ],
          // Daily conversation trends (last 7 days)
          dailyTrends: [
            {
              $match: {
                createdAt: {
                  $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
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
          ],
        },
      },
    ]);

    const result = metrics[0];

    return res.status(200).json({
      success: true,
      data: {
        activeConversations24h: result.activeConversations[0]?.count || 0,
        avgMessagesPerConversation: Math.round(
          result.avgMessagesPerConversation[0]?.avgMessages || 0,
        ),
        totalMediaShared: result.mediaShared[0]?.count || 0,
        peakActivityHours: result.peakHours.map((h) => ({
          hour: h._id,
          count: h.count,
        })),
        dailyTrends: result.dailyTrends.map((t) => ({
          date: t._id,
          messages: t.count,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching conversation metrics:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const searchConversations = async (req, res) => {
  try {
    const {
      userId,
      dateFrom,
      dateTo,
      minMessages,
      maxMessages,
      page = 1,
      limit = 50,
    } = req.query;

    // Validation: require at least one filter
    if (!userId && !dateFrom && !dateTo && !minMessages && !maxMessages) {
      return res.status(400).json({
        success: false,
        message: "At least one search filter is required",
      });
    }

    // Build match stage
    const matchStage = {};

    if (userId) {
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid userId format" });
      }
      const userObjId = new mongoose.Types.ObjectId(userId);
      matchStage.$or = [{ senderId: userObjId }, { receiverId: userObjId }];
    }

    if (dateFrom || dateTo) {
      matchStage.createdAt = {};
      if (dateFrom) matchStage.createdAt.$gte = new Date(dateFrom);
      if (dateTo) matchStage.createdAt.$lte = new Date(dateTo);
    }

    // Aggregate conversations
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    const conversations = await MessageModel.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            user1: { $min: ["$senderId", "$receiverId"] },
            user2: { $max: ["$senderId", "$receiverId"] },
          },
          messageCount: { $sum: 1 },
          lastActivity: { $max: "$createdAt" },
          firstMessage: { $min: "$createdAt" },
          mediaCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ifNull: ["$files", false] },
                    { $ne: ["$files", []] },
                  ],
                },
                { $size: "$files" },
                0,
              ],
            },
          },
          participants: {
            $first: { senderId: "$senderId", receiverId: "$receiverId" },
          },
        },
      },
      // Filter by message count if specified
      ...(minMessages || maxMessages
        ? [
            {
              $match: {
                ...(minMessages && {
                  messageCount: { $gte: parseInt(minMessages) },
                }),
                ...(maxMessages && {
                  messageCount: { $lte: parseInt(maxMessages) },
                }),
              },
            },
          ]
        : []),
      { $sort: { lastActivity: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limitNum }],
          total: [{ $count: "count" }],
        },
      },
    ]);

    const results = conversations[0].data;
    const total = conversations[0].total[0]?.count || 0;

    // Populate user info
    const populatedResults = await Promise.all(
      results.map(async (conv) => {
        const user1 = await UserModel.findById(conv._id.user1).select(
          "_id username avatar",
        );
        const user2 = await UserModel.findById(conv._id.user2).select(
          "_id username avatar",
        );

        const duration = Math.floor(
          (new Date(conv.lastActivity) - new Date(conv.firstMessage)) /
            (1000 * 60 * 60 * 24),
        );

        return {
          conversationId: `${conv._id.user1}_${conv._id.user2}`,
          participants: [user1, user2].filter(Boolean),
          messageCount: conv.messageCount,
          mediaCount: conv.mediaCount,
          lastActivity: conv.lastActivity,
          duration: `${duration} days`,
          status: "active", // You can enhance this logic
        };
      }),
    );

    return res.status(200).json({
      success: true,
      data: populatedResults,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + limitNum < total,
      },
    });
  } catch (error) {
    console.error("Error searching conversations:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
