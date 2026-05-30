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

module.exports = {
  list_group_assignments,
  assign_program_to_group,
  upload_group_picture,
  get_group_picture,
  delete_group_picture
};
