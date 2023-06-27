const Training = require('../models/training');
const Relationship = require('../models/relationship');
const mongoose = require('mongoose');

const create_training = (req, res, next) => {
    let training = new Training({
        ...req.body,
        user: res.locals.user._id,
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

const get_training_by_id = (req, res, next) => {
    Training.find({ user: res.locals.user._id, _id: req.body._id }, function (err, data) {
        if (err) return next(err);
        res.send(data);
    });
}

const get_workouts_by_date = (req, res, next) => {
    Training.find({ user: res.locals.user._id, date: req.body.date }, function (err, data) {
        if (err) return next(err);
        res.send(data);
    });
}

const get_client_training = (req, res, next) => {
    Relationship.findOne({ trainer: res.locals.user._id, client: req.body.client }, (err, relationship) => {
        if (err) return next(err);
        
        if(!relationship){
            console.log(relationship)
            res.send({ error: 'Relationship does not exist.'});
        }
        else if(relationship.accepted){
            Training.find({ user: req.body.client, date: req.body.date }, function (err, data) {
                if (err) return next(err);
                res.send(data);
            });
        }
        else{
            res.send({ error: 'Relationship pending.'});
        }
    })

}

const get_weekly_training = (req, res, next) => {
    const selectedDate = new Date(req.body.date);
    const startDate = new Date(selectedDate);
    startDate.setDate(startDate.getDate() - 6);
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

const get_exercise_list = (req, res, next) => {
    Training.find({ user: res.locals.user._id }, function (err, data) {
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
    Training.find({ user: res.locals.user._id }, function (err, data) {
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

const update_workout_date_by_id = (req, res, next) => {
        Training.findOneAndUpdate({ user: res.locals.user._id, _id: req.body._id }, { date: req.body.newDate }, { new: true }, function (err, data) {
            if (err) return next(err);

            res.send(data);
    })
}

const copy_workout_by_id = (req, res, next) => {
    const { newDate, _id, option = 'exact' } = req.body;
    Training.findOne({ user: res.locals.user._id, _id, }, function (err, data) {
        if (err) return next(err);
        switch (option){
            case 'achievedToNewGoal':
                data.training.map(set => {
                    set.map(exercise => {

                        // Loop through and move correlated achieved to goals
                        // Still need to restructure training model and remove unused properties
                        exercise.goals.exactReps = exercise.achieved.reps;
                        exercise.goals.weight = exercise.achieved.weight;
                        exercise.goals.percent = exercise.achieved.percent;
                        exercise.goals.seconds = exercise.achieved.seconds;


                        for( const prop in exercise.achieved) {
                            if(Array.isArray(exercise.achieved[prop])){
                                exercise.achieved[prop] = exercise.achieved[prop].map(v => {
                                    return '0';
                                })
                            }
                        }
                        return exercise;
                    })
                    return set;
                })
                break;
            case 'copyGoalOnly':
                data.training.map(set => {
                    set.map(exercise => {
                        for( const prop in exercise.achieved) {
                            if(Array.isArray(exercise.achieved[prop])){
                                exercise.achieved[prop] = exercise.achieved[prop].map(v => {
                                    return '0';
                                })
                            }
                        }
                        return exercise;
                    })
                    return set;
                })
                break;
        }

        data._id = mongoose.Types.ObjectId();
        data.isNew = true;
        data.date = newDate;
        data.save((err) => {
            if (err) return next(err);
            res.send({
                status: 'Copy Successful',
            })
        });
    })
}

const delete_workout_by_id = (req, res, next) => {
    Training.findOneAndDelete({ user: res.locals.user._id, _id: req.body._id }, function (err, data) {
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
    get_training_by_id,
    get_workouts_by_date,
    update_training,
    get_weekly_training,
    get_exercise_list,
    get_exercise_history,
    copy_workout_by_id,
    update_workout_date_by_id,
    delete_workout_by_id,
    get_client_training,
}