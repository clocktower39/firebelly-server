const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const auth = require("../middleware/auth");
const { validate, Joi } = require('express-validation');

const relationshipValidate = {
    body: Joi.object({
        trainerId: Joi.string()
            .required(),
        clientId: Joi.string()
            .required(),
        requestedBy: Joi.string()
            .required(),
        accepted: Joi.boolean()
            .required(),
    }),
}


const router = express.Router();

router.get('/relationships/:type/:_id', auth, relationshipController.get_relationships);
router.get('/relationships/myTrainers', auth, relationshipController.get_my_relationships);
router.post('/manageRelationship', validate(relationshipValidate, {}, {}), auth, relationshipController.manage_relationship);

module.exports = router;