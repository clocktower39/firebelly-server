const mongoose = require("mongoose");
const ScheduleEvent = require("../models/scheduleEvent");
const User = require("../models/user");
const Relationship = require("../models/relationship");
const SessionType = require("../models/sessionType");

const APPOINTMENT_STATUSES = ["REQUESTED", "BOOKED", "COMPLETED"];

const ensureRelationship = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const normalizePrice = (amount, currency) => {
  if (amount === undefined) return {};
  const numeric = amount === "" || amount === null ? null : Number(amount);
  return {
    priceAmount: Number.isFinite(numeric) ? numeric : null,
    priceCurrency: currency || "USD",
  };
};

const resolveSessionType = async (trainerId, sessionTypeId) => {
  if (!sessionTypeId) return null;
  const type = await SessionType.findOne({ _id: sessionTypeId, trainerId });
  return type ? type._id : null;
};

const overlaps = (event, start, end) =>
  event.startDateTime < end && event.endDateTime > start;

const merge_open_availability = async (event) => {
  if (
    !event ||
    event.eventType !== "AVAILABILITY" ||
    event.status !== "OPEN" ||
    event.recurrenceRule ||
    event.availabilitySource !== "MANUAL"
  ) {
    return event;
  }

  const start = new Date(event.startDateTime);
  const end = new Date(event.endDateTime);

  const candidates = await ScheduleEvent.find({
    trainerId: event.trainerId,
    eventType: "AVAILABILITY",
    status: "OPEN",
    availabilitySource: "MANUAL",
    recurrenceRule: null,
    _id: { $ne: event._id },
    startDateTime: { $lte: end },
    endDateTime: { $gte: start },
  });

  if (!candidates.length) return event;

  let minStart = start;
  let maxEnd = end;
  const idsToDelete = [];

  candidates.forEach((slot) => {
    if (slot.startDateTime < minStart) minStart = slot.startDateTime;
    if (slot.endDateTime > maxEnd) maxEnd = slot.endDateTime;
    idsToDelete.push(slot._id);
  });

  await ScheduleEvent.deleteMany({ _id: { $in: idsToDelete } });
  const merged = await ScheduleEvent.findByIdAndUpdate(
    event._id,
    { startDateTime: minStart, endDateTime: maxEnd },
    { new: true }
  );

  return merged || event;
};

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

      const busyAppointments = booked
        .filter((appt) => String(appt.clientId) !== String(userId))
        .map((appt) => ({
          _id: `busy-${appt._id}`,
          trainerId: appt.trainerId,
          eventType: "APPOINTMENT",
          status: "BOOKED",
          startDateTime: appt.startDateTime,
          endDateTime: appt.endDateTime,
        }));

      return res.json({ events: [...filtered, ...busyAppointments] });
    }

    return res.json({ events });
  } catch (err) {
    return next(err);
  }
};

const get_public_schedule_range = async (req, res, next) => {
  try {
    const { startDate, endDate, trainerId } = req.body;

    if (!startDate || !endDate || !trainerId) {
      return res.status(400).json({ error: "startDate, endDate, and trainerId are required." });
    }

    const trainer = await User.findById(trainerId).lean();
    if (!trainer || !trainer.isTrainer) {
      const [hasClients, hasEvents] = await Promise.all([
        Relationship.exists({ trainer: trainerId }),
        ScheduleEvent.exists({ trainerId }),
      ]);
      if (!hasClients && !hasEvents) {
        return res.status(404).json({ error: "Trainer not found." });
      }
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    const events = await ScheduleEvent.find({
      trainerId,
      startDateTime: { $lt: end },
      endDateTime: { $gt: start },
      status: { $ne: "CANCELLED" },
    }).lean();

    const sanitized = events
      .filter((event) => {
        if (event.eventType === "AVAILABILITY") return event.status === "OPEN";
        return ["APPOINTMENT", "INDEPENDENT"].includes(event.eventType);
      })
      .map((event) => ({
        _id: event._id,
        trainerId: event.trainerId,
        eventType: event.eventType === "AVAILABILITY" ? "AVAILABILITY" : "APPOINTMENT",
        status: event.eventType === "AVAILABILITY" ? event.status : "BOOKED",
        startDateTime: event.startDateTime,
        endDateTime: event.endDateTime,
        availabilitySource: event.availabilitySource || null,
        publicLabel: event.publicLabel || "",
      }));

    return res.json({ events: sanitized });
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

    if (!payload.sessionTypeId) {
      payload.sessionTypeId = null;
    } else {
      payload.sessionTypeId = await resolveSessionType(userId, payload.sessionTypeId);
    }
    if (payload.priceAmount !== undefined || payload.priceCurrency !== undefined) {
      Object.assign(payload, normalizePrice(payload.priceAmount, payload.priceCurrency));
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

    if (updates?.sessionTypeId !== undefined) {
      const requestedId = updates.sessionTypeId || null;
      updates.sessionTypeId = requestedId
        ? await resolveSessionType(userId, requestedId)
        : null;
    }
    if (updates?.priceAmount !== undefined || updates?.priceCurrency !== undefined) {
      Object.assign(updates, normalizePrice(updates.priceAmount, updates.priceCurrency));
    }
    let updated = await ScheduleEvent.findByIdAndUpdate(_id, updates, { new: true });
    updated = await merge_open_availability(updated);
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

    const availabilityStart = new Date(availability.startDateTime);
    const availabilityEnd = new Date(availability.endDateTime);
    const requestedStart = new Date(startDateTime);
    const requestedEnd = new Date(endDateTime);

    if (requestedStart < availabilityStart || requestedEnd > availabilityEnd) {
      return res.status(400).json({ error: "Requested time is outside availability range." });
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

    const appointment = new ScheduleEvent({
      trainerId,
      clientId: userId,
      startDateTime: requestedStart,
      endDateTime: requestedEnd,
      eventType: "APPOINTMENT",
      status: "REQUESTED",
      recurrenceRule: isRecurring ? recurrenceRule || availability.recurrenceRule : null,
      recurrenceGroupId: isRecurring ? new mongoose.Types.ObjectId() : null,
      availabilitySource: availability.availabilitySource,
      requestedBy: userId,
    });

    const saved = await appointment.save();

    if (!availability.recurrenceRule && availability.availabilitySource === "MANUAL") {
      const remaining = [];
      if (requestedStart > availabilityStart) {
        remaining.push({
          startDateTime: availabilityStart,
          endDateTime: requestedStart,
        });
      }
      if (requestedEnd < availabilityEnd) {
        remaining.push({
          startDateTime: requestedEnd,
          endDateTime: availabilityEnd,
        });
      }

      await ScheduleEvent.findByIdAndDelete(availability._id);

      if (remaining.length > 0) {
        await Promise.all(
          remaining.map((slot) =>
            new ScheduleEvent({
              trainerId,
              clientId: null,
              eventType: "AVAILABILITY",
              status: "OPEN",
              availabilitySource: "MANUAL",
              startDateTime: slot.startDateTime,
              endDateTime: slot.endDateTime,
            }).save()
          )
        );
      }
    }
    return res.json({ event: saved });
  } catch (err) {
    return next(err);
  }
};

const trainer_book_availability = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const {
      availabilityEventId,
      clientId,
      startDateTime,
      endDateTime,
      workoutId,
      customClientName,
      customClientEmail,
      customClientPhone,
      sessionTypeId,
    } = req.body;

    const hasCustomName = Boolean(customClientName && String(customClientName).trim());

    if (!availabilityEventId || (!clientId && !hasCustomName) || !startDateTime || !endDateTime) {
      return res.status(400).json({ error: "Missing booking fields." });
    }

    if (clientId) {
      const relationship = await ensureRelationship(userId, clientId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const availability = await ScheduleEvent.findById(availabilityEventId);
    if (!availability || availability.eventType !== "AVAILABILITY") {
      return res.status(404).json({ error: "Availability slot not found." });
    }
    if (availability.status !== "OPEN") {
      return res.status(409).json({ error: "Availability slot is no longer open." });
    }
    if (String(availability.trainerId) !== String(userId)) {
      return res.status(400).json({ error: "Trainer mismatch." });
    }

    const availabilityStart = new Date(availability.startDateTime);
    const availabilityEnd = new Date(availability.endDateTime);
    const requestedStart = new Date(startDateTime);
    const requestedEnd = new Date(endDateTime);

    if (requestedStart < availabilityStart || requestedEnd > availabilityEnd) {
      return res.status(400).json({ error: "Requested time is outside availability range." });
    }

    const conflict = await ScheduleEvent.findOne({
      trainerId: userId,
      eventType: "APPOINTMENT",
      status: { $in: APPOINTMENT_STATUSES },
      startDateTime: { $lt: requestedEnd },
      endDateTime: { $gt: requestedStart },
    });

    if (conflict) {
      return res.status(409).json({ error: "Requested time conflicts with an existing booking." });
    }

    const resolvedSessionTypeId = await resolveSessionType(userId, sessionTypeId);
    const appointment = new ScheduleEvent({
      trainerId: userId,
      clientId: clientId || null,
      startDateTime: requestedStart,
      endDateTime: requestedEnd,
      eventType: "APPOINTMENT",
      status: "BOOKED",
      availabilitySource: availability.availabilitySource,
      workoutId: workoutId || null,
      sessionTypeId: resolvedSessionTypeId,
      customClientName: hasCustomName ? String(customClientName).trim() : "",
      customClientEmail: customClientEmail ? String(customClientEmail).trim() : "",
      customClientPhone: customClientPhone ? String(customClientPhone).trim() : "",
      requestedBy: userId,
    });

    const saved = await appointment.save();

    if (!availability.recurrenceRule && availability.availabilitySource === "MANUAL") {
      const remaining = [];
      if (requestedStart > availabilityStart) {
        remaining.push({
          startDateTime: availabilityStart,
          endDateTime: requestedStart,
        });
      }
      if (requestedEnd < availabilityEnd) {
        remaining.push({
          startDateTime: requestedEnd,
          endDateTime: availabilityEnd,
        });
      }

      await ScheduleEvent.findByIdAndDelete(availability._id);

      if (remaining.length > 0) {
        await Promise.all(
          remaining.map((slot) =>
            new ScheduleEvent({
              trainerId: userId,
              clientId: null,
              eventType: "AVAILABILITY",
              status: "OPEN",
              availabilitySource: "MANUAL",
              startDateTime: slot.startDateTime,
              endDateTime: slot.endDateTime,
            }).save()
          )
        );
      }
    }

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

const get_schedule_event_by_workout = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { workoutId } = req.body;

    if (!workoutId) {
      return res.status(400).json({ error: "Workout id is required." });
    }

    const event = await ScheduleEvent.findOne({
      workoutId,
      status: { $ne: "CANCELLED" },
    })
      .sort({ startDateTime: -1 })
      .lean();

    if (!event) {
      return res.json({ event: null });
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

const delete_schedule_event = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { _id } = req.body;

    const existing = await ScheduleEvent.findById(_id);
    if (!existing) {
      return res.status(404).json({ error: "Schedule event not found." });
    }

    if (String(existing.trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    await ScheduleEvent.findByIdAndDelete(_id);
    return res.json({ status: "deleted" });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  get_schedule_range,
  create_schedule_event,
  update_schedule_event,
  cancel_schedule_event,
  delete_schedule_event,
  request_booking,
  get_public_schedule_range,
  trainer_book_availability,
  respond_booking,
  get_schedule_event_by_id,
  get_schedule_event_by_workout,
};
