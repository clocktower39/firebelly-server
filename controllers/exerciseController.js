const Exercise = require('../models/exercise');

const create_exercise = (req, res, next) => {
    let exercise = new Exercise({
        ...req.body,
    });
    let saveExercise = () => {
        exercise.save((err) => {
            if (err) return next(err);
            res.send({
                status: 'success',
                exercise
            })
        });
    }
    saveExercise();
}

const get_exercise_library = (req, res, next) => {
    Exercise.find({}, function (err, data) {
        if (err) return next(err);
        res.send(data);
    });
}

const search_exercise = (req, res, next) => {
    Exercise.findOne({ exerciseTitle: req.body.exerciseTitle, }, function (err, data) {
        if (err) return next(err);
        res.send(data);
    });
}


module.exports = {
    create_exercise,
    get_exercise_library,
    search_exercise,
}