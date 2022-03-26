const express = require('express');
const userController = require('../controllers/userController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/checkAuthToken', auth, userController.checkAuthLoginToken);
router.post('/login', userController.login_user);
router.post('/signup', userController.signup_user);
router.post('/updateUser', auth, userController.update_user);
router.post('/getUser', auth, userController.get_userInfo);
router.post('/changePassword', auth, userController.change_password);

module.exports = router;