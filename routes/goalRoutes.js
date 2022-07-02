const express = require('express');
const goalController = require('../controllers/goalController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/goals', auth, goalController.get_goals);
router.post('/createGoal', auth, goalController.create_goal);
router.post('/removeGoal', auth, goalController.remove_goal);
router.post('/updateGoal', auth, goalController.update_goal);
router.post('/commentGoal', auth, goalController.comment_on_goal);

module.exports = router;