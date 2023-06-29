const express = require('express');
const trainingController = require('../controllers/trainingController');
const auth = require("../middleware/auth");
const { validate, Joi } = require('express-validation');
const router = express.Router();

const exerciseHistoryValidate = {
    body: Joi.object({
        targetExercise: Joi.string()
            .required(),
    }),
}

router.post('/training', auth, trainingController.get_training_by_id);
router.post('/workouts', auth, trainingController.get_workouts_by_date);
router.post('/getClientTraining', auth, trainingController.get_client_training);
router.post('/updateTraining', auth, trainingController.update_training);
router.post('/createTraining', auth, trainingController.create_training);
router.post('/trainingWeek', auth, trainingController.get_weekly_training);
router.post('/exerciseHistory', auth, validate(exerciseHistoryValidate, {}, {}), trainingController.get_exercise_history);
router.get('/myExerciseList', auth, trainingController.get_exercise_list);
router.post('/copyWorkoutById', auth, trainingController.copy_workout_by_id);
router.post('/updateWorkoutDateById', auth, trainingController.update_workout_date_by_id);
router.post('/deleteWorkoutById', auth, trainingController.delete_workout_by_id);
router.post('/getWorkoutHistory', auth, trainingController.workout_history_request);

module.exports = router;