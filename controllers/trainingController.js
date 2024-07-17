const Training = require("../models/training");
const Relationship = require("../models/relationship");
const mongoose = require("mongoose");
const dayjs = require("dayjs");

const create_training = (req, res, next) => {
  let training = new Training({
    ...req.body,
    user: res.locals.user._id,
  });
  let saveTraining = () => {
    training.save((err) => {
      if (err) return next(err);
      res.send({
        status: "success",
        training,
      });
    });
  };
  saveTraining();
};

const update_training = (req, res, next) => {
  Training.findByIdAndUpdate(
    req.body._id,
    { ...req.body.training },
    { new: true },
    (err, training) => {
      if (err) return next(err);
      else {
        res.send({ training });
      }
    }
  );
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
    .exec(function (err, data) {
      if (err) return next(err);

      if (!data) {
        return res.status(404).json({ error: "Training not found." });
      }

      // Check if the user requesting the data is the owner
      if (data.user._id.toString() === res.locals.user._id) {
        return res.send(data);
      }

      // If not the owner, check the relationship
      Relationship.findOne(
        { trainer: res.locals.user._id, client: data.user._id },
        (relationshipErr, relationship) => {
          if (relationshipErr) return next(relationshipErr);

          if (!relationship || !relationship.accepted) {
            return res.status(403).json({ error: "Unauthorized access." });
          }

          // If the relationship is accepted, send the data
          res.send(data);
        }
      );
    });
};

const get_workout_queue = (req, res, next) => {
  Training.find(
    { user: res.locals.user._id, $or: [{ date: null }, { date: { $exists: false } }] },
    function (err, data) {
      if (err) return next(err);
      res.send(data);
    }
  );
};

const get_workouts_by_date = (req, res, next) => {
  Training.find({ user: res.locals.user._id, date: req.body.date }, function (err, data) {
    if (err) return next(err);
    res.send(data);
  });
};

const get_weekly_training = (req, res, next) => {
  const selectedDate = new Date(req.body.date);
  const startDate = new Date(selectedDate);
  startDate.setDate(startDate.getDate() - 7);
  const endDate = new Date(selectedDate);
  endDate.setDate(endDate.getDate() + 1);

  Training.find(
    {
      date: {
        $gte: startDate,
        $lt: endDate,
      },
      user: res.locals.user._id,
    },
    function (err, data) {
      if (err) return next(err);
      res.send(data);
    }
  );
};

const get_list_every_exercise = (req, res, next) => {
  Training.find({})
    .populate({
      path: "user",
      model: "User",
      select: "_id firstName lastName profilePicture"
    })
    .exec(function (err, data) {
      if (err) return next(err);

      let exerciseCounts = {};

      data.forEach((day) => {
        day.training.forEach((set) => {
          set.forEach((exercise) => {
            if (exercise.exercise) {
              let exerciseName = exercise.exercise;
              if (!exerciseCounts[exerciseName]) {
                exerciseCounts[exerciseName] = {
                  count: 0,
                  dates: [],
                  uniqueUsers: new Set(),  // Using a Set to track unique user IDs
                  users: []  // This will store the user objects for unique users
                };
              }

              exerciseCounts[exerciseName].count++;
              exerciseCounts[exerciseName].dates.push({
                date: day.date,
                user: day.user
              });

              // Check and add unique user
              const userId = day.user?._id.toString();
              if (!exerciseCounts[exerciseName].uniqueUsers.has(userId)) {
                exerciseCounts[exerciseName].uniqueUsers.add(userId);
                exerciseCounts[exerciseName].users.push(day.user);
              }
            }
          });
        });
      });

      // Convert to array and sort by count
      let exerciseList = Object.keys(exerciseCounts).map((key) => {
        const exercise = exerciseCounts[key];
        return {
          exercise: key,
          count: exercise.count,
          dates: exercise.dates,
          users: exercise.users  // Include unique users for each exercise
        };
      }).sort((a, b) => b.count - a.count);

      // Clean up to not send Set object
      res.send(exerciseList.map(ex => ({
        exercise: ex.exercise,
        count: ex.count,
        dates: ex.dates,
        users: ex.users
      })));
    });
};

const get_exercise_list = (req, res, next) => {
  Training.find({ user: res.locals.user._id }, function (err, data) {
    if (err) return next(err);

    let exerciseList = [];

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
  });
};

const get_exercise_history = (req, res, next) => {
  Training.find({ user: res.locals.user._id }, function (err, data) {
    if (err) return next(err);

    let historyList = [];

    data.map((day) => {
      day.training.map((set) => {
        let targetedExercise = set.filter(
          (exercise) => exercise?.exercise?.toLowerCase() === req.body.targetExercise.toLowerCase()
        );
        if (targetedExercise.length > 0) {
          historyList.push({ ...targetedExercise[0], date: day.date });
        }
      });
    });
    res.send(historyList);
  })
    .lean()
    .exec();
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
        data.training.map((set) => {
          set.map((exercise) => {
            // Loop through and move correlated achieved to goals
            // Still need to restructure training model and remove unused properties
            exercise.goals.exactReps = exercise.achieved.reps;
            exercise.goals.weight = exercise.achieved.weight;
            exercise.goals.percent = exercise.achieved.percent;
            exercise.goals.seconds = exercise.achieved.seconds;
            exercise.notes = [];

            for (const prop in exercise.achieved) {
              if (Array.isArray(exercise.achieved[prop])) {
                exercise.achieved[prop] = exercise.achieved[prop].map((v) => {
                  return "0";
                });
              }
            }
            return exercise;
          });
          return set;
        });
        break;
      case "copyGoalOnly":
        data.training.map((set) => {
          set.map((exercise) => {
            exercise.notes = [];
            for (const prop in exercise.achieved) {
              if (Array.isArray(exercise.achieved[prop])) {
                exercise.achieved[prop] = exercise.achieved[prop].map((v) => {
                  return "0";
                });
              }
            }
            return exercise;
          });
          return set;
        });
        break;
      case "exact":
        data.training.map((set) => {
          set.map((exercise) => {
            exercise.notes = [];
            return exercise;
          });
          return set;
        });
        break;
    }

    data._id = mongoose.Types.ObjectId();
    data.isNew = true;
    data.date = newDate;
    data.save((err) => {
      if (err) return next(err);
      res.send({
        status: "Copy Successful",
      });
    });
  };

  Training.findOne({ _id }, function (err, data) {
    if (err) return next(err);

    // Check if the user requesting the data is the owner
    if (data.user._id.toString() === res.locals.user._id) {
      return modifyWorkout(data, newDate, _id, option, newTitle, newAccount);
    }

    // If not the owner, check the relationship
    Relationship.findOne(
      { trainer: res.locals.user._id, client: data.user._id },
      (relationshipErr, relationship) => {
        if (relationshipErr) return next(relationshipErr);

        if (!relationship || !relationship.accepted) {
          return res.status(403).json({ error: "Unauthorized access." });
        }

        // If the relationship is accepted, send the data
        modifyWorkout(data, newDate, _id, option, newTitle, newAccount);
      }
    );
  });
};

const delete_workout_by_id = (req, res, next) => {
  const workoutId = req.body._id;

  const performDeletion = (workoutId, res) => {
    Training.findOneAndDelete({ _id: workoutId }, (err, data) => {
      if (err) {
        return res.status(500).json({ error: err });
      }

      if (!data) {
        return res.status(404).json({ error: "Training not found." });
      }

      res.send({ status: "Record deleted" });
    });
  };

  Training.findOne({ _id: workoutId }, (err, data) => {
    if (err) {
      return res.status(500).json({ error: err });
    }

    if (!data) {
      return res.status(404).json({ error: "Training not found." });
    }

    // Check if the user requesting the deletion is the owner
    if (data.user._id.toString() === res.locals.user._id) {
      performDeletion(workoutId, res);
    } else {
      // If not the owner, check the relationship
      Relationship.findOne(
        { trainer: res.locals.user._id, client: data.user._id },
        (relationshipErr, relationship) => {
          if (relationshipErr) return next(relationshipErr);

          if (!relationship || !relationship.accepted) {
            return res.status(403).json({ error: "Unauthorized access." });
          }

          // If the relationship is accepted, perform the deletion
          performDeletion(workoutId, res);
        }
      );
    }
  });
};

const workout_history_request = async (req, res, next) => {
  const page = parseInt(req.body.page) || 1; // Get the requested page number from the request body
  const limit = 15; // Set the number of trainings per page
  const user = res.locals.user._id;

  try {
    const options = {
      page,
      limit,
      sort: { date: -1 }, // Sort by date in descending order to get the most recent trainings first
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
    // Parse the date sent by the client
    const clientDate = dayjs(req.body.date);

    // Convert the client's date to UTC
    const clientDateUTC = clientDate.utc();

    // Extract the year and month from the client's date
    const year = clientDateUTC.year();
    const month = clientDateUTC.month() + 1; // Adding 1 because months are zero-indexed

    // Use dayjs to construct a range for the specified month and year
    const startDate = dayjs.utc(`${year}-${month}-01`);
    const endDate = startDate.endOf("month");

    // Query the Training collection to find entries within the specified month and year
    const data = await Training.find({
      user: isClientRequest ? user : trainer,
      date: {
        $gte: startDate.toDate(), // Greater than or equal to the start of the month in UTC
        $lte: endDate.toDate(), // Less than or equal to the end of the month in UTC
      },
    });

    // If the user is the owner, or if it's a client request and the relationship is accepted, send the data
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
  const { incorrectExercise, correctExercise } = req.body;

  try {
    const data = await Training.find({ });

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

    // Save the modified documents back to the database
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

    // Save the modified documents back to the database
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
  // try {
  //   const relationshipResult = await checkClientRelationship(
  //     res.locals.user._id,
  //     req.body.client
  //   );

  //   if (relationshipResult.accepted) {
  // insert function here
  //   } else {
  //     res.send(relationshipResult);
  //   }
  // } catch (error) {
  //   next(error);
  // }

  return new Promise((resolve, reject) => {
    Relationship.findOne({ trainer: trainerId, client: clientId }, (err, relationship) => {
      if (err) {
        reject(err);
      } else if (!relationship) {
        resolve({ error: "Relationship does not exist." });
      } else if (relationship.accepted) {
        resolve({ accepted: true, relationship });
      } else {
        resolve({ error: "Relationship pending." });
      }
    });
  });
};

module.exports = {
  create_training,
  get_training_by_id,
  get_workout_queue,
  get_workouts_by_date,
  update_training,
  get_weekly_training,
  get_list_every_exercise,
  get_exercise_list,
  get_exercise_history,
  copy_workout_by_id,
  update_workout_date_by_id,
  delete_workout_by_id,
  workout_history_request,
  workout_month_request,
  update_master_exercise_name,
  update_exercise_name,
};
