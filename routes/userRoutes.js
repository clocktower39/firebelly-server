const express = require('express');
const userController = require('../controllers/userController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
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

const childLoginValidate = {
    body: Joi.object({
        username: Joi.string().required(),
        pin: Joi.string().required(),
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
        dateOfBirth: Joi.date()
            .optional(),
    }),
}

router.get('/checkAuthToken', verifyAccessToken, userController.checkAuthLoginToken);
router.post('/login', validate(loginValidate, {}, {}), userController.login_user);
router.post('/login-child', validate(childLoginValidate, {}, {}), userController.login_child);
router.post('/signup', validate(signupValidate, {}, {}), userController.signup_user);
router.get('/verify-email', userController.verify_email);
router.post('/resend-verification-email', userController.resend_verification_email);
router.get('/trainers', verifyAccessToken, userController.get_trainers);
router.post('/updateUser', verifyAccessToken, ensureWriteAccess, userController.update_user);
router.post('/getUser', verifyAccessToken, userController.get_userInfo);
router.get('/public/trainer/:id', userController.get_public_trainer_info);
router.post('/changePassword', verifyAccessToken, ensureWriteAccess, userController.change_password);
router.post('/user/upload/profilePicture', verifyAccessToken, ensureWriteAccess, uploadProfilePicture.single("file"), userController.upload_profile_picture);
router.get('/user/profilePicture/:id', userController.get_profile_picture);
router.get('/user/remove/image/', verifyAccessToken, ensureWriteAccess, userController.delete_profile_picture);
router.post("/refresh-tokens", userController.refresh_tokens);

module.exports = router;
