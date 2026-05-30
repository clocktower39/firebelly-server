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

const create_group = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { name, description = "", sport = "", season = "", timezone = "UTC" } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }

    const group = new Group({
      name: String(name).trim(),
      description,
      sport,
      season,
      timezone,
      createdBy: userId,
    });

    const savedGroup = await group.save();

    const membership = new GroupMembership({
      groupId: savedGroup._id,
      userId,
      role: ROLE.TRAINER,
      status: ACTIVE_STATUS,
      addedBy: userId,
      joinedAt: new Date(),
    });

    const savedMembership = await membership.save();

    return res.json({ group: savedGroup, membership: savedMembership });
  } catch (err) {
    return next(err);
  }
};

const list_groups = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;

    const memberships = await GroupMembership.find({ userId, status: ACTIVE_STATUS })
      .populate("groupId")
      .sort({ createdAt: -1 })
      .lean();

    const groups = memberships
      .filter((membership) => membership.groupId)
      .map((membership) => ({
        group: membership.groupId,
        role: normalizeRole(membership.role),
        membershipId: membership._id,
        membershipStatus: membership.status,
      }));

    return res.json(groups);
  } catch (err) {
    return next(err);
  }
};

const get_group = async (req, res, next) => {
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

    const group = await Group.findById(groupId).lean();
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    return res.json({
      group,
      role: normalizeRole(membership.role),
      membershipId: membership._id,
    });
  } catch (err) {
    return next(err);
  }
};

const update_group = async (req, res, next) => {
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

    const {
      name = group.name,
      description = group.description,
      sport = group.sport,
      season = group.season,
      timezone = group.timezone,
      archivedAt = group.archivedAt,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Group name is required." });
    }

    group.name = String(name).trim();
    group.description = description;
    group.sport = sport;
    group.season = season;
    group.timezone = timezone;
    group.archivedAt = archivedAt || null;

    const saved = await group.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_group,
  list_groups,
  get_group,
  update_group
};
