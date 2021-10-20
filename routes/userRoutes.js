const express = require('express');
const userController = require('../controllers/userController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/checkAuthToken', auth, userController.checkAuthLoginToken);
router.post('/login', userController.login_user);
router.post('/signup', userController.signup_user);
router.post('/updateDefaultTasks', auth, userController.update_default_tasks);

module.exports = router;