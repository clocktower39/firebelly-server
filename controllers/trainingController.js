const Training = require("../models/training");
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const Exercise = require("../models/exercise");

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

  Training.find({ user: targetUser, date: req.body.date })
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

const copy_workout_by_id = (req, res, next) => {
  const { newDate, _id, option = "exact", newTitle, newAccount } = req.body;

  const modifyWorkout = (data, newDate, _id, option, newTitle, newAccount) => {
    if (newTitle) data.title = newTitle;
    if (newAccount) data.user = newAccount;

    switch (option) {
      case "achievedToNewGoal":
        data.complete = false;
        data.training.forEach((set) => {
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
        data.complete = false;
        data.training.forEach((set) => {
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
        data.training.forEach((set) => {
          set.forEach((exercise) => {
            exercise.feedback = { difficulty: null, comments: [] };
          });
        });
        break;
    }
    data.training.forEach((set) => {
      set.forEach((exercise) => {
        exercise.exercise = exercise.exercise;
      });
    });


    data._id = new mongoose.Types.ObjectId();
    data.isNew = true;
    data.date = newDate;
    data.workoutFeedback = { difficulty: 1, comments: [] };
    data
      .save()
      .then((workoutCopy) => {
        res.send(workoutCopy);
      })
      .catch((err) => next(err));
  };

  Training.findOne({ _id })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .populate({
      path: "user",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .then((data) => {
      if (!data) return res.status(404).json({ error: "Training not found." });

      if (data.user._id.toString() === res.locals.user._id) {
        return modifyWorkout(data, newDate, _id, option, newTitle, newAccount);
      }

      Relationship.findOne({ trainer: res.locals.user._id, client: data.user._id })
        .then((relationship) => {
          if (!relationship || !relationship.accepted) {
            return res.status(403).json({ error: "Unauthorized access." });
          }
          modifyWorkout(data, newDate, _id, option, newTitle, newAccount);
        })
        .catch((err) => next(err));
    })
    .catch((err) => next(err));
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

    const workouts = await Training.find({
      user: user._id,
      isTemplate: true,
    })
      .populate({
        path: "training.exercise",
        model: "Exercise",
        select: "_id exerciseTitle",
      })
      .lean();

    return res.json({ workouts, user });
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
};
