const express = require("express");
const programController = require("../controllers/programController");
const { verifyAccessToken } = require("../middleware/auth");
const router = express.Router();

router.post("/programs", verifyAccessToken, programController.create_program);
router.get("/programs", verifyAccessToken, programController.list_programs);
router.get("/programs/:id", verifyAccessToken, programController.get_program);
router.put("/programs/:id", verifyAccessToken, programController.update_program);
router.put(
  "/programs/:id/days/:weekIndex/:dayIndex",
  verifyAccessToken,
  programController.update_program_day
);
router.post("/programs/:id/publish", verifyAccessToken, programController.publish_program);

module.exports = router;
