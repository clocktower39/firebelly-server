const express = require('express');
const trainingController = require('../controllers/trainingController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const router = express.Router();

router.post('/training', verifyAccessToken, trainingController.get_training_by_id);
router.post('/workouts', verifyAccessToken, trainingController.get_workouts_by_date);
router.post('/updateTraining', verifyAccessToken, trainingController.update_training);
router.post('/createTraining', verifyAccessToken, trainingController.create_training);
router.post('/trainingWeek', verifyAccessToken, trainingController.get_weekly_training);
router.post('/exerciseHistory', verifyAccessToken, trainingController.get_exercise_history);
router.get('/exerciseList', verifyAccessToken, trainingController.get_list_every_exercise);
router.post('/myExerciseList', verifyAccessToken, trainingController.get_exercise_list);
router.post('/copyWorkoutById', verifyAccessToken, trainingController.copy_workout_by_id);
router.post('/updateWorkoutDateById', verifyAccessToken, trainingController.update_workout_date_by_id);
router.post('/deleteWorkoutById', verifyAccessToken, trainingController.delete_workout_by_id);
router.post('/getWorkoutHistory', verifyAccessToken, trainingController.workout_history_request);
router.post('/workoutMonth', verifyAccessToken, trainingController.workout_month_request);
router.get('/getWorkoutQueue', verifyAccessToken, trainingController.get_workout_queue);

module.exports = router;