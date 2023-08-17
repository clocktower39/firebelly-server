const express = require('express');
const taskController = require('../controllers/taskController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.get('/tasks', verifyAccessToken, taskController.get_tasks);
router.post('/updateTaskHistory', verifyAccessToken, taskController.update_task_history);
router.post('/updateDefaultTasks', verifyAccessToken, taskController.update_default_tasks);

module.exports = router;