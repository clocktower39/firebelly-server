const mongoose = require("mongoose");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

const Group = require("../models/group");
const GroupMembership = require("../models/groupMembership");
const GroupProgramAssignment = require("../models/groupProgramAssignment");
const Program = require("../models/program");
const Training = require("../models/training");
const User = require("../models/user");

dayjs.extend(utc);

const ROLE = {
  ADMIN: "ADMIN",
  TRAINER: "TRAINER",
  COACH: "COACH",
  ATHLETE: "ATHLETE",
};

const ACTIVE_STATUS = "ACTIVE";

const ASSIGN_ROLES = new Set([ROLE.ADMIN, ROLE.TRAINER, ROLE.COACH]);
const ADMIN_ROLES = new Set([ROLE.ADMIN]);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const requireMembership = async (groupId, userId) =>
  GroupMembership.findOne({ groupId, userId, status: ACTIVE_STATUS });

const ensureRole = (membership, allowedRoles) =>
  membership && allowedRoles.has(membership.role);

const resolveDayMap = (dayMap, daysPerWeek) => {
  if (!Array.isArray(dayMap) || dayMap.length === 0) {
    return null;
  }

  const resolvedDayMap = dayMap.map((value) => Number(value));
  if (resolvedDayMap.length !== Number(daysPerWeek)) {
    return { error: "Day mapping must match days per week." };
  }

  if (resolvedDayMap.some((value) => Number.isNaN(value) || value < 0 || value > 6)) {
    return { error: "Day mapping must use weekday values 0-6." };
  }

  return resolvedDayMap;
};

const buildTemplateMap = async (program) => {
  const workoutIds = [];
  program.weeks?.forEach((week) => {
    week.forEach((day) => {
      if (day.workoutId) workoutIds.push(String(day.workoutId));
    });
  });

  const uniqueWorkoutIds = Array.from(new Set(workoutIds));
  if (!uniqueWorkoutIds.length) {
    return { error: "Program has no workouts to assign." };
  }

  const templates = await Training.find({ _id: { $in: uniqueWorkoutIds } }).lean();
  const templateMap = new Map(templates.map((t) => [String(t._id), t]));

  return { templateMap };
};

const buildWorkoutsForUser = ({
  program,
  templateMap,
  userId,
  startDate,
  dayMap,
  groupId,
  assignmentId,
  assignedBy,
}) => {
  const baseDate = dayjs(startDate).utc().startOf("day");
  const baseWeekday = baseDate.day();

  const newWorkouts = [];
  program.weeks.forEach((week, weekIdx) => {
    week.forEach((day, dayIdx) => {
      if (!day.workoutId) return;
      const template = templateMap.get(String(day.workoutId));
      if (!template) return;

      const targetWeekday = dayMap ? dayMap[dayIdx] : baseWeekday + dayIdx;
      const rawOffset = targetWeekday - baseWeekday;
      const dayOffset = rawOffset < 0 ? rawOffset + 7 : rawOffset;
      const date = baseDate.add(weekIdx * 7 + dayOffset, "day").toDate();

      newWorkouts.push({
        title: template.title || `${program.title} • Week ${weekIdx + 1} Day ${dayIdx + 1}`,
        date,
        user: userId,
        category: template.category || [],
        training: template.training || [],
        workoutFeedback: { difficulty: 1, comments: [] },
        complete: false,
        programId: program._id,
        groupId,
        groupAssignmentId: assignmentId,
        assignedBy,
        assignedAt: new Date(),
      });
    });
  });

  return newWorkouts;
};

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
      role: ROLE.ADMIN,
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
        role: membership.role,
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

    return res.json({ group, role: membership.role, membershipId: membership._id });
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
    if (!ensureRole(membership, ADMIN_ROLES)) {
      return res.status(403).json({ error: "Admin access required." });
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

    return res.json(members);
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
    if (!ensureRole(membership, ADMIN_ROLES)) {
      return res.status(403).json({ error: "Admin access required." });
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

    const user = await User.findById(resolvedUserId).select("_id").lean();
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    const existing = await GroupMembership.findOne({ groupId, userId: resolvedUserId });
    const wasActive = existing?.status === ACTIVE_STATUS;

    let saved;
    if (existing) {
      existing.role = role;
      existing.status = ACTIVE_STATUS;
      existing.addedBy = adminId;
      existing.joinedAt = existing.joinedAt || new Date();
      saved = await existing.save();
    } else {
      const created = new GroupMembership({
        groupId,
      userId: resolvedUserId,
      role,
      status: ACTIVE_STATUS,
      addedBy: adminId,
      joinedAt: new Date(),
      });
      saved = await created.save();
    }

    let autoAssignedCount = 0;
    if (!wasActive && role === ROLE.ATHLETE) {
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
    if (!ensureRole(membership, ADMIN_ROLES)) {
      return res.status(403).json({ error: "Admin access required." });
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
    if (!ensureRole(membership, ADMIN_ROLES)) {
      return res.status(403).json({ error: "Admin access required." });
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
    member.role = role;
    member.status = status;

    const saved = await member.save();

    let autoAssignedCount = 0;
    if (!wasActive && status === ACTIVE_STATUS && role === ROLE.ATHLETE) {
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
    if (!ensureRole(membership, ADMIN_ROLES)) {
      return res.status(403).json({ error: "Admin access required." });
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

const list_group_assignments = async (req, res, next) => {
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

    const assignments = await GroupProgramAssignment.find({ groupId })
      .populate("programId", "title weeksCount daysPerWeek")
      .populate("assignedBy", "firstName lastName")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(assignments);
  } catch (err) {
    return next(err);
  }
};

const assign_program_to_group = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, userId);
    if (!ensureRole(membership, ASSIGN_ROLES)) {
      return res.status(403).json({ error: "Assign permission required." });
    }

    const {
      programId,
      startDate,
      dayMap,
      applyToCurrentMembers = true,
      autoAddNewMembers = false,
    } = req.body;

    if (!isValidObjectId(programId)) {
      return res.status(400).json({ error: "Invalid program ID." });
    }

    if (!startDate) {
      return res.status(400).json({ error: "Start date is required." });
    }

    const program = await Program.findById(programId).lean();
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const dayMapValidation = resolveDayMap(dayMap, program.daysPerWeek);
    if (dayMapValidation && dayMapValidation.error) {
      return res.status(400).json({ error: dayMapValidation.error });
    }

    const resolvedDayMap = Array.isArray(dayMapValidation) ? dayMapValidation : null;

    const start = dayjs(startDate);
    if (!start.isValid()) {
      return res.status(400).json({ error: "Invalid start date." });
    }

    const programOwnerMembership = await GroupMembership.findOne({
      groupId,
      userId: program.ownerId,
      status: ACTIVE_STATUS,
    }).lean();

    if (!programOwnerMembership || programOwnerMembership.role === ROLE.ATHLETE) {
      return res.status(400).json({
        error: "Program owner must be a trainer, coach, or admin in this group.",
      });
    }

    const templateResult = await buildTemplateMap(program);
    if (templateResult.error) {
      return res.status(400).json({ error: templateResult.error });
    }

    const assignment = new GroupProgramAssignment({
      groupId,
      programId,
      assignedBy: userId,
      startDate: start.toDate(),
      dayMap: resolvedDayMap,
      autoAddNewMembers: Boolean(autoAddNewMembers),
    });

    const savedAssignment = await assignment.save();

    if (!applyToCurrentMembers) {
      return res.json({ status: "assigned", assignment: savedAssignment, count: 0 });
    }

    const members = await GroupMembership.find({
      groupId,
      status: ACTIVE_STATUS,
      role: ROLE.ATHLETE,
    }).lean();

    if (!members.length) {
      return res.json({ status: "assigned", assignment: savedAssignment, count: 0 });
    }

    const newWorkouts = [];
    members.forEach((member) => {
      const workouts = buildWorkoutsForUser({
        program,
        templateMap: templateResult.templateMap,
        userId: member.userId,
        startDate: start.toDate(),
        dayMap: resolvedDayMap,
        groupId,
        assignmentId: savedAssignment._id,
        assignedBy: userId,
      });
      newWorkouts.push(...workouts);
    });

    if (!newWorkouts.length) {
      return res.status(400).json({ error: "Program has no workouts to assign." });
    }

    const inserted = await Training.insertMany(newWorkouts);

    return res.json({
      status: "assigned",
      assignment: savedAssignment,
      count: inserted.length,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_group,
  list_groups,
  get_group,
  update_group,
  list_members,
  add_member,
  update_member,
  remove_member,
  list_group_assignments,
  assign_program_to_group,
  search_group_users,
};
