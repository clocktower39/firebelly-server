const {
  Exercise,
  Relationship,
  ScheduleEvent,
  TRAINING_UPDATE_FIELDS,
  Training,
  User,
  canWriteUserResource,
  checkClientRelationship,
  createEventDebitEntry,
  dayjs,
  mongoose,
  pick,
  reverseEventDebitEntry,
} = require("./context");

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

const update_training = async (req, res, next) => {
  try {
    const existing = await Training.findById(req.body._id).lean();
    if (!existing) {
      return res.status(404).json({ error: "Training not found." });
    }

    const canWrite = await canWriteUserResource(res.locals.user, existing.user);
    if (!canWrite) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const updates = pick(req.body.training, TRAINING_UPDATE_FIELDS);
    const training = await Training.findByIdAndUpdate(
      req.body._id,
      { $set: updates },
      { returnDocument: "after" }
    )
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

    if (!training) {
      return res.status(404).json({ error: "Training not found." });
    }

    const wasComplete = !!existing.complete;
    const isComplete = !!training.complete;
    if (wasComplete !== isComplete) {
      const event = await ScheduleEvent.findOne({ workoutId: training._id });
      if (event && event.eventType === "APPOINTMENT" && event.status !== "CANCELLED") {
        if (isComplete) {
          const eventUpdates = { status: "COMPLETED" };
          if (!event.billingStatus || event.billingStatus === "UNBILLED") {
            eventUpdates.billingStatus = "CHARGED";
          }
          const updatedEvent = await ScheduleEvent.findByIdAndUpdate(event._id, eventUpdates, {
            returnDocument: "after",
          });
          if (updatedEvent?.billingStatus === "CHARGED") {
            await createEventDebitEntry({
              event: updatedEvent,
              userId: res.locals.user._id,
              source: "APPOINTMENT",
            });
          } else {
            await reverseEventDebitEntry({ event: updatedEvent, userId: res.locals.user._id });
          }
        } else if (event.status === "COMPLETED") {
          const updatedEvent = await ScheduleEvent.findByIdAndUpdate(
            event._id,
            { status: "BOOKED" },
            { returnDocument: "after" }
          );
          await reverseEventDebitEntry({ event: updatedEvent, userId: res.locals.user._id });
        }
      }
    }

    const accountId = String(training.user?._id || training.user);
    global.io?.to(`workouts:${accountId}`).emit("workoutUpdated", {
      workoutId: String(training._id),
      accountId,
      workout: training,
    });

    return res.send({ training });
  } catch (err) {
    return next(err);
  }
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

const get_exercise_progress_summary = async (req, res, next) => {
  try {
    const { user } = req.body;
    const targetUserId = typeof user === "object" ? user?._id : user;

    if (!targetUserId || !mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: "A valid user is required." });
    }

    const relationship = await checkClientRelationship(res.locals.user._id, targetUserId);
    const canView = String(res.locals.user._id) === String(targetUserId) || relationship?.accepted;

    if (!canView) {
      return res.status(403).json({ error: "Restricted" });
    }

    const workouts = await Training.find({ user: targetUserId })
      .select("date training")
      .populate({
        path: "training.exercise",
        select: "_id exerciseTitle",
      })
      .lean();

    const summariesByExercise = new Map();

    workouts.forEach((workout) => {
      const workoutDate = workout.date;
      workout.training?.forEach((set) => {
        set?.forEach((item) => {
          const exercise = item.exercise;
          const exerciseId = exercise?._id ? String(exercise._id) : String(exercise || "");
          if (!exerciseId || exerciseId === "null" || exerciseId === "undefined") return;

          const exerciseTitle = exercise?.exerciseTitle || item.exerciseTitle || "Exercise";
          const existing =
            summariesByExercise.get(exerciseId) || {
              exercise: { _id: exerciseId, exerciseTitle },
              entryCount: 0,
              latestDate: null,
              historyPreview: [],
            };

          const dateValue = workoutDate ? dayjs.utc(workoutDate).valueOf() : 0;
          const latestValue = existing.latestDate ? dayjs.utc(existing.latestDate).valueOf() : 0;

          existing.entryCount += 1;
          existing.exercise.exerciseTitle = exerciseTitle;
          if (dateValue >= latestValue) {
            existing.latestDate = workoutDate;
          }
          existing.historyPreview.push({
            date: workoutDate,
            exerciseType: item.exerciseType,
            achieved: item.achieved,
          });

          summariesByExercise.set(exerciseId, existing);
        });
      });
    });

    const summaries = Array.from(summariesByExercise.values())
      .map((summary) => ({
        ...summary,
        historyPreview: summary.historyPreview
          .filter((entry) => entry.date)
          .sort((a, b) => dayjs.utc(a.date).valueOf() - dayjs.utc(b.date).valueOf())
          .slice(-12),
      }))
      .sort((a, b) => dayjs.utc(b.latestDate).valueOf() - dayjs.utc(a.latestDate).valueOf());

    return res.send(summaries);
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_training,
  update_training,
  get_training_by_id,
  get_workout_queue,
  get_workouts_by_date,
  get_weekly_training,
  get_exercise_list,
  get_exercise_history,
  get_exercise_progress_summary
};
