const express = require('express');
const trainingController = require('../controllers/trainingController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/training', auth, trainingController.get_training);
router.post('/getClientTraining', auth, trainingController.get_client_training);
router.post('/updateTraining', auth, trainingController.update_training);
router.post('/createTraining', auth, trainingController.create_training);
router.post('/trainingWeek', auth, trainingController.get_weekly_training);
router.post('/exerciseHistory', auth, trainingController.get_exercise_history);
router.get('/myExerciseList', auth, trainingController.get_exercise_list);
router.post('/copyWorkout', auth, trainingController.copy_workout_to_date);
router.post('/updateWorkoutDate', auth, trainingController.update_workout_date);
router.post('/deleteWorkoutDate', auth, trainingController.delete_workout_date);

module.exports = router;