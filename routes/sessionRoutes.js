const express = require("express");
const sessionController = require("../controllers/sessionController");
const sessionTypeController = require("../controllers/sessionTypeController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const router = express.Router();

router.post("/sessions/purchase/create", verifyAccessToken, ensureWriteAccess, sessionController.create_purchase);
router.post("/sessions/purchase/list", verifyAccessToken, sessionController.list_purchases);
router.post("/sessions/summary", verifyAccessToken, sessionController.get_session_summary);
router.get("/session-types", verifyAccessToken, sessionTypeController.list_session_types);
router.post("/session-types", verifyAccessToken, ensureWriteAccess, sessionTypeController.create_session_type);
router.put("/session-types/:id", verifyAccessToken, ensureWriteAccess, sessionTypeController.update_session_type);
router.delete("/session-types/:id", verifyAccessToken, ensureWriteAccess, sessionTypeController.delete_session_type);

module.exports = router;
