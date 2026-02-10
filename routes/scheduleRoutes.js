const express = require("express");
const scheduleController = require("../controllers/scheduleController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const router = express.Router();

router.post("/schedule/range", verifyAccessToken, scheduleController.get_schedule_range);
router.post("/schedule/event/create", verifyAccessToken, ensureWriteAccess, scheduleController.create_schedule_event);
router.post("/schedule/event/update", verifyAccessToken, ensureWriteAccess, scheduleController.update_schedule_event);
router.post("/schedule/event/cancel", verifyAccessToken, ensureWriteAccess, scheduleController.cancel_schedule_event);
router.post("/schedule/event/delete", verifyAccessToken, ensureWriteAccess, scheduleController.delete_schedule_event);
router.post("/schedule/event", verifyAccessToken, scheduleController.get_schedule_event_by_id);
router.post("/schedule/event/by-workout", verifyAccessToken, scheduleController.get_schedule_event_by_workout);
router.post("/schedule/public/range", scheduleController.get_public_schedule_range);
router.post("/schedule/book/request", verifyAccessToken, ensureWriteAccess, scheduleController.request_booking);
router.post("/schedule/book/trainer", verifyAccessToken, ensureWriteAccess, scheduleController.trainer_book_availability);
router.post("/schedule/book/respond", verifyAccessToken, ensureWriteAccess, scheduleController.respond_booking);

module.exports = router;
