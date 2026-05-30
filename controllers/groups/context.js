const mongoose = require("mongoose");
const crypto = require("crypto");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");

const Group = require("../../models/group");
const GroupMembership = require("../../models/groupMembership");
const GroupProgramAssignment = require("../../models/groupProgramAssignment");
const GroupInvite = require("../../models/groupInvite");
const Program = require("../../models/program");
const Training = require("../../models/training");
const Conversation = require("../../models/conversation");
const User = require("../../models/user");
const { groupPictureBucket } = require("../../mygridfs");

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

module.exports = {
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
};
