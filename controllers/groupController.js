const mongoose = require("mongoose");
const crypto = require("crypto");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

const Group = require("../models/group");
const GroupMembership = require("../models/groupMembership");
const GroupProgramAssignment = require("../models/groupProgramAssignment");
const GroupInvite = require("../models/groupInvite");
const Program = require("../models/program");
const Training = require("../models/training");
const User = require("../models/user");
const { sendEmail } = require("../services/emailService");

dayjs.extend(utc);

const ROLE = {
  TRAINER: "TRAINER",
  COACH: "COACH",
  ATHLETE: "ATHLETE",
  LEGACY_ADMIN: "ADMIN",
};

const ACTIVE_STATUS = "ACTIVE";

const ASSIGN_ROLES = new Set([ROLE.TRAINER, ROLE.COACH, ROLE.LEGACY_ADMIN]);
const TRAINER_ROLES = new Set([ROLE.TRAINER, ROLE.LEGACY_ADMIN]);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const inviteBaseUrl =
  process.env.APP_BASE_URL ||
  process.env.CLIENT_URL ||
  "http://localhost:3000";

const buildInviteUrl = (token) => `${inviteBaseUrl.replace(/\/$/, "")}/groups/invite?token=${token}`;

const normalizeRole = (role) => (role === ROLE.LEGACY_ADMIN ? ROLE.TRAINER : role);

const requireMembership = async (groupId, userId) =>
  GroupMembership.findOne({ groupId, userId, status: ACTIVE_STATUS });

const ensureRole = (membership, allowedRoles) => {
  if (!membership) return false;
  const effectiveRole = normalizeRole(membership.role);
  return allowedRoles.has(effectiveRole);
};

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

    if (
      !programOwnerMembership ||
      normalizeRole(programOwnerMembership.role) === ROLE.ATHLETE
    ) {
      return res.status(400).json({
        error: "Program owner must be a trainer or coach in this group.",
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

const upload_group_picture = async (req, res, next) => {
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

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded." });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "groupPicture",
    });

    if (group.picture) {
      const existingFile = await gridfsBucket
        .find({ _id: new mongoose.Types.ObjectId(group.picture) })
        .toArray();
      if (existingFile.length > 0) {
        await gridfsBucket.delete(new mongoose.Types.ObjectId(group.picture));
      }
    }

    const filename = crypto.randomBytes(16).toString("hex");
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype,
    });
    uploadStream.end(req.file.buffer);

    uploadStream.on("finish", async () => {
      group.picture = new mongoose.Types.ObjectId(uploadStream.id);
      const saved = await group.save();
      res.status(200).json(saved);
    });

    uploadStream.on("error", (err) => {
      console.error("Error uploading group picture:", err);
      res.status(500).send({ error: "Error uploading group picture", err });
    });
  } catch (err) {
    return next(err);
  }
};

const get_group_picture = async (req, res, next) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "groupPicture",
    });

    const files = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No group picture found" });
    }

    if (files[0].contentType === "image/jpeg" || files[0].contentType === "image/png") {
      const readstream = gridfsBucket.openDownloadStream(files[0]._id);
      return readstream.pipe(res);
    }

    return res.status(404).json({ error: "File is not an image" });
  } catch (err) {
    return next(err);
  }
};

const delete_group_picture = async (req, res, next) => {
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

    if (!group.picture) {
      return res.status(200).json(group);
    }

    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "groupPicture",
    });

    await gridfsBucket.delete(new mongoose.Types.ObjectId(group.picture));
    group.picture = null;
    const saved = await group.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const create_invite = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId } = req.params;
    const { email, role = ROLE.ATHLETE } = req.body;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    if (!Object.values(ROLE).includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({
      email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
    })
      .select("_id email")
      .lean();

    if (existingUser) {
      const existingMembership = await GroupMembership.findOne({
        groupId,
        userId: existingUser._id,
        status: ACTIVE_STATUS,
      });
      if (existingMembership) {
        return res.status(400).json({ error: "User is already in the group." });
      }
    }

    const group = await Group.findById(groupId).select("name").lean();
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    const expiresAt = dayjs().add(7, "day").toDate();
    const token = crypto.randomBytes(32).toString("hex");

    let invite = await GroupInvite.findOne({
      groupId,
      email: normalizedEmail,
      status: "PENDING",
    });

    if (invite) {
      invite.token = token;
      invite.expiresAt = expiresAt;
      invite.role = resolvedRole;
      invite.invitedBy = adminId;
    } else {
      invite = new GroupInvite({
        groupId,
        email: normalizedEmail,
        role: resolvedRole,
        invitedBy: adminId,
        token,
        expiresAt,
      });
    }

    await invite.save();

    const inviter = await User.findById(adminId)
      .select("firstName lastName")
      .lean();

    const inviteUrl = buildInviteUrl(invite.token);
    const mailOptions = {
      from: '"Firebelly Fitness" <info@firebellyfitness.com>',
      to: normalizedEmail,
      subject: `You're invited to join ${group.name}`,
      html: `
        <p>Hi there,</p>
        <p>${inviter?.firstName || "A coach"} invited you to join <strong>${group.name}</strong> on Firebelly Fitness.</p>
        <p>Your role: <strong>${resolvedRole}</strong></p>
        <p>Click the link below to accept the invite:</p>
        <a href="${inviteUrl}">Accept Invite</a>
        <p>This invite will expire in 7 days.</p>
      `,
    };

    await sendEmail(mailOptions);

    return res.json({ status: "sent", invite });
  } catch (err) {
    return next(err);
  }
};

const list_invites = async (req, res, next) => {
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

    const invites = await GroupInvite.find({ groupId, status: "PENDING" })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = invites.map((invite) => ({
      ...invite,
      role: normalizeRole(invite.role),
    }));

    return res.json(normalized);
  } catch (err) {
    return next(err);
  }
};

const revoke_invite = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId, inviteId } = req.params;

    if (!isValidObjectId(groupId) || !isValidObjectId(inviteId)) {
      return res.status(400).json({ error: "Invalid group or invite ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const invite = await GroupInvite.findOne({
      _id: inviteId,
      groupId,
      status: "PENDING",
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    invite.status = "REVOKED";
    await invite.save();

    return res.json({ status: "revoked" });
  } catch (err) {
    return next(err);
  }
};

const get_invite_by_token = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Invite token required." });
    }

    const invite = await GroupInvite.findOne({ token }).lean();
    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
      await GroupInvite.updateOne({ _id: invite._id }, { status: "EXPIRED" });
      return res.status(400).json({ error: "Invite expired." });
    }

    const group = await Group.findById(invite.groupId).select("name").lean();

    return res.json({
      invite: {
        email: invite.email,
        role: normalizeRole(invite.role),
        status: invite.status,
        expiresAt: invite.expiresAt,
        groupId: invite.groupId,
      },
      group: group || null,
    });
  } catch (err) {
    return next(err);
  }
};

const accept_invite = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Invite token required." });
    }

    const invite = await GroupInvite.findOne({ token });
    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    if (invite.status !== "PENDING") {
      return res.status(400).json({ error: `Invite is ${invite.status.toLowerCase()}.` });
    }

    if (invite.expiresAt < new Date()) {
      invite.status = "EXPIRED";
      await invite.save();
      return res.status(400).json({ error: "Invite expired." });
    }

    const user = await User.findById(userId).select("email").lean();
    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ error: "Invite email does not match your account." });
    }

    const resolvedRole = normalizeRole(invite.role);
    let membership = await GroupMembership.findOne({ groupId: invite.groupId, userId });
    if (membership) {
      membership.role = resolvedRole;
      membership.status = ACTIVE_STATUS;
      membership.joinedAt = membership.joinedAt || new Date();
      await membership.save();
    } else {
      membership = new GroupMembership({
        groupId: invite.groupId,
        userId,
        role: resolvedRole,
        status: ACTIVE_STATUS,
        addedBy: invite.invitedBy,
        joinedAt: new Date(),
      });
      await membership.save();
    }

    if (membership.role === ROLE.ATHLETE) {
      await applyAssignmentsForMember({
        groupId: invite.groupId,
        userId,
        addedBy: invite.invitedBy,
      });
    }

    invite.role = resolvedRole;
    invite.status = "ACCEPTED";
    invite.acceptedAt = new Date();
    invite.acceptedBy = userId;
    await invite.save();

    return res.json({ status: "accepted", groupId: invite.groupId });
  } catch (err) {
    return next(err);
  }
};

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
  upload_group_picture,
  get_group_picture,
  delete_group_picture,
  create_invite,
  list_invites,
  revoke_invite,
  get_invite_by_token,
  accept_invite,
  get_group_analytics,
  update_group_billing,
};
