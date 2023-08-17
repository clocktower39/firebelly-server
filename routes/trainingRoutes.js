const express = require('express');
const trainingController = require('../controllers/trainingController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { validate, Joi } = require('express-validation');
const router = express.Router();

const exerciseHistoryValidate = {
    body: Joi.object({
        targetExercise: Joi.string()
            .required(),
    }),
}

router.post('/training', verifyAccessToken, trainingController.get_training_by_id);
router.post('/workouts', verifyAccessToken, trainingController.get_workouts_by_date);
router.post('/getClientTraining', verifyAccessToken, trainingController.get_client_training);
router.post('/updateTraining', verifyAccessToken, trainingController.update_training);
router.post('/createTraining', verifyAccessToken, trainingController.create_training);
router.post('/trainingWeek', verifyAccessToken, trainingController.get_weekly_training);
router.post('/exerciseHistory', verifyAccessToken, validate(exerciseHistoryValidate, {}, {}), trainingController.get_exercise_history);
router.get('/myExerciseList', verifyAccessToken, trainingController.get_exercise_list);
router.post('/copyWorkoutById', verifyAccessToken, trainingController.copy_workout_by_id);
router.post('/updateWorkoutDateById', verifyAccessToken, trainingController.update_workout_date_by_id);
router.post('/deleteWorkoutById', verifyAccessToken, trainingController.delete_workout_by_id);
router.post('/getWorkoutHistory', verifyAccessToken, trainingController.workout_history_request);
router.post('/upateExerciseName', verifyAccessToken, trainingController.update_exercise_name);

module.exports = router;