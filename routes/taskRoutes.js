const express = require('express');
const taskController = require('../controllers/taskController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/tasks', auth, taskController.get_tasks);
router.post('/updateTaskHistoryDate', auth, taskController.update_task_history_date);

module.exports = router;