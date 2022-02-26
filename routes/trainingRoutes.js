const express = require('express');
const trainingController = require('../controllers/trainingController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/training', auth, trainingController.get_training);
router.post('/updateTraining', auth, trainingController.update_training);
router.post('/createTraining', auth, trainingController.create_training);
router.post('/trainingWeek', auth, trainingController.get_weekly_training);
router.post('/exerciseHistory', auth, trainingController.get_exercise_history);
router.get('/exerciseList', auth, trainingController.get_exercise_list);
router.post('/updateWorkoutDate', auth, trainingController.update_workout_date);

module.exports = router;