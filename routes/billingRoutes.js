const express = require("express");
const billingController = require("../controllers/billingController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.post("/billing/summary", verifyAccessToken, billingController.get_summary);
router.post("/billing/ledger", verifyAccessToken, billingController.list_ledger_entries);
router.post(
  "/billing/ledger/adjust",
  verifyAccessToken,
  ensureWriteAccess,
  billingController.create_adjustment
);

module.exports = router;
