const express = require('express');
const taskController = require('../controllers/taskController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/tasks', auth, taskController.get_tasks);
router.post('/updateTaskHistoryDate', auth, taskController.update_task_history_date);
router.post('/updateDefaultTasks', auth, taskController.update_default_tasks);

module.exports = router;