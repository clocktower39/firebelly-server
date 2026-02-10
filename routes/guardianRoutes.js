const express = require("express");
const guardianController = require("../controllers/guardianController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { ensureGuardianAccess } = require("../middleware/ensureGuardianAccess");
const { validate, Joi } = require("express-validation");

const createChildValidate = {
  body: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    username: Joi.string().required(),
    pin: Joi.string().required(),
    dateOfBirth: Joi.date().required(),
    email: Joi.string().email().optional().allow(""),
  }),
};

const childTokenValidate = {
  body: Joi.object({
    childId: Joi.string().required(),
  }),
};

const consentValidate = {
  body: Joi.object({
    childId: Joi.string().required(),
    scope: Joi.string().valid("collection_only", "collection_and_disclosure").required(),
    method: Joi.string().required(),
  }),
};

const addEmailValidate = {
  body: Joi.object({
    childId: Joi.string().required(),
    email: Joi.string().email().required(),
  }),
};

const router = express.Router();

router.post(
  "/guardian/child",
  validate(createChildValidate, {}, {}),
  verifyAccessToken,
  ensureGuardianAccess,
  ensureWriteAccess,
  guardianController.create_child
);
router.get(
  "/guardian/children",
  verifyAccessToken,
  ensureGuardianAccess,
  guardianController.list_children
);
router.post(
  "/guardian/child/token",
  validate(childTokenValidate, {}, {}),
  verifyAccessToken,
  ensureGuardianAccess,
  ensureWriteAccess,
  guardianController.issue_child_view_token
);
router.post(
  "/guardian/child/consent",
  validate(consentValidate, {}, {}),
  verifyAccessToken,
  ensureGuardianAccess,
  ensureWriteAccess,
  guardianController.record_consent
);
router.post(
  "/guardian/child/add-email",
  validate(addEmailValidate, {}, {}),
  verifyAccessToken,
  ensureGuardianAccess,
  ensureWriteAccess,
  guardianController.add_child_email
);

module.exports = router;
