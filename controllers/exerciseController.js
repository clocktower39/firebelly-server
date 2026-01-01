const mongoose = require("mongoose");
const Exercise = require("../models/exercise");
const Training = require("../models/training");

const exerciseAdminIds = ["612198502f4d5273b466b4e4", "613d0935341e9f055c320d81"];

const isExerciseAdmin = (user) => exerciseAdminIds.includes(user?._id?.toString());

const create_exercise = async (req, res, next) => {
  if (!isExerciseAdmin(res.locals.user)) {
    return res.status(403).send({ error: "Restricted" });
  }

  let exercise = new Exercise({
    ...req.body,
  });
  try {
    await exercise.save();
    return res.send({
      status: "success",
      exercise,
    });
  } catch (err) {
    return next(err);
  }
};

const get_exercise_library = (req, res, next) => {
  Exercise.find({})
    .then((data) => {
      res.send(data);
    })
    .catch((err) => next(err));
};

const search_exercise = (req, res, next) => {
  Exercise.findOne({ exerciseTitle: req.body.exerciseTitle })
    .then((data) => {
      if (!data) return res.send({});
      res.send(data);
    })
    .catch((err) => next(err));
};

const update_exercise = (req, res, next) => {
  const { exercise } = req.body;

  if (!isExerciseAdmin(res.locals.user)) {
    return res.status(403).send({ error: "Restricted" });
  }

  Exercise.findOneAndUpdate({ _id: exercise._id }, { ...exercise }, { new: true })
    .then((data) => {
      if (!data) return res.send({});
      res.send(data);
    })
    .catch((err) => next(err));
};

const merge_exercises = async (req, res, next) => {
  const { sourceExerciseId, targetExerciseId, deleteSource = true } = req.body;

  if (!isExerciseAdmin(res.locals.user)) {
    return res.status(403).send({ error: "Restricted" });
  }

  if (!sourceExerciseId || !targetExerciseId) {
    return res.status(400).send({ error: "Missing exercise ids." });
  }

  if (sourceExerciseId === targetExerciseId) {
    return res.status(400).send({ error: "Source and target cannot match." });
  }

  try {
    const [sourceExercise, targetExercise] = await Promise.all([
      Exercise.findById(sourceExerciseId),
      Exercise.findById(targetExerciseId),
    ]);

    if (!sourceExercise || !targetExercise) {
      return res.status(404).send({ error: "Exercise not found." });
    }

    const sourceObjectId = new mongoose.Types.ObjectId(`${sourceExerciseId}`);
    const targetObjectId = new mongoose.Types.ObjectId(`${targetExerciseId}`);

    const trainingUpdate = await Training.updateMany(
      {
        training: { $elemMatch: { $elemMatch: { exercise: sourceObjectId } } },
      },
      {
        $set: {
          "training.$[].$[entry].exercise": targetObjectId,
        },
      },
      {
        arrayFilters: [{ "entry.exercise": sourceObjectId }],
      }
    );

    if (deleteSource) {
      await Exercise.deleteOne({ _id: sourceExercise._id });
    }

    return res.send({
      status: "success",
      mergedExercise: targetExercise,
      removedExerciseId: deleteSource ? sourceExerciseId : null,
      updatedTrainingCount: trainingUpdate.modifiedCount ?? trainingUpdate.nModified ?? 0,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_exercise,
  get_exercise_library,
  search_exercise,
  update_exercise,
  merge_exercises,
};
