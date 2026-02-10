const express = require("express");
const programController = require("../controllers/programController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const router = express.Router();

router.post("/programs", verifyAccessToken, ensureWriteAccess, programController.create_program);
router.get("/programs", verifyAccessToken, programController.list_programs);
router.get("/programs/:id", verifyAccessToken, programController.get_program);
router.put("/programs/:id", verifyAccessToken, ensureWriteAccess, programController.update_program);
router.put(
  "/programs/:id/days/:weekIndex/:dayIndex",
  verifyAccessToken,
  ensureWriteAccess,
  programController.update_program_day
);
router.post("/programs/:id/publish", verifyAccessToken, ensureWriteAccess, programController.publish_program);
router.post("/programs/:id/assign", verifyAccessToken, ensureWriteAccess, programController.assign_program);

module.exports = router;
