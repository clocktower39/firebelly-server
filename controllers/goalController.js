const Goal = require("../models/goal");
const Relationship = require("../models/relationship");
const Training = require("../models/training");
const mongoose = require("mongoose");

// Helper function to check if a strength goal has been achieved
const checkStrengthGoalAchievement = async (userId, exerciseId, targetReps, targetWeight) => {
  const exerciseObjectId = new mongoose.Types.ObjectId(exerciseId);

  const workouts = await Training.find({
    user: userId,
    "training": {
      $elemMatch: {
        $elemMatch: { exercise: exerciseObjectId }
      }
    }
  }).sort({ date: 1 }).lean();

  let achieved = false;
  let achievedDate = null;

  for (const workout of workouts) {
    for (const circuit of workout.training) {
      for (const exerciseEntry of circuit) {
        if (exerciseEntry.exercise?.toString() === exerciseId) {
          const achievedReps = exerciseEntry.achieved?.reps || [];
          const achievedWeights = exerciseEntry.achieved?.weight || [];

          for (let i = 0; i < achievedReps.length; i++) {
            if (achievedReps[i] >= targetReps && achievedWeights[i] >= targetWeight) {
              achieved = true;
              achievedDate = workout.date;
              return { achieved, achievedDate };
            }
          }
        }
      }
    }
  }

  return { achieved, achievedDate };
};

const create_goal = (req, res, next) => {
  let goal = new Goal({
    ...req.body,
    createdDate: new Date(),
    user: res.locals.user._id,
  });

  goal
    .save()
    .then((savedGoal) =>
      Goal.findById(savedGoal._id).populate("comments.user", "firstName lastName profilePicture")
    )
    .then((populatedGoal) => {
      res.send(populatedGoal);
    })
    .catch((err) => next(err));
};

const remove_goal = (req, res, next) => {
  Goal.findOneAndDelete({ user: res.locals.user._id, _id: req.body.goalId })
    .then((data) => {
      if (!data) {
        return res.status(404).send({ error: "Goal not found" });
      }
      res.send({ status: "Record deleted" });
    })
    .catch((err) => next(err));
};

const update_goal = (req, res, next) => {
  const {
    title,
    description,
    category,
    exercise,
    targetWeight,
    targetReps,
    achievedDate,
    targetDate,
    distanceUnit,
    distanceValue,
    goalTime,
    goalWeight,
  } = req.body;

  Goal.findByIdAndUpdate(
    req.body._id,
    {
      title,
      description,
      category,
      exercise,
      targetWeight,
      targetReps,
      achievedDate,
      targetDate,
      distanceUnit,
      distanceValue,
      goalTime,
      goalWeight,
    },
    { new: true }
  )
    .populate("exercise", "_id exerciseTitle")
    .then((goal) => {
      if (!goal) {
        return res.status(404).send({ error: "Goal not found" });
      }
      res.send(goal);
    })
    .catch((err) => next(err));
};

const comment_on_goal = (req, res, next) => {
  const { comment } = req.body;
  Goal.findById(req.body._id)
    .then((goal) => {
      if (!goal) {
        return res.status(404).send({ error: "Goal not found" });
      }
      const newComment = {
        createdDate: new Date(),
        comment,
        user: res.locals.user._id,
      };
      goal.comments ? goal.comments.push(newComment) : (goal.comments = [newComment]);

      return goal.save();
    })
    .then((savedGoal) =>
      Goal.findById(savedGoal._id).populate("comments.user", "firstName lastName profilePicture")
    )
    .then((populatedGoal) => {
      res.send(populatedGoal);
    })
    .catch((err) => next(err));
};

const remove_comment = (req, res, next) => {
  const { _id, commentId } = req.body;
  Goal.findById(_id)
    .then((goal) => {
      if (!goal) {
        return res.status(404).send({ error: "Goal not found" });
      }
      const targetComment = goal.comments?.id(commentId);
      if (!targetComment) {
        return res.status(404).send({ error: "Comment not found" });
      }
      if (String(targetComment.user) !== String(res.locals.user._id)) {
        return res.status(403).send({ error: "Not authorized to delete this comment" });
      }
      goal.comments.pull(commentId);
      return goal.save();
    })
    .then((savedGoal) =>
      Goal.findById(savedGoal._id).populate("comments.user", "firstName lastName profilePicture")
    )
    .then((populatedGoal) => {
      res.send(populatedGoal);
    })
    .catch((err) => next(err));
};

const get_goals = async (req, res, next) => {
  try {
    const goals = await Goal.find({ user: res.locals.user._id })
      .populate("comments.user", "firstName lastName profilePicture")
      .populate("exercise", "_id exerciseTitle");

    // Check strength goals for achievement
    for (const goal of goals) {
      if (goal.category === "Strength" && goal.exercise && goal.targetWeight && goal.targetReps && !goal.achievedDate) {
        const result = await checkStrengthGoalAchievement(res.locals.user._id, goal.exercise._id.toString(), goal.targetReps, goal.targetWeight);
        if (result.achieved) {
          goal.achievedDate = result.achievedDate;
          goal.achievementSeen = false;
          await goal.save();
        }
      }
    }

    res.send(goals || { results: "No Results" });
  } catch (err) {
    next(err);
  }
};

const get_client_goals = (req, res, next) => {
  const { client } = req.body;
  Relationship.findOne({ trainer: res.locals.user._id, client })
    .then((relationship) => {
      if (!relationship) {
        res.send({ error: "Relationship does not exist." });
      } else if (relationship.accepted) {
        Goal.find({ user: client })
          .populate("comments.user", "firstName lastName profilePicture")
          .populate("exercise", "_id exerciseTitle")
          .then((data) => {
            res.send(data);
          })
          .catch((err) => next(err));
      } else {
        res.send({ error: "Relationship pending." });
      }
    })
    .catch((err) => next(err));
};

const get_exercise_max_at_reps = async (req, res, next) => {
  try {
    const { exerciseId, targetReps } = req.body;
    const userId = res.locals.user._id;

    if (!exerciseId || !targetReps) {
      return res.status(400).json({ error: "exerciseId and targetReps are required" });
    }

    const exerciseObjectId = new mongoose.Types.ObjectId(exerciseId);

    // Find all workouts containing this exercise
    const workouts = await Training.find({
      user: userId,
      "training": {
        $elemMatch: {
          $elemMatch: { exercise: exerciseObjectId }
        }
      }
    }).lean();

    let maxWeight = 0;

    // Iterate through workouts to find max weight at target reps or more
    workouts.forEach((workout) => {
      workout.training.forEach((circuit) => {
        circuit.forEach((exerciseEntry) => {
          if (exerciseEntry.exercise?.toString() === exerciseId) {
            const achievedReps = exerciseEntry.achieved?.reps || [];
            const achievedWeights = exerciseEntry.achieved?.weight || [];

            achievedReps.forEach((reps, index) => {
              if (reps >= targetReps && achievedWeights[index] > maxWeight) {
                maxWeight = achievedWeights[index];
              }
            });
          }
        });
      });
    });

    res.json({ maxWeight, exerciseId, targetReps });
  } catch (err) {
    next(err);
  }
};

const mark_achievement_seen = async (req, res, next) => {
  try {
    const { goalId } = req.body;
    const goal = await Goal.findOneAndUpdate(
      { _id: goalId, user: res.locals.user._id },
      { achievementSeen: true },
      { new: true }
    )
      .populate("comments.user", "firstName lastName profilePicture")
      .populate("exercise", "_id exerciseTitle");

    if (!goal) {
      return res.status(404).json({ error: "Goal not found" });
    }
    res.json(goal);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create_goal,
  remove_goal,
  update_goal,
  get_goals,
  comment_on_goal,
  remove_comment,
  get_client_goals,
  get_exercise_max_at_reps,
  mark_achievement_seen,
};
