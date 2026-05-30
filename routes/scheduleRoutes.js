const express = require("express");
const scheduleController = require("../controllers/scheduleController");
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");
const { validate, Joi } = require("express-validation");
const router = express.Router();

const objectId = Joi.string().hex().length(24);
const scheduleFields = {
  trainerId: objectId.optional(),
  clientId: objectId.allow(null).optional(),
  startDateTime: Joi.date().optional(),
  endDateTime: Joi.date().optional(),
  eventType: Joi.string().valid("APPOINTMENT", "INDEPENDENT", "AVAILABILITY").optional(),
  status: Joi.string().valid("OPEN", "REQUESTED", "BOOKED", "COMPLETED", "CANCELLED").optional(),
  workoutId: objectId.allow(null).optional(),
  customClientName: Joi.string().allow("").optional(),
  customClientEmail: Joi.string().email().allow("").optional(),
  customClientPhone: Joi.string().allow("").optional(),
  publicLabel: Joi.string().allow("").optional(),
  priceAmount: Joi.number().allow(null).optional(),
  priceCurrency: Joi.string().valid("USD", "EUR", "JPY").optional(),
  payoutAmount: Joi.number().allow(null).optional(),
  payoutCurrency: Joi.string().valid("USD", "EUR", "JPY").optional(),
  recurrenceRule: Joi.string().allow(null, "").optional(),
  availabilitySource: Joi.string().valid("NORMAL", "MANUAL").optional(),
  billingStatus: Joi.string().valid("UNBILLED", "CHARGED", "NO_CHARGE").optional(),
  notes: Joi.string().allow("").optional(),
  sessionTypeId: objectId.allow(null).optional(),
};
const createScheduleEventValidate = {
  body: Joi.object({
    ...scheduleFields,
    eventType: scheduleFields.eventType.required(),
    startDateTime: scheduleFields.startDateTime.required(),
    endDateTime: scheduleFields.endDateTime.required(),
  }),
};
const updateScheduleEventValidate = {
  body: Joi.object({
    _id: objectId.required(),
    updates: Joi.object(scheduleFields).required(),
  }),
};
const idBodyValidate = {
  body: Joi.object({
    _id: objectId.required(),
  }).unknown(true),
};

router.post("/schedule/range", verifyAccessToken, scheduleController.get_schedule_range);
router.post("/schedule/event/create", validate(createScheduleEventValidate, {}, {}), verifyAccessToken, ensureWriteAccess, scheduleController.create_schedule_event);
router.post("/schedule/event/update", validate(updateScheduleEventValidate, {}, {}), verifyAccessToken, ensureWriteAccess, scheduleController.update_schedule_event);
router.post("/schedule/event/cancel", validate(idBodyValidate, {}, {}), verifyAccessToken, ensureWriteAccess, scheduleController.cancel_schedule_event);
router.post("/schedule/event/delete", validate(idBodyValidate, {}, {}), verifyAccessToken, ensureWriteAccess, scheduleController.delete_schedule_event);
router.post("/schedule/event", verifyAccessToken, scheduleController.get_schedule_event_by_id);
router.post("/schedule/event/by-workout", verifyAccessToken, scheduleController.get_schedule_event_by_workout);
router.post("/schedule/public/range", scheduleController.get_public_schedule_range);
router.post("/schedule/book/request", verifyAccessToken, ensureWriteAccess, scheduleController.request_booking);
router.post("/schedule/book/trainer", verifyAccessToken, ensureWriteAccess, scheduleController.trainer_book_availability);
router.post("/schedule/book/respond", verifyAccessToken, ensureWriteAccess, scheduleController.respond_booking);

module.exports = router;
