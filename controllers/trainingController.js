const Training = require("../models/training");
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const Exercise = require("../models/exercise");
const User = require("../models/user");

dayjs.extend(utc);

const create_training = async (req, res, next) => {
  try {
    const { userId, ...payload } = req.body;
    let targetUserId = res.locals.user._id;

    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }

    const training = new Training({
      ...payload,
      user: targetUserId,
    });

    const saved = await training.save();
    return res.send({
      status: "success",
      training: saved,
    });
  } catch (err) {
    return next(err);
  }
};

const update_training = (req, res, next) => {
  Training.findByIdAndUpdate(req.body._id, { ...req.body.training }, { new: true })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .populate({
      path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .then((training) => {
      res.send({ training });
    })
    .catch((err) => next(err));
};

const get_training_by_id = (req, res, next) => {
  Training.findOne({ _id: req.body._id })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .populate({
      path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .then((data) => {
      if (!data) {
        return res.status(404).json({ error: "Training not found." });
      }

      if (data.user._id.toString() === res.locals.user._id) {
        return res.send(data);
      }

      Relationship.findOne({ trainer: res.locals.user._id, client: data.user._id })
        .then((relationship) => {
          if (!relationship || !relationship.accepted) {
            return res.status(403).json({ error: "Unauthorized access." });
          }
          res.send(data);
        })
        .catch((err) => next(err));
    })
    .catch((err) => next(err));
};

const get_workout_queue = async (req, res, next) => {
  try {
    const clientId = req.query.clientId;
    const startDate = req.query.startDate;
    const userId = res.locals.user._id;
    let targetUserId = userId;

    if (clientId && String(clientId) !== String(userId)) {
      const relationship = await Relationship.findOne({
        trainer: userId,
        client: clientId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = clientId;
    }

    const workoutQuery = { user: targetUserId };
    if (startDate) {
      workoutQuery.date = { $gte: new Date(startDate) };
    }

    const workouts = await Training.find(workoutQuery).populate({
      path: "training.exercise",
      select: "_id exerciseTitle",
    });

    if (!workouts.length) {
      return res.send([]);
    }

    const workoutIds = workouts.map((workout) => workout._id);
    const scheduledEvents = await ScheduleEvent.find({
      workoutId: { $in: workoutIds },
      status: { $ne: "CANCELLED" },
    }).select("workoutId");

    const scheduledSet = new Set(scheduledEvents.map((event) => String(event.workoutId)));
    const filteredWorkouts = workouts.filter(
      (workout) => !scheduledSet.has(String(workout._id))
    );

    return res.send(filteredWorkouts);
  } catch (err) {
    return next(err);
  }
};


const get_workouts_by_date = async (req, res, next) => {
  const { client } = req.body;
  const user = res.locals.user;
  let clientObj;

  if (client) {
    await Relationship.findOne({ trainer: user._id, client })
      .populate({
        path: "client",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .then((relationship) => {
        if (!relationship || !relationship.accepted) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
        clientObj = relationship.client;
      })
      .catch((err) => next(err));
  }

  const targetUser = clientObj ?? user;

  const dayStart = dayjs.utc(req.body.date).startOf("day").toDate();
  const dayEnd = dayjs.utc(req.body.date).endOf("day").toDate();
  const targetUserId = targetUser._id;
  const targetUserObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
    ? new mongoose.Types.ObjectId(targetUserId)
    : null;
  const userMatch = targetUserObjectId ? { $in: [targetUserId, targetUserObjectId] } : targetUserId;

  Training.find({
    user: userMatch,
    $expr: {
      $and: [
        { $gte: [{ $toDate: "$date" }, dayStart] },
        { $lte: [{ $toDate: "$date" }, dayEnd] },
      ],
    },
  })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .populate({
      path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .then((data) => {
      return res.send({ workouts: data, user: targetUser });
    })
    .catch((err) => next(err));
};

const get_weekly_training = async (req, res, next) => {
  try {
    const selectedDate = new Date(req.body.date);
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date(selectedDate);
    endDate.setDate(endDate.getDate() + 1);

    const { client } = req.body;
    const user = res.locals.user;

    let targetUser = user;

    if (client !== user._id) {
      const relationship = await Relationship.findOne({ trainer: user._id, client })
        .populate({
          path: "client",
          model: "User",
          select: "_id firstName lastName profilePicture",
        });

      if (!relationship || !relationship.accepted) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUser = relationship.client;
    }

    const workouts = await Training.find({
      date: { $gte: startDate, $lt: endDate },
      user: targetUser._id,
    })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      });

    return res.json({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

const get_exercise_list = (req, res, next) => {
  const { user } = req.body;

  Training.find({ user })
    .then(async (data) => {
      let exerciseList = [];
      const relationship = await checkClientRelationship(res.locals.user._id, user?._id);

      if (res.locals.user._id === user._id || relationship?.accepted) {
        data.map((day) => {
          day.training.map((set) => {
            set.map((exercise) => {
              if (
                !exerciseList
                  .map((ex) => (typeof ex === "string" ? ex.toLowerCase() : ex))
                  .includes(
                    typeof exercise.exercise === "string" ? exercise.exercise.toLowerCase() : ""
                  )
              ) {
                exerciseList.push(exercise.exercise);
              }
            });
          });
        });
        res.send(exerciseList);
      } else {
        res.send({ error: "Restricted" });
      }
    })
    .catch((err) => next(err));
};

const get_exercise_history = (req, res, next) => {
  const { targetExercise, user } = req.body;
  const targetExerciseId = new mongoose.Types.ObjectId(targetExercise._id);

  Training.find({
    user: user._id,
    training: {
      $elemMatch: {
        $elemMatch: { exercise: targetExerciseId },
      },
    },
  })
    .populate({
      path: "training.exercise",
      select: "_id exerciseTitle",
    })
    .lean()
    .exec()
    .then(async (data) => {
      let historyList = [];
      const relationship = await checkClientRelationship(res.locals.user._id, user._id);

      if (res.locals.user._id === user._id || relationship?.accepted) {
        data.map((day) => {
          day.training.map((set) => {
            let targetedExercise = set.filter((exercise) => {
              return exercise.exercise._id.equals(targetExerciseId);
            });
            if (targetedExercise.length > 0) {
              historyList.push({ ...targetedExercise[0], date: day.date });
            }
          });
        });
        res.send(historyList);
      } else {
        res.send({ error: "Restricted" });
      }
    })
    .catch((err) => next(err));
};

const update_workout_date_by_id = async (req, res, next) => {
  const updateWorkoutDate = async (training, newDate, newTitle) => {
    try {
      training.date = newDate;
      training.title = newTitle;

      training.training.forEach((set) => {
        set.forEach((exercise) => {
          exercise.exercise = exercise.exercise;
        });
      });

      const updatedTraining = await training.save();
      return updatedTraining;
    } catch (error) {
      throw error;
    }
  };

  try {
    const training = await Training.findOne({ _id: req.body._id });

    if (!training) {
      return res.status(404).json({ error: "Training not found." });
    }

    // Check if the user updating the data is the owner
    if (training.user._id.toString() === res.locals.user._id) {
      // Update the workout date
      const updatedTraining = await updateWorkoutDate(
        training,
        req.body.newDate,
        req.body.newTitle
      );
      return res.send(updatedTraining);
    }

    // If not the owner, check the relationship
    const relationship = await checkClientRelationship(res.locals.user._id, training.user._id);

    if (relationship && relationship.accepted) {
      // If the relationship is accepted, update the workout date
      const updatedTraining = await updateWorkoutDate(
        training,
        req.body.newDate,
        req.body.newTitle
      );
      res.send(updatedTraining);
    } else {
      res.status(403).json({ error: "Unauthorized access." });
    }
  } catch (error) {
    next(error);
  }
};

const copy_workout_by_id = async (req, res, next) => {
  try {
    const { newDate, _id, option = "exact", newTitle, newAccount } = req.body;
    if (!_id) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    const data = await Training.findOne({ _id }).lean();
    if (!data) return res.status(404).json({ error: "Training not found." });
    const hasNewDate = newDate !== undefined && newDate !== null && newDate !== "";
    if (!hasNewDate && !data.isTemplate) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    if (String(data.user) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: data.user,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const copyData = { ...data };
    copyData._id = new mongoose.Types.ObjectId();
    copyData.isNew = true;
    if (hasNewDate) {
      copyData.date = dayjs.utc(newDate).startOf("day").toDate();
    }
    const nextUser = newAccount || copyData.user;
    copyData.user =
      mongoose.Types.ObjectId.isValid(nextUser) && !(nextUser instanceof mongoose.Types.ObjectId)
        ? new mongoose.Types.ObjectId(nextUser)
        : nextUser;
    copyData.workoutFeedback = { difficulty: 1, comments: [] };
    if (newTitle) copyData.title = newTitle;

    if (Array.isArray(copyData.training)) {
      switch (option) {
        case "achievedToNewGoal":
          copyData.complete = false;
          copyData.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.goals.exactReps = exercise.achieved.reps;
              exercise.goals.weight = exercise.achieved.weight;
              exercise.goals.percent = exercise.achieved.percent;
              exercise.goals.seconds = exercise.achieved.seconds;
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "copyGoalOnly":
          copyData.complete = false;
          copyData.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "exact":
        default:
          copyData.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };
            });
          });
          break;
      }
    }

    const insertResult = await Training.collection.insertOne(copyData, { ordered: false });
    const insertedId = insertResult.insertedId;

    const workoutCopy = await Training.findById(insertedId)
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

    return res.send(workoutCopy);
  } catch (err) {
    return next(err);
  }
};

const get_training_range_end = async (req, res, next) => {
  try {
    const { startDate, userId } = req.body;
    if (!startDate) {
      return res.status(400).json({ error: "Start date is required." });
    }

    let targetUserId = res.locals.user._id;

    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }

    const maxTraining = await Training.findOne({
      user: targetUserId,
      date: { $gte: new Date(startDate) },
    })
      .sort({ date: -1 })
      .select("date")
      .lean();

    return res.send({ maxDate: maxTraining?.date || null });
  } catch (err) {
    return next(err);
  }
};

const bulk_move_copy_workouts = async (req, res, next) => {
  try {
    const {
      action,
      rangeStart,
      rangeEnd,
      targetStartDate,
      option = "exact",
      userId,
      newAccount,
      targetQueue = false,
      conflictPolicy,
      filters = {},
      titlePrefix = "",
      titleSuffix = "",
    } = req.body;

    if (!action || !rangeStart || (!targetStartDate && !targetQueue)) {
      return res.status(400).json({ error: "Missing required fields." });
    }

    let targetUserId = res.locals.user._id;

    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }

    const startDate = dayjs.utc(rangeStart).startOf("day");
    let endDate = rangeEnd ? dayjs.utc(rangeEnd).endOf("day") : null;

    if (!endDate) {
      const maxTraining = await Training.findOne({
        user: targetUserId,
        date: { $gte: startDate.toDate() },
      })
        .sort({ date: -1 })
        .select("date")
        .lean();

      if (!maxTraining?.date) {
        const targetUser = await User.findById(targetUserId)
          .select("_id firstName lastName profilePicture")
          .lean();
        return res.send({ workouts: [], user: targetUser ?? { _id: targetUserId } });
      }
      endDate = dayjs(maxTraining.date).endOf("day");
    }

    if (endDate.isBefore(startDate)) {
      return res.status(400).json({ error: "Range end must be on or after start." });
    }

    const deltaDays = targetQueue
      ? 0
      : dayjs.utc(targetStartDate).startOf("day").diff(startDate, "day");

    const workoutQuery = {
      user: targetUserId,
      date: { $gte: startDate.toDate(), $lte: endDate.toDate() },
    };

    if (filters?.categoriesInclude?.length || filters?.categoriesExclude?.length) {
      workoutQuery.category = {};
      if (filters.categoriesInclude?.length) {
        workoutQuery.category.$in = filters.categoriesInclude;
      }
      if (filters.categoriesExclude?.length) {
        workoutQuery.category.$nin = filters.categoriesExclude;
      }
    }

    if (filters?.includeCompleted === false) {
      workoutQuery.complete = { $ne: true };
    }

    if (filters?.includeTemplates === false) {
      workoutQuery.isTemplate = { $ne: true };
    }

    const workoutsInRange = await Training.find(workoutQuery);

    if (!workoutsInRange.length) {
      const targetUser = await User.findById(targetUserId)
        .select("_id firstName lastName profilePicture")
        .lean();
      return res.send({ workouts: [], user: targetUser ?? { _id: targetUserId } });
    }

    const effectiveConflictPolicy =
      action === "copy" ? "allow" : conflictPolicy || "abort";

    let workoutsToProcess = workoutsInRange;
    const targetUserForConflicts = action === "copy" ? newAccount || targetUserId : targetUserId;
    const movingIds = new Set(workoutsInRange.map((workout) => String(workout._id)));
    const targetDateRanges = targetQueue
      ? []
      : workoutsInRange.map((workout) => {
          const targetDate = dayjs.utc(workout.date).add(deltaDays, "day");
          return {
            date: {
              $gte: targetDate.startOf("day").toDate(),
              $lte: targetDate.endOf("day").toDate(),
            },
          };
        });

    let deletedConflictIds = [];
    if (targetDateRanges.length) {
      const conflictQuery = {
        user: targetUserForConflicts,
        $or: targetDateRanges,
      };

      if (action === "move") {
        conflictQuery._id = { $nin: [...movingIds] };
      }

      const conflicts = await Training.find(conflictQuery).select("date _id").lean();

      if (conflicts.length) {
        const conflictDates = [
          ...new Set(conflicts.map((entry) => dayjs.utc(entry.date).format("YYYY-MM-DD"))),
        ];

        if (effectiveConflictPolicy === "abort") {
          return res.status(409).json({
            error: `Conflicts found on target dates: ${conflictDates.join(", ")}`,
            conflicts: conflictDates,
          });
        }

        if (effectiveConflictPolicy === "replace") {
          const deleteQuery = {
            user: targetUserForConflicts,
            $or: targetDateRanges,
          };
          if (action === "move") {
            deleteQuery._id = { $nin: [...movingIds] };
          }
          deletedConflictIds = conflicts.map((entry) => entry._id);
          await Training.deleteMany(deleteQuery);
        }

        if (effectiveConflictPolicy === "skip") {
          const conflictDateSet = new Set(conflictDates);
          workoutsToProcess = workoutsInRange.filter((workout) => {
            const targetDate = dayjs.utc(workout.date).add(deltaDays, "day");
            return !conflictDateSet.has(targetDate.format("YYYY-MM-DD"));
          });
        }
      }
    }

    const resetWorkoutForCopy = (workout, copyOption) => {
      if (!workout?.training) return;

      switch (copyOption) {
        case "achievedToNewGoal":
          workout.complete = false;
          workout.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.goals.exactReps = exercise.achieved.reps;
              exercise.goals.weight = exercise.achieved.weight;
              exercise.goals.percent = exercise.achieved.percent;
              exercise.goals.seconds = exercise.achieved.seconds;
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "copyGoalOnly":
          workout.complete = false;
          workout.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };

              for (const prop in exercise.achieved) {
                if (Array.isArray(exercise.achieved[prop])) {
                  exercise.achieved[prop] = exercise.achieved[prop].map(() => "0");
                }
              }
            });
          });
          break;
        case "exact":
        default:
          workout.training.forEach((set) => {
            set.forEach((exercise) => {
              exercise.feedback = { difficulty: null, comments: [] };
            });
          });
          break;
      }
    };

    const updatedWorkouts = [];
    const workoutIds = workoutsToProcess.map((workout) => workout._id);
    const previousDates = workoutsToProcess.map((workout) => ({
      id: workout._id,
      date: workout.date,
    }));

    if (action === "move") {
      const bulkOps = workoutsToProcess.map((workout) => ({
        updateOne: {
          filter: { _id: workout._id },
          update: {
            $set: {
              date: targetQueue
                ? null
                : dayjs.utc(workout.date).add(deltaDays, "day").toDate(),
              title: workout.title
                ? `${titlePrefix}${workout.title}${titleSuffix}`
                : workout.title,
            },
          },
        },
      }));

      if (bulkOps.length) {
        await Training.bulkWrite(bulkOps, { ordered: false });
      }
    } else if (action === "copy") {
      const insertDocs = [];
      for (const workout of workoutsToProcess) {
        const copyData = workout.toObject({ depopulate: true });
        copyData._id = new mongoose.Types.ObjectId();
        copyData.isNew = true;
        copyData.date = targetQueue
          ? null
          : dayjs.utc(workout.date).add(deltaDays, "day").startOf("day").toDate();
        const nextUser = newAccount || copyData.user;
        copyData.user =
          mongoose.Types.ObjectId.isValid(nextUser) && !(nextUser instanceof mongoose.Types.ObjectId)
            ? new mongoose.Types.ObjectId(nextUser)
            : nextUser;
        copyData.workoutFeedback = { difficulty: 1, comments: [] };
        if (copyData.title) {
          copyData.title = `${titlePrefix}${copyData.title}${titleSuffix}`;
        }

        resetWorkoutForCopy(copyData, option);

        insertDocs.push(copyData);
      }
      if (insertDocs.length) {
        const insertResult = await Training.collection.insertMany(insertDocs, {
          ordered: false,
        });
        updatedWorkouts.push(
          ...Object.values(insertResult.insertedIds).map((id) => ({ _id: id }))
        );
      }
    } else {
      return res.status(400).json({ error: "Invalid action." });
    }

    const hydratedIds =
      action === "copy" ? updatedWorkouts.map((workout) => workout._id) : workoutIds;
    const hydratedWorkouts = await Training.find({ _id: { $in: hydratedIds } })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

    const responseUserId = action === "copy" ? newAccount || targetUserId : targetUserId;
    const responseUser =
      hydratedWorkouts[0]?.user ??
      (await User.findById(responseUserId).select("_id firstName lastName profilePicture").lean());

    const operation = {
      action,
      userId: responseUserId,
      targetQueue,
      deltaDays,
      affectedIds: workoutIds,
      createdIds: action === "copy" ? hydratedIds : [],
      previousDates,
      timestamp: new Date(),
    };

    return res.send({
      workouts: hydratedWorkouts,
      user: responseUser ?? { _id: responseUserId },
      deletedIds: deletedConflictIds,
      operation,
    });
  } catch (err) {
    console.error("[bulkMoveCopyWorkouts] error:", err);
    return next(err);
  }
};

const get_workouts_by_range = async (req, res, next) => {
  try {
    const { client, rangeStart, rangeEnd, filters = {} } = req.body;
    if (!rangeStart || !rangeEnd) {
      return res.status(400).json({ error: "Range start and end are required." });
    }
    const user = res.locals.user;
    let clientObj;

    if (client && String(client) !== String(user._id)) {
      const relationship = await Relationship.findOne({ trainer: user._id, client })
        .populate({
          path: "client",
          model: "User",
          select: "_id firstName lastName profilePicture",
        });
      if (!relationship || !relationship.accepted) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      clientObj = relationship.client;
    }

    const targetUser = clientObj ?? user;
    const startDate = dayjs.utc(rangeStart).startOf("day").toDate();
    const endDate = dayjs.utc(rangeEnd).endOf("day").toDate();

    const targetUserId = targetUser._id;
    const targetUserObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
      ? new mongoose.Types.ObjectId(targetUserId)
      : null;
    const userMatch = targetUserObjectId ? { $in: [targetUserId, targetUserObjectId] } : targetUserId;

    const workoutQuery = {
      user: userMatch,
      $expr: {
        $and: [
          { $gte: [{ $toDate: "$date" }, startDate] },
          { $lte: [{ $toDate: "$date" }, endDate] },
        ],
      },
    };

    if (filters?.categoriesInclude?.length || filters?.categoriesExclude?.length) {
      workoutQuery.category = {};
      if (filters.categoriesInclude?.length) {
        workoutQuery.category.$in = filters.categoriesInclude;
      }
      if (filters.categoriesExclude?.length) {
        workoutQuery.category.$nin = filters.categoriesExclude;
      }
    }

    if (filters?.includeCompleted === false) {
      workoutQuery.complete = { $ne: true };
    }

    if (filters?.includeTemplates === false) {
      workoutQuery.isTemplate = { $ne: true };
    }

    const workouts = await Training.find(workoutQuery)
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

    return res.send({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

const undo_bulk_move_copy = async (req, res, next) => {
  try {
    const { operation } = req.body;
    if (!operation || !operation.action) {
      return res.status(400).json({ error: "Missing operation." });
    }
    const targetUserId = operation.userId || res.locals.user._id;
    if (String(targetUserId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: targetUserId,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    if (operation.action === "copy") {
      if (operation.createdIds?.length) {
        await Training.deleteMany({ _id: { $in: operation.createdIds } });
      }
      return res.send({ deletedIds: operation.createdIds || [] });
    }

    if (operation.action === "move") {
      const bulkOps = (operation.previousDates || []).map((entry) => ({
        updateOne: {
          filter: { _id: entry.id },
          update: { $set: { date: entry.date } },
        },
      }));
      if (bulkOps.length) {
        await Training.bulkWrite(bulkOps, { ordered: false });
      }
      const workouts = await Training.find({ _id: { $in: operation.affectedIds || [] } })
        .populate({
          path: "training.exercise",
          model: "Exercise",
          select: "_id exerciseTitle",
        })
        .populate({
          path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
          model: "User",
          select: "_id firstName lastName profilePicture",
        });
      return res.send({ workouts });
    }

    return res.status(400).json({ error: "Invalid operation." });
  } catch (err) {
    return next(err);
  }
};

const debug_training_by_ids = async (req, res, next) => {
  try {
    const { ids = [], userId, ignoreUser = false } = req.body;
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ error: "ids array is required." });
    }

    let targetUserId = res.locals.user._id;
    if (userId && String(userId) !== String(res.locals.user._id)) {
      const relationship = await Relationship.findOne({
        trainer: res.locals.user._id,
        client: userId,
        accepted: true,
      });
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      targetUserId = userId;
    }

    const targetUserObjectId = mongoose.Types.ObjectId.isValid(targetUserId)
      ? new mongoose.Types.ObjectId(targetUserId)
      : null;
    const userMatch = targetUserObjectId ? { $in: [targetUserId, targetUserObjectId] } : targetUserId;

    const query = {
      _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
    };
    if (!ignoreUser) {
      query.user = userMatch;
    }

    const trainings = await Training.find(query)
      .select("_id date user title category")
      .lean();

    return res.send({ trainings, count: trainings.length });
  } catch (err) {
    return next(err);
  }
};

const delete_workout_by_id = (req, res, next) => {
  const workoutId = req.body._id;

  const performDeletion = (workoutId, res) => {
    Training.findOneAndDelete({ _id: workoutId })
      .then((data) => {
        if (!data) {
          return res.status(404).json({ error: "Training not found." });
        }
        res.send({ status: "Record deleted" });
      })
      .catch((err) => res.status(500).json({ error: err }));
  };

  Training.findOne({ _id: workoutId })
    .then((data) => {
      if (!data) {
        return res.status(404).json({ error: "Training not found." });
      }

      if (data.user._id.toString() === res.locals.user._id) {
        performDeletion(workoutId, res);
      } else {
        Relationship.findOne({ trainer: res.locals.user._id, client: data.user._id })
          .then((relationship) => {
            if (!relationship || !relationship.accepted) {
              return res.status(403).json({ error: "Unauthorized access." });
            }
            performDeletion(workoutId, res);
          })
          .catch((err) => next(err));
      }
    })
    .catch((err) => res.status(500).json({ error: err }));
};

const workout_history_request = async (req, res, next) => {
  const page = parseInt(req.body.page) || 1;
  const limit = 15;
  const user = res.locals.user._id;

  try {
    const options = {
      page,
      limit,
      sort: { date: -1 },
    };

    const result = await Training.paginate({ user }, options);

    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const workout_month_request = async (req, res, next) => {
  try {
    const { client, date } = req.body;
    const user = res.locals.user;

    const base = dayjs(date).utc();
    const startDate = base.startOf("month").toDate();
    const endDate   = base.startOf("month").add(1, "month").toDate();

    let targetUser = user;

    if (client._id !== user._id) {
      const relationship = await Relationship.findOne({
        trainer: user._id,
        client,
        accepted: true,
      }).populate({
        path: "client",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }

      targetUser = relationship.client;
    }

    const workouts = await Training.find({
      user: targetUser._id,
      date: { $gte: startDate, $lt: endDate },
    })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .lean();

    return res.json({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

const workout_templates_request = async (req, res, next) => {
  try {
    const user = res.locals.user;
    const { includeShared } = req.body;

    // Get user's own templates
    const ownWorkouts = await Training.find({
      user: user._id,
      isTemplate: true,
    })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user",
        model: "User",
        select: "_id firstName lastName",
      })
      .lean();

    // Mark own workouts
    const ownWithFlag = ownWorkouts.map((w) => ({ ...w, isOwn: true }));

    if (!includeShared) {
      return res.json({ workouts: ownWithFlag, user });
    }

    // Get connected trainer IDs with template permissions
    const TrainerConnection = require("../models/trainerConnection");
    const connections = await TrainerConnection.find({
      $or: [{ requester: user._id }, { recipient: user._id }],
      status: "accepted",
      permissions: "templates",
    }).lean();

    const connectedTrainerIds = connections.map((c) =>
      c.requester.toString() === user._id.toString() ? c.recipient : c.requester
    );

    if (connectedTrainerIds.length === 0) {
      return res.json({ workouts: ownWithFlag, user });
    }

    // Get shared templates from connected trainers
    const sharedWorkouts = await Training.find({
      user: { $in: connectedTrainerIds },
      isTemplate: true,
    })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .populate({
        path: "user",
        model: "User",
        select: "_id firstName lastName",
      })
      .lean();

    const sharedWithFlag = sharedWorkouts.map((w) => ({ ...w, isOwn: false, isShared: true }));

    return res.json({ workouts: [...ownWithFlag, ...sharedWithFlag], user });
  } catch (err) {
    return next(err);
  }
};

const workout_year_request = async (req, res, next) => {
  try {
    const { client, year } = req.body;
    const user = res.locals.user;

    const base = dayjs(`${year}-01-01`).utc();
    const startDate = base.startOf("year").toDate();
    const endDate = base.startOf("year").add(1, "year").toDate();

    let targetUser = user;

    if (client._id !== user._id) {
      const relationship = await Relationship.findOne({
        trainer: user._id,
        client,
        accepted: true,
      }).populate({
        path: "client",
        model: "User",
        select: "_id firstName lastName profilePicture",
      });

      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }

      targetUser = relationship.client;
    }

    const workouts = await Training.find({
      user: targetUser._id,
      date: { $gte: startDate, $lt: endDate },
    })
      .populate({
        path: "user workoutFeedback.comments.user workoutFeedback.comments.deletedBy training.feedback.comments.user training.feedback.comments.deletedBy",
        model: "User",
        select: "_id firstName lastName profilePicture",
      })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .lean();

    return res.json({ workouts, user: targetUser });
  } catch (err) {
    return next(err);
  }
};

const checkClientRelationship = (trainerId, clientId) => {
  return Relationship.findOne({ trainer: trainerId, client: clientId })
    .then((relationship) => {
      if (!relationship) {
        return { error: "Relationship does not exist." };
      } else if (relationship.accepted) {
        return { accepted: true, relationship };
      } else {
        return { error: "Relationship pending." };
      }
    })
    .catch((err) => {
      throw err;
    });
};

module.exports = {
  create_training,
  update_training,
  get_training_by_id,
  get_workouts_by_date,
  get_weekly_training,
  get_exercise_list,
  get_exercise_history,
  copy_workout_by_id,
  delete_workout_by_id,
  workout_history_request,
  workout_month_request,
  workout_year_request,
  workout_templates_request,
  get_workout_queue,
  update_workout_date_by_id,
  get_training_range_end,
  bulk_move_copy_workouts,
  get_workouts_by_range,
  undo_bulk_move_copy,
  debug_training_by_ids,
};
