const Exercise = require('../models/exercise');

const create_exercise = (req, res) => {
    let exercise = new Exercise({
        ...req.body,
    });
    let saveExercise = () => {
        exercise.save((err) => {
            if (err) {
                console.log(err);
                res.send({ error: { err } });
            }
            else {
                res.send({
                    status: 'success',
                    exercise
                })
            }
        });
    }
    saveExercise();
}

const get_exercise_library = (req, res) => {
    Exercise.find({}, function(err, data) {
        if(err) throw err;
        res.send(data);
    });
}


module.exports = {
    create_exercise,
    get_exercise_library,
}