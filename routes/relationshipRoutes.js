const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const auth = require("../middleware/auth");
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

router.get('/relationships/:type/:_id', auth, relationshipController.get_relationships);
router.get('/relationships/myTrainers', auth, relationshipController.get_my_relationships);
router.get('/relationships/myClients', auth, relationshipController.get_my_clients);
router.post('/changeRelationshipStatus', validate(relationshipStatus, {}, {}), auth, relationshipController.change_relationship_status);
router.post('/manageRelationship', validate(relationshipValidate, {}, {}), auth, relationshipController.manage_relationship);
router.post('/removeRelationship', validate(relationshipValidate, {}, {}), auth, relationshipController.remove_relationship);

module.exports = router;