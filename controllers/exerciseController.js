const Exercise = require("../models/exercise");

const create_exercise = (req, res, next) => {
  let exercise = new Exercise({
    ...req.body,
  });
  let saveExercise = () => {
    exercise.save((err) => {
      if (err) return next(err);
      res.send({
        status: "success",
        exercise,
      });
    });
  };
  saveExercise();
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

  if (
    res.locals.user._id.toString() !== "612198502f4d5273b466b4e4" &&
    res.locals.user._id.toString() !== "613d0935341e9f055c320d81"
  ) {
    return res.status(403).send({ error: "Restricted" });
  }

  Exercise.findOneAndUpdate({ _id: exercise._id }, { ...exercise }, { new: true })
    .then((data) => {
      if (!data) return res.send({});
      res.send(data);
    })
    .catch((err) => next(err));
};

module.exports = {
  create_exercise,
  get_exercise_library,
  search_exercise,
  update_exercise,
};
