const express = require('express');
const userController = require('../controllers/userController');
const auth = require("../middleware/auth");
const { validate, Joi } = require('express-validation');
const router = express.Router();

const loginValidate = {
    body: Joi.object({
        email: Joi.string()
            .required().email(),
        password: Joi.string()
            .required(),
    }),
}

const signupValidate = {
    body: Joi.object({
        firstName: Joi.string()
            .required(),
        lastName: Joi.string()
            .required(),
        email: Joi.string()
            .email()
            .required(),
        password: Joi.string()
            .regex(/[a-zA-Z0-9]{3,30}/)
            .required(),
    }),
}

router.get('/checkAuthToken', auth, userController.checkAuthLoginToken);
router.get('/trainers', auth, userController.get_trainers);
router.post('/login', validate(loginValidate, {}, {}), userController.login_user);
router.post('/signup', validate(signupValidate, {}, {}), userController.signup_user);
router.post('/updateUser', auth, userController.update_user);
router.post('/getUser', auth, userController.get_userInfo);
router.post('/changePassword', auth, userController.change_password);

module.exports = router;