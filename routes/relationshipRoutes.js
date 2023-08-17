const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { validate, Joi } = require('express-validation');

const relationshipValidate = {
    body: Joi.object({
        trainerId: Joi.string()
            .required(),
    }),
}

const relationshipStatus = {
    body: Joi.object({
        clientId: Joi.string()
            .required(),
        accepted: Joi.bool()
            .required(),
    }),
}


const router = express.Router();

router.get('/relationships/:type/:_id', verifyAccessToken, relationshipController.get_relationships);
router.get('/relationships/myTrainers', verifyAccessToken, relationshipController.get_my_relationships);
router.get('/relationships/myClients', verifyAccessToken, relationshipController.get_my_clients);
router.post('/changeRelationshipStatus', validate(relationshipStatus, {}, {}), verifyAccessToken, relationshipController.change_relationship_status);
router.post('/manageRelationship', validate(relationshipValidate, {}, {}), verifyAccessToken, relationshipController.manage_relationship);
router.post('/removeRelationship', validate(relationshipValidate, {}, {}), verifyAccessToken, relationshipController.remove_relationship);

module.exports = router;