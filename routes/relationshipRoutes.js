const express = require('express');
const relationshipController = require('../controllers/relationshipController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require('express-validation');

const relationshipValidate = {
    body: Joi.object({
        trainer: Joi.string()
            .required(),
    }),
}

const relationshipStatus = {
    body: Joi.object({
        client: Joi.string()
            .required(),
        accepted: Joi.bool()
            .required(),
    }),
}

const metricsApprovalStatus = {
    body: Joi.object({
        trainer: Joi.string()
            .required(),
        metricsApprovalRequired: Joi.bool()
            .required(),
    }),
}

const clientViewTokenValidate = {
    body: Joi.object({
        clientId: Joi.string().required(),
    }),
}

const router = express.Router();

router.get('/relationships/:type/:_id', verifyAccessToken, relationshipController.get_relationships);
router.get('/relationships/myTrainers', verifyAccessToken, relationshipController.get_my_relationships);
router.get('/relationships/myClients', verifyAccessToken, relationshipController.get_my_clients);
router.post('/changeRelationshipStatus', validate(relationshipStatus, {}, {}), verifyAccessToken, ensureWriteAccess, relationshipController.change_relationship_status);
router.post('/manageRelationship', validate(relationshipValidate, {}, {}), verifyAccessToken, ensureWriteAccess, relationshipController.manage_relationship);
router.post('/removeRelationship', verifyAccessToken, ensureWriteAccess, relationshipController.remove_relationship);
router.post('/relationships/metricsApproval', validate(metricsApprovalStatus, {}, {}), verifyAccessToken, ensureWriteAccess, relationshipController.update_metrics_approval);
router.post(
  '/relationships/client/token',
  validate(clientViewTokenValidate, {}, {}),
  verifyAccessToken,
  ensureWriteAccess,
  relationshipController.issue_client_view_token
);

module.exports = router;
