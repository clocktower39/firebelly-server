const {
  ACTIVE_STATUS,
  ASSIGN_ROLES,
  Conversation,
  Group,
  GroupInvite,
  GroupMembership,
  GroupProgramAssignment,
  Program,
  ROLE,
  TRAINER_ROLES,
  Training,
  User,
  buildInviteUrl,
  buildTemplateMap,
  buildWorkoutsForUser,
  crypto,
  dayjs,
  ensureRole,
  escapeRegex,
  groupPictureBucket,
  isValidObjectId,
  mongoose,
  normalizeRole,
  requireMembership,
  resolveDayMap,
} = require("./context");

const get_group_analytics = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!membership) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const match = { groupId: new mongoose.Types.ObjectId(groupId) };
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        const parsedStart = dayjs(startDate);
        if (!parsedStart.isValid()) {
          return res.status(400).json({ error: "Invalid start date." });
        }
        dateFilter.$gte = parsedStart.startOf("day").toDate();
      }
      if (endDate) {
        const parsedEnd = dayjs(endDate);
        if (!parsedEnd.isValid()) {
          return res.status(400).json({ error: "Invalid end date." });
        }
        dateFilter.$lte = parsedEnd.endOf("day").toDate();
      }
      match.date = dateFilter;
    }

    const summaryAgg = await Training.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$complete", true] }, 1, 0] },
          },
        },
      },
    ]);

    const summary = summaryAgg[0] || { totalAssigned: 0, completed: 0 };
    const completionRate = summary.totalAssigned
      ? summary.completed / summary.totalAssigned
      : 0;

    const byMemberAgg = await Training.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$user",
          totalAssigned: { $sum: 1 },
          completed: {
            $sum: { $cond: [{ $eq: ["$complete", true] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
        },
      },
      { $unwind: "$user" },
      {
        $project: {
          _id: 0,
          userId: "$user._id",
          firstName: "$user.firstName",
          lastName: "$user.lastName",
          totalAssigned: 1,
          completed: 1,
        },
      },
      { $sort: { completed: -1 } },
    ]);

    const byMember = byMemberAgg.map((entry) => ({
      ...entry,
      completionRate: entry.totalAssigned ? entry.completed / entry.totalAssigned : 0,
    }));

    return res.json({
      summary: {
        ...summary,
        completionRate,
      },
      byMember,
    });
  } catch (err) {
    return next(err);
  }
};

const update_group_billing = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    const { status, planId, trialEndsAt, customerId, subscriptionId } = req.body;
    const allowedStatuses = ["INACTIVE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid billing status." });
    }

    if (status !== undefined) group.billing.status = status;
    if (planId !== undefined) group.billing.planId = planId || null;
    if (customerId !== undefined) group.billing.customerId = customerId || null;
    if (subscriptionId !== undefined) group.billing.subscriptionId = subscriptionId || null;

    if (trialEndsAt !== undefined) {
      if (!trialEndsAt) {
        group.billing.trialEndsAt = null;
      } else {
        const parsed = dayjs(trialEndsAt);
        if (!parsed.isValid()) {
          return res.status(400).json({ error: "Invalid trial end date." });
        }
        group.billing.trialEndsAt = parsed.toDate();
      }
    }

    const saved = await group.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const get_group_chat = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!membership) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    let conversation = await Conversation.findOne({ groupId })
      .populate("messages.user", "firstName lastName profilePicture")
      .lean();

    if (!conversation) {
      const created = await Conversation.create({
        groupId,
        messages: [],
        users: [],
      });
      conversation = await Conversation.findById(created._id)
        .populate("messages.user", "firstName lastName profilePicture")
        .lean();
    }

    return res.json(conversation);
  } catch (err) {
    return next(err);
  }
};

const send_group_message = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;
    const { message } = req.body;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: "Message is required." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!membership) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const newMessage = {
      user: userId,
      message: String(message).trim(),
      timestamp: new Date(),
    };

    let conversation = await Conversation.findOneAndUpdate(
      { groupId },
      { $push: { messages: newMessage } },
      { returnDocument: "after" }
    )
      .populate("messages.user", "firstName lastName profilePicture")
      .lean();

    if (!conversation) {
      const created = await Conversation.create({
        groupId,
        messages: [newMessage],
        users: [],
      });
      conversation = await Conversation.findById(created._id)
        .populate("messages.user", "firstName lastName profilePicture")
        .lean();
    }

    return res.json(conversation);
  } catch (err) {
    return next(err);
  }
};

const delete_group_message = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId, messageId } = req.params;

    if (!isValidObjectId(groupId) || !isValidObjectId(messageId)) {
      return res.status(400).json({ error: "Invalid group or message ID." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!membership) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const conversation = await Conversation.findOneAndUpdate(
      { groupId },
      { $pull: { messages: { _id: messageId, user: userId } } },
      { returnDocument: "after" }
    )
      .populate("messages.user", "firstName lastName profilePicture")
      .lean();

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found." });
    }

    return res.json(conversation);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  get_group_analytics,
  update_group_billing,
  get_group_chat,
  send_group_message,
  delete_group_message
};
