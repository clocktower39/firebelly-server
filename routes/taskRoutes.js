const express = require('express');
const taskController = require('../controllers/taskController');

const router = express.Router();

router.post('/createTask', taskController.create_task);

module.exports = router;