const express = require("express");
const scheduleController = require("../controllers/scheduleController");
const { verifyAccessToken } = require("../middleware/auth");
const router = express.Router();

router.post("/schedule/range", verifyAccessToken, scheduleController.get_schedule_range);
router.post("/schedule/event/create", verifyAccessToken, scheduleController.create_schedule_event);
router.post("/schedule/event/update", verifyAccessToken, scheduleController.update_schedule_event);
router.post("/schedule/event/cancel", verifyAccessToken, scheduleController.cancel_schedule_event);
router.post("/schedule/event", verifyAccessToken, scheduleController.get_schedule_event_by_id);
router.post("/schedule/book/request", verifyAccessToken, scheduleController.request_booking);
router.post("/schedule/book/respond", verifyAccessToken, scheduleController.respond_booking);

module.exports = router;
