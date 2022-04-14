const express = require('express');
const taskController = require('../controllers/taskController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/tasks', auth, taskController.get_tasks);
router.post('/updateTaskHistory', auth, taskController.update_task_history);
router.post('/updateDefaultTasks', auth, taskController.update_default_tasks);

module.exports = router;