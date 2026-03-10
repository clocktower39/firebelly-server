const BillingLedgerEntry = require("../models/billingLedgerEntry");
const ScheduleEvent = require("../models/scheduleEvent");
const SessionType = require("../models/sessionType");

const getEventLedgerNet = async (eventId) => {
  if (!eventId) return 0;
  const summary = await BillingLedgerEntry.aggregate([
    { $match: { eventId } },
    { $group: { _id: null, net: { $sum: "$delta" } } },
  ]);
  return summary[0]?.net || 0;
};

const resolveEventCredits = async (event) => {
  if (!event?.sessionTypeId) return 1;
  const type = await SessionType.findById(event.sessionTypeId).lean();
  if (!type) return 1;
  const credits = Number(type.creditsRequired);
  return Number.isFinite(credits) && credits > 0 ? credits : 1;
};

const createEventDebitEntry = async ({ event, userId, source }) => {
  if (!event || !event.clientId) return null;
  const net = await getEventLedgerNet(event._id);
  if (net < 0) return null;
  const credits = await resolveEventCredits(event);

  const entry = new BillingLedgerEntry({
    trainerId: event.trainerId,
    clientId: event.clientId,
    sessionTypeId: event.sessionTypeId || null,
    entryType: "DEBIT",
    delta: -credits,
    source,
    eventId: event._id,
    notes: `Session ${source === "CANCELLATION_CHARGED" ? "cancellation charged" : "completed"}`,
    createdBy: userId,
  });
  const saved = await entry.save();
  await ScheduleEvent.findByIdAndUpdate(event._id, { billingLedgerEntryId: saved._id });
  return saved;
};

const reverseEventDebitEntry = async ({ event, userId }) => {
  if (!event || !event.clientId) return null;
  const net = await getEventLedgerNet(event._id);
  if (net >= 0) return null;

  const reversal = new BillingLedgerEntry({
    trainerId: event.trainerId,
    clientId: event.clientId,
    sessionTypeId: event.sessionTypeId || null,
    entryType: "ADJUSTMENT",
    delta: Math.abs(net),
    source: "REVERSAL",
    eventId: event._id,
    notes: "Reversed session debit",
    createdBy: userId,
  });

  return reversal.save();
};

module.exports = {
  createEventDebitEntry,
  reverseEventDebitEntry,
};
