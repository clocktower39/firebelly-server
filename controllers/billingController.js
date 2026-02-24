const mongoose = require("mongoose");
const BillingLedgerEntry = require("../models/billingLedgerEntry");
const Relationship = require("../models/relationship");
const GroupMembership = require("../models/groupMembership");

const ACTIVE_STATUS = "ACTIVE";
const TRAINER_ROLES = new Set(["TRAINER", "COACH", "ADMIN"]);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const ensureRelationship = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const ensureGroupAccess = async (groupId, userId) => {
  if (!groupId || !userId) return null;
  return GroupMembership.findOne({ groupId, userId, status: ACTIVE_STATUS });
};

const buildLedgerMatch = ({ trainerId, clientId, groupId }) => {
  const match = { trainerId };
  if (clientId) match.clientId = clientId;
  if (groupId) match.groupId = groupId;
  return match;
};

const get_summary = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { trainerId, clientId, groupId } = req.body;

    if (!trainerId || !isValidObjectId(trainerId)) {
      return res.status(400).json({ error: "trainerId is required." });
    }

    if (clientId && groupId) {
      return res.status(400).json({ error: "Provide only clientId or groupId." });
    }

    if (String(trainerId) !== String(userId)) {
      if (clientId && String(clientId) === String(userId)) {
        const relationship = await ensureRelationship(trainerId, clientId);
        if (!relationship) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
      } else if (groupId) {
        const membership = await ensureGroupAccess(groupId, userId);
        if (!membership) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
      } else if (!isTrainer) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const match = buildLedgerMatch({ trainerId, clientId, groupId });
    const summaryAgg = await BillingLedgerEntry.aggregate([
      { $match: match },
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
          lastEntryAt: { $max: "$createdAt" },
          entryCount: { $sum: 1 },
        },
      },
    ]);

    const summary = summaryAgg[0] || {
      balance: 0,
      credits: 0,
      debits: 0,
      lastEntryAt: null,
      entryCount: 0,
    };

    return res.json({
      remainingSessions: summary.balance,
      credits: summary.credits,
      debits: Math.abs(summary.debits),
      lastEntryAt: summary.lastEntryAt,
      entryCount: summary.entryCount,
      dueForPayment: summary.balance <= 0,
    });
  } catch (err) {
    return next(err);
  }
};

const list_ledger_entries = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const { trainerId, clientId, groupId, limit = 100 } = req.body;

    if (!trainerId || !isValidObjectId(trainerId)) {
      return res.status(400).json({ error: "trainerId is required." });
    }

    if (clientId && groupId) {
      return res.status(400).json({ error: "Provide only clientId or groupId." });
    }

    if (String(trainerId) !== String(userId)) {
      if (clientId && String(clientId) === String(userId)) {
        const relationship = await ensureRelationship(trainerId, clientId);
        if (!relationship) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
      } else if (groupId) {
        const membership = await ensureGroupAccess(groupId, userId);
        if (!membership) {
          return res.status(403).json({ error: "Unauthorized access." });
        }
      } else if (!isTrainer) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const match = buildLedgerMatch({ trainerId, clientId, groupId });
    const entries = await BillingLedgerEntry.find(match)
      .sort({ createdAt: -1 })
      .limit(Math.min(Number(limit) || 100, 500))
      .lean();

    return res.json({ entries });
  } catch (err) {
    return next(err);
  }
};

const create_adjustment = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { trainerId, clientId, groupId, delta, notes = "" } = req.body;

    if (!trainerId || !isValidObjectId(trainerId)) {
      return res.status(400).json({ error: "trainerId is required." });
    }

    if (String(trainerId) !== String(userId)) {
      return res.status(403).json({ error: "Unauthorized access." });
    }

    if (clientId && groupId) {
      return res.status(400).json({ error: "Provide only clientId or groupId." });
    }

    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
      return res.status(400).json({ error: "delta must be a non-zero number." });
    }

    const entry = new BillingLedgerEntry({
      trainerId,
      clientId: clientId || null,
      groupId: groupId || null,
      entryType: "ADJUSTMENT",
      delta: numericDelta,
      source: "ADJUSTMENT",
      notes: String(notes || "").trim(),
      createdBy: userId,
    });

    const saved = await entry.save();
    return res.json({ entry: saved });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  get_summary,
  list_ledger_entries,
  create_adjustment,
};
