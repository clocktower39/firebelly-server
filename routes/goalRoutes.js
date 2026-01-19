const express = require('express');
const goalController = require('../controllers/goalController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.get('/goals', verifyAccessToken, goalController.get_goals);
router.post('/clientGoals', verifyAccessToken, goalController.get_client_goals);
router.post('/createGoal', verifyAccessToken, goalController.create_goal);
router.post('/removeGoal', verifyAccessToken, goalController.remove_goal);
router.post('/updateGoal', verifyAccessToken, goalController.update_goal);
router.post('/commentGoal', verifyAccessToken, goalController.comment_on_goal);
router.post('/removeGoalComment', verifyAccessToken, goalController.remove_comment);

module.exports = router;
