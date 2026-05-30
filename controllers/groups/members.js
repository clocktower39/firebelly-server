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

const list_members = async (req, res, next) => {
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

    const members = await GroupMembership.find({ groupId, status: ACTIVE_STATUS })
      .populate("userId", "firstName lastName email profilePicture")
      .sort({ createdAt: 1 })
      .lean();

    const normalized = members.map((member) => ({
      ...member,
      role: normalizeRole(member.role),
    }));

    return res.json(normalized);
  } catch (err) {
    return next(err);
  }
};

const applyAssignmentsForMember = async ({ groupId, userId, addedBy }) => {
  const assignments = await GroupProgramAssignment.find({
    groupId,
    autoAddNewMembers: true,
  }).lean();

  if (!assignments.length) {
    return 0;
  }

  let totalInserted = 0;

  for (const assignment of assignments) {
    const existing = await Training.exists({
      user: userId,
      groupAssignmentId: assignment._id,
    });
    if (existing) continue;

    const program = await Program.findById(assignment.programId).lean();
    if (!program) continue;

    const { templateMap, error } = await buildTemplateMap(program);
    if (error) continue;

    const newWorkouts = buildWorkoutsForUser({
      program,
      templateMap,
      userId,
      startDate: assignment.startDate,
      dayMap: assignment.dayMap,
      groupId,
      assignmentId: assignment._id,
      assignedBy: assignment.assignedBy || addedBy,
    });

    if (!newWorkouts.length) continue;
    const inserted = await Training.insertMany(newWorkouts);
    totalInserted += inserted.length;
  }

  return totalInserted;
};

const add_member = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const { userId, email, role = ROLE.ATHLETE } = req.body;
    let resolvedUserId = userId;
    if (!resolvedUserId && email) {
      const userByEmail = await User.findOne({
        email: new RegExp(`^${escapeRegex(String(email).trim())}$`, "i"),
      })
        .select("_id")
        .lean();
      if (!userByEmail) {
        return res.status(404).json({ error: "User not found for email." });
      }
      resolvedUserId = userByEmail._id;
    }

    if (!resolvedUserId || !isValidObjectId(resolvedUserId)) {
      return res.status(400).json({ error: "Invalid user ID." });
    }

    if (!Object.values(ROLE).includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }
    const resolvedRole = normalizeRole(role);

    const user = await User.findById(resolvedUserId).select("_id").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const existing = await GroupMembership.findOne({ groupId, userId: resolvedUserId });
    const wasActive = existing?.status === ACTIVE_STATUS;

    let saved;
    if (existing) {
      existing.role = resolvedRole;
      existing.status = ACTIVE_STATUS;
      existing.addedBy = adminId;
      existing.joinedAt = existing.joinedAt || new Date();
      saved = await existing.save();
    } else {
      const created = new GroupMembership({
        groupId,
      userId: resolvedUserId,
      role: resolvedRole,
      status: ACTIVE_STATUS,
      addedBy: adminId,
      joinedAt: new Date(),
    });
    saved = await created.save();
  }

    let autoAssignedCount = 0;
    if (!wasActive && resolvedRole === ROLE.ATHLETE) {
      autoAssignedCount = await applyAssignmentsForMember({
        groupId,
        userId: resolvedUserId,
        addedBy: adminId,
      });
    }

    return res.json({ membership: saved, autoAssignedCount });
  } catch (err) {
    return next(err);
  }
};

const search_group_users = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId } = req.params;
    const { query } = req.body;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    if (!query || String(query).trim().length < 2) {
      return res.json([]);
    }

    const searchRegex = new RegExp(escapeRegex(String(query).trim()), "i");
    const existingMemberIds = await GroupMembership.find({ groupId, status: { $ne: "REMOVED" } })
      .select("userId")
      .lean();
    const excludeIds = existingMemberIds.map((member) => member.userId);

    const users = await User.find({
      _id: { $nin: excludeIds },
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { phoneNumber: searchRegex },
      ],
    })
      .select("_id firstName lastName email phoneNumber profilePicture")
      .limit(20)
      .lean();

    return res.json(users);
  } catch (err) {
    return next(err);
  }
};

const update_member = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId, memberId } = req.params;

    if (!isValidObjectId(groupId) || !isValidObjectId(memberId)) {
      return res.status(400).json({ error: "Invalid group or member ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const member = await GroupMembership.findOne({ _id: memberId, groupId });
    if (!member) {
      return res.status(404).json({ error: "Member not found." });
    }

    const { role = member.role, status = member.status } = req.body;

    if (!Object.values(ROLE).includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    if (!["ACTIVE", "INVITED", "REMOVED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status." });
    }

    const wasActive = member.status === ACTIVE_STATUS;
    const resolvedRole = normalizeRole(role);
    member.role = resolvedRole;
    member.status = status;

    const saved = await member.save();

    let autoAssignedCount = 0;
    if (!wasActive && status === ACTIVE_STATUS && resolvedRole === ROLE.ATHLETE) {
      autoAssignedCount = await applyAssignmentsForMember({
        groupId,
        userId: member.userId,
        addedBy: adminId,
      });
    }

    return res.json({ membership: saved, autoAssignedCount });
  } catch (err) {
    return next(err);
  }
};

const remove_member = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId, memberId } = req.params;

    if (!isValidObjectId(groupId) || !isValidObjectId(memberId)) {
      return res.status(400).json({ error: "Invalid group or member ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const member = await GroupMembership.findOne({ _id: memberId, groupId });
    if (!member) {
      return res.status(404).json({ error: "Member not found." });
    }

    member.status = "REMOVED";
    await member.save();

    return res.json({ status: "removed" });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  list_members,
  add_member,
  search_group_users,
  update_member,
  remove_member
};
