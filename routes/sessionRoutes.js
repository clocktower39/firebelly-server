const express = require("express");
const sessionController = require("../controllers/sessionController");
const { verifyAccessToken } = require("../middleware/auth");
const router = express.Router();

router.post("/sessions/purchase/create", verifyAccessToken, sessionController.create_purchase);
router.post("/sessions/purchase/list", verifyAccessToken, sessionController.list_purchases);
router.post("/sessions/summary", verifyAccessToken, sessionController.get_session_summary);

module.exports = router;
