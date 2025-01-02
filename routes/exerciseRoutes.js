const express = require('express');
const exerciseController = require('../controllers/exerciseController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.post('/createExercise', verifyAccessToken, exerciseController.create_exercise);
router.get('/exerciseLibrary', verifyAccessToken, exerciseController.get_exercise_library);
router.post('/search_exercise', verifyAccessToken, exerciseController.search_exercise);
router.post('/updateExercise', verifyAccessToken, exerciseController.update_exercise);

module.exports = router;