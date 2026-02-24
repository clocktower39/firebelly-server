const SessionPurchase = require("../models/sessionPurchase");
const Relationship = require("../models/relationship");
const BillingLedgerEntry = require("../models/billingLedgerEntry");

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

    const ledgerSummary = await BillingLedgerEntry.aggregate([
      { $match: { trainerId, clientId } },
      {
        $group: {
          _id: null,
          balance: { $sum: "$delta" },
          credits: {
            $sum: {
              $cond: [{ $gt: ["$delta", 0] }, "$delta", 0],
            },
          },
          debits: {
            $sum: {
              $cond: [{ $lt: ["$delta", 0] }, "$delta", 0],
            },
          },
        },
      },
    ]);

    const summary = ledgerSummary[0] || { balance: 0, credits: 0, debits: 0 };

    return res.json({
      purchasedSessions: summary.credits,
      completedAppointments: Math.abs(summary.debits),
      remainingSessions: summary.balance,
      dueForPayment: summary.balance <= 0,
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
