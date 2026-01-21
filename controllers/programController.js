const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const Program = require("../models/program");
const Training = require("../models/training");
const Relationship = require("../models/relationship");
const { buildProgramWeeks, validatePublish } = require("../services/programs");

dayjs.extend(utc);

const create_program = async (req, res, next) => {
  try {
    const {
      title = "",
      description = "",
      weeksCount = 4,
      daysPerWeek = 5,
    } = req.body;

    const weeks = buildProgramWeeks(weeksCount, daysPerWeek);

    const program = new Program({
      ownerId: res.locals.user._id,
      title,
      description,
      weeksCount,
      daysPerWeek,
      status: "DRAFT",
      weeks,
    });

    const saved = await program.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const get_program = async (req, res, next) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }
    return res.json(program);
  } catch (err) {
    return next(err);
  }
};

const update_program = async (req, res, next) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const {
      title = program.title,
      description = program.description,
      weeksCount = program.weeksCount,
      daysPerWeek = program.daysPerWeek,
    } = req.body;

    program.title = title;
    program.description = description;

    const weeksChanged =
      Number(weeksCount) !== Number(program.weeksCount) ||
      Number(daysPerWeek) !== Number(program.daysPerWeek);

    program.weeksCount = Number(weeksCount);
    program.daysPerWeek = Number(daysPerWeek);

    if (weeksChanged) {
      program.weeks = buildProgramWeeks(program.weeksCount, program.daysPerWeek, program.weeks);
    }

    const saved = await program.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const update_program_day = async (req, res, next) => {
  try {
    const { weekIndex, dayIndex } = req.params;
    const { workoutId = null, notes = "" } = req.body;

    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });

    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const weekIdx = Number(weekIndex) - 1;
    const dayIdx = Number(dayIndex) - 1;

    if (
      Number.isNaN(weekIdx) ||
      Number.isNaN(dayIdx) ||
      weekIdx < 0 ||
      dayIdx < 0 ||
      weekIdx >= program.weeksCount ||
      dayIdx >= program.daysPerWeek
    ) {
      return res.status(400).json({ error: "Invalid week/day index." });
    }

    if (!program.weeks?.[weekIdx]?.[dayIdx]) {
      program.weeks = buildProgramWeeks(program.weeksCount, program.daysPerWeek, program.weeks);
    }

    program.weeks[weekIdx][dayIdx].workoutId = workoutId || null;
    program.weeks[weekIdx][dayIdx].notes = notes ?? "";

    const saved = await program.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const publish_program = async (req, res, next) => {
  try {
    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: res.locals.user._id,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const errors = validatePublish(program, { requireWorkout: true });
    if (errors.length) {
      return res.status(400).json({ error: "Validation failed.", errors });
    }

    program.status = "PUBLISHED";
    program.publishedAt = program.publishedAt || new Date();

    const saved = await program.save();
    return res.json(saved);
  } catch (err) {
    return next(err);
  }
};

const list_programs = async (req, res, next) => {
  try {
    const statusFilter = req.query.status;
    const query = { ownerId: res.locals.user._id };
    if (statusFilter) {
      query.status = String(statusFilter).toUpperCase();
    }
    const programs = await Program.find(query)
      .sort({ updatedAt: -1 });
    return res.json(programs);
  } catch (err) {
    return next(err);
  }
};

const assign_program = async (req, res, next) => {
  try {
    const { clientId, startDate } = req.body;
    const trainerId = res.locals.user._id;

    if (!clientId || !startDate) {
      return res.status(400).json({ error: "Client and start date are required." });
    }

    const program = await Program.findOne({
      _id: req.params.id,
      ownerId: trainerId,
    });
    if (!program) {
      return res.status(404).json({ error: "Program not found." });
    }

    const relationship = await Relationship.findOne({
      trainer: trainerId,
      client: clientId,
      accepted: true,
    });
    if (!relationship) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const baseDate = dayjs(startDate).utc().startOf("day");
    const workoutIds = [];
    program.weeks.forEach((week) => {
      week.forEach((day) => {
        if (day.workoutId) workoutIds.push(String(day.workoutId));
      });
    });
    const uniqueWorkoutIds = Array.from(new Set(workoutIds));
    const templates = await Training.find({ _id: { $in: uniqueWorkoutIds } }).lean();
    const templateMap = new Map(templates.map((t) => [String(t._id), t]));

    const newWorkouts = [];
    program.weeks.forEach((week, weekIdx) => {
      week.forEach((day, dayIdx) => {
        if (!day.workoutId) return;
        const template = templateMap.get(String(day.workoutId));
        if (!template) return;
        const date = baseDate.add(weekIdx * 7 + dayIdx, "day").toDate();
        newWorkouts.push({
          title: template.title || `${program.title} • Week ${weekIdx + 1} Day ${dayIdx + 1}`,
          date,
          user: clientId,
          category: template.category || [],
          training: template.training || [],
          workoutFeedback: { difficulty: 1, comments: [] },
          complete: false,
        });
      });
    });

    if (!newWorkouts.length) {
      return res.status(400).json({ error: "Program has no workouts to assign." });
    }

    const inserted = await Training.insertMany(newWorkouts);
    return res.json({ status: "assigned", count: inserted.length });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_program,
  list_programs,
  get_program,
  update_program,
  update_program_day,
  publish_program,
  assign_program,
};
