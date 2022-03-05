const express = require('express');
const exerciseController = require('../controllers/exerciseController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/createExercise', auth, exerciseController.create_exercise);
router.get('/exerciseLibrary', auth, exerciseController.get_exercise_library);

module.exports = router;