const express = require("express");
const billingController = require("../controllers/billingController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");

const router = express.Router();
const objectId = Joi.string().hex().length(24);
const ledgerAdjustmentValidate = {
  body: Joi.object({
    trainerId: objectId.required(),
    clientId: objectId.optional(),
    groupId: objectId.optional(),
    sessionTypeId: objectId.optional(),
    delta: Joi.number().required(),
    notes: Joi.string().allow("").optional(),
  }).xor("clientId", "groupId"),
};

router.post("/billing/summary", verifyAccessToken, billingController.get_summary);
router.post("/billing/ledger", verifyAccessToken, billingController.list_ledger_entries);
router.post(
  "/billing/ledger/adjust",
  validate(ledgerAdjustmentValidate, {}, {}),
  verifyAccessToken,
  ensureWriteAccess,
  billingController.create_adjustment
);

module.exports = router;
