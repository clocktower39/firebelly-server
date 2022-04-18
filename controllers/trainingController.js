const Training = require('../models/training');

const create_training = (req, res, next) => {
    let training = new Training({
        ...req.body,
        accountId: res.locals.user._id,
    });
    let saveTraining = () => {
        training.save((err) => {
            if (err) return next(err);
            res.send({
                status: 'success',
                training
            })
        });
    }
    saveTraining();
}

const update_training = (req, res, next) => {
    Training.findByIdAndUpdate(req.body._id, { ...req.body.training }, { new: true }, (err, training) => {
        if (err) return next(err);
        else {
            res.send({ training });
        }
    })
}

const get_training = (req, res, next) => {
    Training.find({ accountId: res.locals.user._id, date: req.body.date }, function (err, data) {
        if (err) return next(err);
        res.send(data);
    });
}

const get_weekly_training = (req, res, next) => {

    let loopDate = new Date(req.body.startDate);
    let endDate = new Date(req.body.endDate);
    let week = [];

    while (loopDate <= endDate) {
        week.push(loopDate)
        loopDate = new Date(new Date(loopDate).getTime() + 1 * (24 * 60 * 60 * 1000));
    }

    Training.find({
        $or: week.map(day => {
            return { date: day, accountId: res.locals.user._id };
        })
    }, function (err, data) {
        if (err) return next(err);
        week.forEach((date) => {
            let doesDateExist = false;
            data.map(day => {
                if (new Date(day.date).getTime() === new Date(date).getTime()) {
                    doesDateExist = true;
                }
            })
            if (!doesDateExist) data.push({ date: new Date(date), category: "", training: [] })
        });
        res.send(data);
    });

}

const get_exercise_list = (req, res, next) => {
    Training.find({ accountId: res.locals.user._id }, function (err, data) {
        if (err) return next(err);

        let exerciseList = [];

        data.map(day => {
            day.training.map(set => {
                set.map(exercise => {
                    if (!exerciseList.map(ex => (typeof ex === 'string') ? ex.toLowerCase() : ex).includes((typeof exercise.exercise === 'string') ? exercise.exercise.toLowerCase() : '')) {
                        exerciseList.push(exercise.exercise);
                    }
                });
            });
        });
        res.send(exerciseList);
    });
}

const get_exercise_history = (req, res, next) => {
    Training.find({ accountId: res.locals.user._id }, function (err, data) {
        if (err) return next(err);

        let historyList = [];

        data.map(day => {
            day.training.map(set => {
                let targetedExercise = set.filter(exercise => exercise.exercise.toLowerCase() === req.body.targetExercise.toLowerCase())
                if (targetedExercise.length > 0) {
                    historyList.push({ ...targetedExercise[0], date: day.date })
                }
            })
        })
        res.send(historyList);
    }).lean().exec();
}

const update_workout_date = (req, res, next) => {
    Training.find({ accountId: res.locals.user._id, date: req.body.newDate }, function (err, newDateData) {
        if (err) return next(err);
        if (newDateData.length > 0) {
            res.send({ error: `Workout already exists for ${req.body.newDate}` })
        }
        else {
            Training.findOneAndUpdate({ accountId: res.locals.user._id, date: req.body.originalDate }, { date: req.body.newDate }, { new: true }, function (err, data) {
                if (err) return next(err);

                res.send(data);
            })
        }
    })
}

const delete_workout_date = (req, res, next) => {
    Training.findOneAndDelete({ accountId: res.locals.user._id, date: req.body.date }, function (err, data) {
        if (err) {
            res.send({ error: err })
        }
        else {
            res.send({ status: 'Record deleted' })
        }
    })
}

module.exports = {
    create_training,
    get_training,
    update_training,
    get_weekly_training,
    get_exercise_list,
    get_exercise_history,
    update_workout_date,
    delete_workout_date,
}