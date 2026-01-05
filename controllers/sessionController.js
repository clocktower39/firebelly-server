const SessionPurchase = require("../models/sessionPurchase");
const ScheduleEvent = require("../models/scheduleEvent");
const Relationship = require("../models/relationship");

const ensureRelationship = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const create_purchase = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { clientId, sessionsPurchased, expiresAt, notes } = req.body;

    if (!clientId || !sessionsPurchased) {
      return res.status(400).json({ error: "clientId and sessionsPurchased are required." });
    }

    const relationship = await ensureRelationship(userId, clientId);
    if (!relationship) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const purchase = new SessionPurchase({
      trainerId: userId,
      clientId,
      sessionsPurchased,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      notes: notes || "",
    });

    const saved = await purchase.save();
    return res.json({ purchase: saved });
  } catch (err) {
    return next(err);
  }
};

const list_purchases = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { trainerId, clientId, activeOnly = false } = req.body;

    if (!trainerId && !clientId) {
      return res.status(400).json({ error: "trainerId or clientId is required." });
    }

    if (trainerId && String(trainerId) !== String(userId)) {
      const relationship = await ensureRelationship(trainerId, userId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    if (clientId && String(clientId) !== String(userId) && !trainerId) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    const query = {};
    if (trainerId) query.trainerId = trainerId;
    if (clientId) query.clientId = clientId;
    if (activeOnly) query.active = true;

    const purchases = await SessionPurchase.find(query).sort({ purchasedAt: -1 }).lean();
    return res.json({ purchases });
  } catch (err) {
    return next(err);
  }
};

const get_session_summary = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { trainerId, clientId } = req.body;

    if (!trainerId || !clientId) {
      return res.status(400).json({ error: "trainerId and clientId are required." });
    }

    const isTrainer = String(trainerId) === String(userId);
    const isClient = String(clientId) === String(userId);

    if (!isTrainer && !isClient) {
      const relationship = await ensureRelationship(trainerId, clientId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const now = new Date();
    const purchases = await SessionPurchase.find({
      trainerId,
      clientId,
      active: true,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    }).lean();

    const purchasedSessions = purchases.reduce(
      (total, purchase) => total + (purchase.sessionsPurchased || 0),
      0
    );

    const completedAppointments = await ScheduleEvent.countDocuments({
      trainerId,
      clientId,
      eventType: "APPOINTMENT",
      status: "COMPLETED",
    });

    const remainingSessions = Math.max(purchasedSessions - completedAppointments, 0);
    const dueForPayment = purchasedSessions === 0 || remainingSessions === 0;

    return res.json({
      purchasedSessions,
      completedAppointments,
      remainingSessions,
      dueForPayment,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_purchase,
  list_purchases,
  get_session_summary,
};
