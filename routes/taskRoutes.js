const express = require('express');
const taskController = require('../controllers/taskController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/tasks', auth, taskController.get_tasks);
router.post('/createTask', auth, taskController.create_task);
router.post('/updateTask', auth, taskController.update_task);

module.exports = router;