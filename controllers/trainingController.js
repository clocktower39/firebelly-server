const Training = require("../models/training");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const Exercise = require("../models/exercise");

const create_training = (req, res, next) => {
  let training = new Training({
    ...req.body,
    user: res.locals.user._id,
  });
  training
    .save()
    .then((training) => {
      res.send({
        status: "success",
        training,
      });
    })
    .catch((err) => next(err));
};

const update_training = (req, res, next) => {
  Training.findByIdAndUpdate(req.body._id, { ...req.body.training }, { new: true })
    .then((training) => {
      res.send({ training });
    })
    .catch((err) => next(err));
};

const get_training_by_id = (req, res, next) => {
  Training.findOne({ _id: req.body._id })
    .populate({
      path: "training.notes.user",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .populate({
      path: "user",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
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

const get_workout_queue = (req, res, next) => {
  Training.find({ user: res.locals.user._id, $or: [{ date: null }, { date: { $exists: false } }] })
    .populate({
      path: "training.exercise",
      select: "_id exerciseTitle",
    })
    .then((data) => res.send(data))
    .catch((err) => next(err));
};

const get_workouts_by_date = (req, res, next) => {
  Training.find({ user: res.locals.user._id, date: req.body.date })
    .populate({
      path: "user",
      model: "User",
      select: "_id firstName lastName profilePicture",
    })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .then((data) => res.send(data))
    .catch((err) => next(err));
};

const get_weekly_training = (req, res, next) => {
  const selectedDate = new Date(req.body.date);
  const startDate = new Date(selectedDate);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(selectedDate);
  endDate.setDate(endDate.getDate() + 1);

  Training.find({
    date: {
      $gte: startDate,
      $lt: endDate,
    },
    user: res.locals.user._id,
  })
    .populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    })
    .then((data) => res.send(data))
    .catch((err) => next(err));
};

const get_list_every_exercise = (req, res, next) => {
  // Training.find({})
  //   .populate({
  //     path: "user",
  //     model: "User",
  //     select: "_id firstName lastName profilePicture",
  //   })
  //   .then((data) => {
  //     let exerciseCounts = {};

  //     data.forEach((day) => {
  //       day.training.forEach((set) => {
  //         set.forEach((exercise) => {
  //           if (exercise.exercise) {
  //             let exerciseName = exercise.exercise;
  //             if (!exerciseCounts[exerciseName]) {
  //               exerciseCounts[exerciseName] = {
  //                 count: 0,
  //                 dates: [],
  //                 uniqueUsers: new Set(),
  //                 users: [],
  //               };
  //             }

  //             exerciseCounts[exerciseName].count++;
  //             exerciseCounts[exerciseName].dates.push({
  //               date: day.date,
  //               user: day.user,
  //               trainingId: day._id,
  //             });

  //             const userId = day.user?._id.toString();
  //             if (!exerciseCounts[exerciseName].uniqueUsers.has(userId)) {
  //               exerciseCounts[exerciseName].uniqueUsers.add(userId);
  //               exerciseCounts[exerciseName].users.push(day.user);
  //             }
  //           }
  //         });
  //       });
  //     });

  //     let exerciseList = Object.keys(exerciseCounts)
  //       .map((key) => {
  //         const exercise = exerciseCounts[key];
  //         return {
  //           exercise: key,
  //           count: exercise.count,
  //           dates: exercise.dates,
  //           users: exercise.users,
  //         };
  //       })
  //       .sort((a, b) => b.count - a.count);

  // --- this works for creating the exercise library ---

  // const exerciseTitleList = exerciseList.map(ex => ex.exercise);
  // exerciseTitleList.forEach(exerciseTitle => {
  //   // create exercise library entry

  //     let exercise = new Exercise({
  //       exerciseTitle,
  //     });
  //     let saveExercise = () => {
  //       exercise.save()
  //       .then(()=> console.log(`created ${exerciseTitle}`))
  //       .catch((err) => next(err));
  //     };
  //     saveExercise();

  // })

  // Exercise.find({})
  //   .then((exercises) => {
  //     // Convert array of exercises into a lookup map for quick retrieval by exerciseTitle
  //     const exerciseMap = {};
  //     exercises.forEach((ex) => {
  //       exerciseMap[ex.exerciseTitle] = ex._id;
  //     });

  //     console.log("Exercise map keys:", Object.keys(exerciseMap));

  //     Training.find({})
  //       .then(async (trainings) => {
  //         for (const workout of trainings) {
  //           let modified = false;

  //           // Assuming workout.training is an array of circuits, and each circuit is an array of exercises
  //           for (const circuit of workout.training) {
  //             for (const exercise of circuit) {
  //               console.log(exercise.exercise);

  //               const exerciseName = exercise.exercise;
  //               if (exerciseMap[exerciseName]) {
  //                 exercise.exercise = new mongoose.Types.ObjectId(exerciseMap[exerciseName]);
  //                 modified = true;
  //                 console.log("modified:", exercise.exercise);
  //               } else {
  //                 console.warn(`Not found: ${exerciseName}`);
  //               }
  //             }
  //           }

  //           if (modified) {
  //             await workout.save();
  //           }
  //         }
  //       })
  //       .catch((err) => {
  //         console.error(err);
  //         next(err);
  //       });
  //   })
  //   .catch((err) => {
  //     console.error(err);
  //     next(err);
  //   });

  // res.send(
    // exerciseList.map((ex) => ({
    //   exercise: ex.exercise,
    //   count: ex.count,
    //   dates: ex.dates,
    //   users: ex.users,
    // }))
  // );
  // })
  // .catch((err) => next(err));
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
  const targetExerciseId = new mongoose.Types.ObjectId(targetExercise._id)
  
  Training.find({ 
    user: user._id,
    training: {
      $elemMatch: {
        $elemMatch: { exercise: targetExerciseId }
      }
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
            let targetedExercise = set.filter(
              (exercise) =>
              {
                return exercise.exercise._id.equals(targetExerciseId)
              }
            );
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
  const updateWorkoutDate = async (training, newDate) => {
    try {
      training.date = newDate;
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
      const updatedTraining = await updateWorkoutDate(training, req.body.newDate);
      return res.send(updatedTraining);
    }

    // If not the owner, check the relationship
    const relationship = await checkClientRelationship(res.locals.user._id, training.user._id);

    if (relationship && relationship.accepted) {
      // If the relationship is accepted, update the workout date
      const updatedTraining = await updateWorkoutDate(training, req.body.newDate);
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
            exercise.notes = [];

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
            exercise.notes = [];
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
            exercise.notes = [];
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
    data
      .save()
      .then(() => {
        res.send({
          status: "Copy Successful",
        });
      })
      .catch((err) => next(err));
  };

  Training.findOne({ _id })
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
  const isClientRequest = req.body.client !== undefined;

  const user = isClientRequest ? req.body.client : res.locals.user._id;
  const trainer = res.locals.user._id;

  try {
    const clientDate = dayjs(req.body.date);
    const clientDateUTC = clientDate.utc();

    const year = clientDateUTC.year();
    const month = clientDateUTC.month() + 1;

    const startDate = dayjs.utc(`${year}-${month}-01`);
    const endDate = startDate.endOf("month");

    const data = await Training.find({
      user: isClientRequest ? user : trainer,
      date: {
        $gte: startDate.toDate(),
        $lte: endDate.toDate(),
      },
    }).populate({
      path: "training.exercise",
      model: "Exercise",
      select: "_id exerciseTitle",
    });

    if (user === trainer || (isClientRequest && (await checkClientRelationship(trainer, user)))) {
      res.json(data);
    } else {
      res.status(403).json({ error: "Unauthorized access." });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const update_master_exercise_name = async (req, res, next) => {
  const { incorrectExercise, correctExercise, trainingIdList } = req.body;

  if (
    res.locals.user._id.toString() !== "612198502f4d5273b466b4e4" &&
    res.locals.user._id.toString() !== "613d0935341e9f055c320d81"
  ) {
    return res.status(403).send({ error: "Restricted" });
  }

  try {
    const objectIdList = trainingIdList.map((id) => new mongoose.Types.ObjectId(id));

    const data = await Training.find({ _id: { $in: objectIdList } });

    const changelog = [];

    data.forEach((day) => {
      day.training.forEach((set) => {
        set.forEach((exercise) => {
          if (exercise.exercise === incorrectExercise) {
            changelog.push(`${day.date} | ${exercise.exercise}`);
            exercise.exercise = correctExercise;
          }
        });
      });
    });

    const savePromises = data.map((day) => day.save());
    await Promise.all(savePromises);

    res.send({
      statusCode: 200,
      details: {
        body: [
          {
            message: "Exercises updated successfully",
            removed: incorrectExercise,
          },
        ],
      },
    });
  } catch (err) {
    console.error("Error occurred:", err);
    return next(err);
  }
};

const update_exercise_name = async (req, res, next) => {
  const { incorrectExercise, correctExercise } = req.body;

  try {
    const data = await Training.find({ user: res.locals.user._id });

    const changelog = [];

    data.forEach((day) => {
      day.training.forEach((set) => {
        set.forEach((exercise) => {
          if (exercise.exercise === incorrectExercise) {
            changelog.push(`${day.date} | ${exercise.exercise}`);
            exercise.exercise = correctExercise;
          }
        });
      });
    });

    const savePromises = data.map((day) => day.save());
    await Promise.all(savePromises);

    res.send({
      statusCode: 200,
      details: {
        body: [
          {
            message: "Exercises updated successfully",
            removed: incorrectExercise,
          },
        ],
      },
    });
  } catch (err) {
    console.error("Error occurred:", err);
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
  get_workout_queue,
  get_workouts_by_date,
  get_weekly_training,
  get_list_every_exercise,
  get_exercise_list,
  get_exercise_history,
  copy_workout_by_id,
  delete_workout_by_id,
  workout_history_request,
  workout_month_request,
  update_master_exercise_name,
  update_exercise_name,
  update_workout_date_by_id,
};
