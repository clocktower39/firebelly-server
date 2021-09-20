const express = require('express');
const userController = require('../controllers/userController');

const router = express.Router();

router.post('/login', userController.login_user);
router.post('/signup', userController.signup_user);
router.post('/updateDefaultTasks', userController.update_default_tasks);

module.exports = router;