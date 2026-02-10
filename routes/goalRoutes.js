const express = require('express');
const goalController = require('../controllers/goalController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.get('/goals', verifyAccessToken, goalController.get_goals);
router.post('/clientGoals', verifyAccessToken, goalController.get_client_goals);
router.post('/createGoal', verifyAccessToken, ensureWriteAccess, goalController.create_goal);
router.post('/removeGoal', verifyAccessToken, ensureWriteAccess, goalController.remove_goal);
router.post('/updateGoal', verifyAccessToken, ensureWriteAccess, goalController.update_goal);
router.post('/commentGoal', verifyAccessToken, ensureWriteAccess, goalController.comment_on_goal);
router.post('/removeGoalComment', verifyAccessToken, ensureWriteAccess, goalController.remove_comment);
router.post('/goals/exerciseMaxAtReps', verifyAccessToken, goalController.get_exercise_max_at_reps);
router.post('/goals/markAchievementSeen', verifyAccessToken, ensureWriteAccess, goalController.mark_achievement_seen);

module.exports = router;
