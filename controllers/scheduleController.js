const mongoose = require("mongoose");
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");

const APPOINTMENT_STATUSES = ["REQUESTED", "BOOKED", "COMPLETED"];

const ensureRelationship = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const overlaps = (event, start, end) =>
  event.startDateTime < end && event.endDateTime > start;

const get_schedule_range = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const {
      startDate,
      endDate,
      trainerId,
      clientId,
      includeAvailability = true,
    } = req.body;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate and endDate are required." });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const isTrainerView = !trainerId || String(trainerId) === String(userId);
    const effectiveTrainerId = trainerId || userId;

    if (!isTrainerView) {
      const relationship = await ensureRelationship(trainerId, userId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
      if (clientId && String(clientId) !== String(userId)) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    } else if (clientId) {
      const relationship = await ensureRelationship(userId, clientId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    let query = {
      trainerId: effectiveTrainerId,
      startDateTime: { $lt: end },
      endDateTime: { $gt: start },
    };

    if (!isTrainerView) {
      query = {
        ...query,
        $or: [
          ...(includeAvailability
            ? [{ eventType: "AVAILABILITY", status: "OPEN" }]
            : []),
          { clientId: userId },
        ],
      };
    } else if (clientId) {
      query = {
        ...query,
        $or: [
          { clientId },
          ...(includeAvailability ? [{ eventType: "AVAILABILITY", status: "OPEN" }] : []),
        ],
      };
    }

    const events = await ScheduleEvent.find(query).lean();

    if (!isTrainerView && includeAvailability) {
      const booked = await ScheduleEvent.find({
        trainerId: effectiveTrainerId,
        eventType: "APPOINTMENT",
        status: { $in: APPOINTMENT_STATUSES },
        startDateTime: { $lt: end },
        endDateTime: { $gt: start },
      }).lean();

      const filtered = events.filter((event) => {
        if (event.eventType !== "AVAILABILITY") return true;
        if (event.recurrenceRule) return true;
        return !booked.some((appt) => overlaps(appt, event.startDateTime, event.endDateTime));
      });

      return res.json({ events: filtered });
    }

    return res.json({ events });
  } catch (err) {
    return next(err);
  }
};

const create_schedule_event = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const payload = { ...req.body, trainerId: userId };

    if (req.body.trainerId && String(req.body.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    if (payload.clientId) {
      const relationship = await ensureRelationship(userId, payload.clientId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const scheduleEvent = new ScheduleEvent(payload);
    const saved = await scheduleEvent.save();
    return res.json({ event: saved });
  } catch (err) {
    return next(err);
  }
};

const update_schedule_event = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { _id, updates } = req.body;

    const existing = await ScheduleEvent.findById(_id);
    if (!existing) {
      return res.status(404).json({ error: "Schedule event not found." });
    }

    if (String(existing.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    if (updates?.clientId) {
      const relationship = await ensureRelationship(userId, updates.clientId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const updated = await ScheduleEvent.findByIdAndUpdate(_id, updates, { new: true });
    return res.json({ event: updated });
  } catch (err) {
    return next(err);
  }
};

const cancel_schedule_event = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { _id } = req.body;

    const existing = await ScheduleEvent.findById(_id);
    if (!existing) {
      return res.status(404).json({ error: "Schedule event not found." });
    }

    const isTrainer = String(existing.trainerId) === String(userId);
    const isClient = existing.clientId && String(existing.clientId) === String(userId);

    if (!isTrainer && !isClient) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    existing.status = "CANCELLED";
    existing.cancelledBy = userId;
    const updated = await existing.save();
    return res.json({ event: updated });
  } catch (err) {
    return next(err);
  }
};

const request_booking = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const {
      availabilityEventId,
      trainerId,
      startDateTime,
      endDateTime,
      isRecurring = false,
      recurrenceRule,
    } = req.body;

    if (!availabilityEventId || !trainerId || !startDateTime || !endDateTime) {
      return res.status(400).json({ error: "Missing booking fields." });
    }

    const relationship = await ensureRelationship(trainerId, userId);
    if (!relationship) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const availability = await ScheduleEvent.findById(availabilityEventId);
    if (!availability || availability.eventType !== "AVAILABILITY") {
      return res.status(404).json({ error: "Availability slot not found." });
    }
    if (availability.status !== "OPEN") {
      return res.status(409).json({ error: "Availability slot is no longer open." });
    }
    if (String(availability.trainerId) !== String(trainerId)) {
      return res.status(400).json({ error: "Trainer mismatch." });
    }

    if (isRecurring) {
      if (availability.availabilitySource !== "NORMAL" || !availability.recurrenceRule) {
        return res.status(400).json({ error: "Recurring booking not allowed for this slot." });
      }
    }

    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    const conflict = await ScheduleEvent.findOne({
      trainerId,
      eventType: "APPOINTMENT",
      status: { $in: APPOINTMENT_STATUSES },
      startDateTime: { $lt: end },
      endDateTime: { $gt: start },
    });

    if (conflict) {
      return res.status(409).json({ error: "Requested time conflicts with an existing booking." });
    }

    if (!isRecurring && availability.availabilitySource === "MANUAL" && !availability.recurrenceRule) {
      availability.eventType = "APPOINTMENT";
      availability.status = "REQUESTED";
      availability.clientId = userId;
      availability.requestedBy = userId;
      const updated = await availability.save();
      return res.json({ event: updated });
    }

    const appointment = new ScheduleEvent({
      trainerId,
      clientId: userId,
      startDateTime: start,
      endDateTime: end,
      eventType: "APPOINTMENT",
      status: "REQUESTED",
      recurrenceRule: isRecurring ? recurrenceRule || availability.recurrenceRule : null,
      recurrenceGroupId: isRecurring ? new mongoose.Types.ObjectId() : null,
      availabilitySource: availability.availabilitySource,
      requestedBy: userId,
    });

    const saved = await appointment.save();
    return res.json({ event: saved });
  } catch (err) {
    return next(err);
  }
};

const respond_booking = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { _id, status, startDateTime, endDateTime } = req.body;

    const existing = await ScheduleEvent.findById(_id);
    if (!existing) {
      return res.status(404).json({ error: "Schedule event not found." });
    }

    if (String(existing.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const updates = {};
    if (status) updates.status = status;
    if (startDateTime) updates.startDateTime = new Date(startDateTime);
    if (endDateTime) updates.endDateTime = new Date(endDateTime);

    if (status === "CANCELLED") {
      updates.cancelledBy = userId;
    }

    const updated = await ScheduleEvent.findByIdAndUpdate(_id, updates, { new: true });
    return res.json({ event: updated });
  } catch (err) {
    return next(err);
  }
};

const get_schedule_event_by_id = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { _id } = req.body;

    if (!_id) {
      return res.status(400).json({ error: "Schedule event id is required." });
    }

    const event = await ScheduleEvent.findById(_id).lean();
    if (!event) {
      return res.status(404).json({ error: "Schedule event not found." });
    }

    const isTrainer = String(event.trainerId) === String(userId);
    const isClient = event.clientId && String(event.clientId) === String(userId);

    if (!isTrainer && !isClient) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    return res.json({ event });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  get_schedule_range,
  create_schedule_event,
  update_schedule_event,
  cancel_schedule_event,
  request_booking,
  respond_booking,
  get_schedule_event_by_id,
};
