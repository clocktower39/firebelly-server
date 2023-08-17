const express = require('express');
const exerciseController = require('../controllers/exerciseController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.post('/createExercise', verifyAccessToken, exerciseController.create_exercise);
router.get('/exerciseLibrary', verifyAccessToken, exerciseController.get_exercise_library);

module.exports = router;