const express = require('express');
const userController = require('../controllers/userController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { validate, Joi } = require('express-validation');
const { uploadProfilePicture } = require("../mygridfs");

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

router.get('/checkAuthToken', verifyAccessToken, userController.checkAuthLoginToken);
router.get('/trainers', verifyAccessToken, userController.get_trainers);
router.post('/login', validate(loginValidate, {}, {}), userController.login_user);
router.post('/signup', validate(signupValidate, {}, {}), userController.signup_user);
router.post('/updateUser', verifyAccessToken, userController.update_user);
router.post('/getUser', verifyAccessToken, userController.get_userInfo);
router.post('/changePassword', verifyAccessToken, userController.change_password);
router.post('/user/upload/profilePicture', verifyAccessToken, uploadProfilePicture.single("file"), userController.upload_profile_picture);
router.get('/user/profilePicture/:id', userController.get_profile_picture);
router.get('/user/remove/image/', verifyAccessToken, userController.delete_profile_picture);
router.post("/refresh-tokens", userController.refresh_tokens);

module.exports = router;