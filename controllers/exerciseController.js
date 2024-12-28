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
        if(!data) return res.send({})
      res.send(data);
    })
    .catch((err) => next(err));
};

module.exports = {
  create_exercise,
  get_exercise_library,
  search_exercise,
};
