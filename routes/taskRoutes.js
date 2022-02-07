const express = require('express');
const taskController = require('../controllers/taskController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/tasks', auth, taskController.get_tasks);

module.exports = router;