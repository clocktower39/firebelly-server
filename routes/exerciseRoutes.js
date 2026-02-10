const express = require('express');
const exerciseController = require('../controllers/exerciseController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.post('/createExercise', verifyAccessToken, ensureWriteAccess, exerciseController.create_exercise);
router.get('/exerciseLibrary', verifyAccessToken, exerciseController.get_exercise_library);
router.post('/search_exercise', verifyAccessToken, exerciseController.search_exercise);
router.post('/updateExercise', verifyAccessToken, ensureWriteAccess, exerciseController.update_exercise);
router.post('/mergeExercises', verifyAccessToken, ensureWriteAccess, exerciseController.merge_exercises);

module.exports = router;
