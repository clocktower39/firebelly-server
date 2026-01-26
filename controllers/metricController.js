const MetricEntry = require("../models/metricEntry");
const Relationship = require("../models/relationship");
const User = require("../models/user");

const isTrainerForClient = async (trainerId, clientId) =>
  Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });

const parseHeightToInches = (heightValue) => {
  if (!heightValue) return null;
  const heightStr = String(heightValue).trim();
  const ftInMatch = heightStr.match(/(\d+)\s*'\s*(\d+)?/);
  if (ftInMatch) {
    const feet = Number(ftInMatch[1] || 0);
    const inches = Number(ftInMatch[2] || 0);
    const totalInches = feet * 12 + inches;
    return Number.isFinite(totalInches) && totalInches > 0 ? totalInches : null;
  }
  const numericHeight = Number(heightStr.replace(/[^\d.]/g, ""));
  if (!Number.isFinite(numericHeight) || numericHeight <= 0) return null;
  if (numericHeight > 100) {
    return numericHeight / 2.54;
  }
  return numericHeight;
};

const calculateBmi = (weightLbs, heightInches) => {
  if (!Number.isFinite(weightLbs) || !Number.isFinite(heightInches) || heightInches <= 0) {
    return null;
  }
  const bmi = (weightLbs / (heightInches * heightInches)) * 703;
  return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
};

const buildEntryPayload = (body) => {
  const weightValue = Number(body.weight);
  const bodyFatValue = Number(body.bodyFatPercent);
  const restingValue = Number(body.restingHeartRate);

  return {
    recordedAt: body.recordedAt ? new Date(body.recordedAt) : new Date(),
    weight:
      body.weight !== undefined && body.weight !== "" && Number.isFinite(weightValue)
        ? weightValue
        : undefined,
    bodyFatPercent:
      body.bodyFatPercent !== undefined && body.bodyFatPercent !== "" && Number.isFinite(bodyFatValue)
        ? bodyFatValue
        : undefined,
    restingHeartRate:
      body.restingHeartRate !== undefined && body.restingHeartRate !== "" && Number.isFinite(restingValue)
        ? restingValue
        : undefined,
    circumference: body.circumference || {},
  };
};

const get_target_user = async (req, res) => {
  const targetUserId = req.body.userId || res.locals.user._id;
  if (String(targetUserId) === String(res.locals.user._id)) {
    return { targetUserId, isTrainerView: false, relationship: null };
  }

  const relationship = await isTrainerForClient(res.locals.user._id, targetUserId);
  if (!relationship) {
    return null;
  }
  return { targetUserId, isTrainerView: true, relationship };
};

const create_metric_entry = async (req, res, next) => {
  try {
    const access = await get_target_user(req, res);
    if (!access) {
      return res.status(403).send({ error: "Not authorized to create metrics for this user." });
    }

    const { targetUserId, isTrainerView, relationship } = access;
    const entryPayload = buildEntryPayload(req.body);
    const userDoc = await User.findById(targetUserId).lean();
    const heightInches = parseHeightToInches(userDoc?.height);
    const bmiValue = calculateBmi(entryPayload.weight, heightInches);
    const approvalRequired = relationship?.metricsApprovalRequired ?? true;

    const entry = new MetricEntry({
      user: targetUserId,
      createdBy: res.locals.user._id,
      status: isTrainerView && approvalRequired ? "pending" : "approved",
      ...entryPayload,
      bmi: bmiValue ?? undefined,
    });

    const savedEntry = await entry.save();
    res.send(savedEntry);
  } catch (err) {
    next(err);
  }
};

const list_metrics = async (req, res, next) => {
  try {
    const access = await get_target_user(req, res);
    if (!access) {
      return res.status(403).send({ error: "Not authorized to view metrics for this user." });
    }
    const { targetUserId, isTrainerView } = access;

    const query = { user: targetUserId };
    if (isTrainerView) {
      query.$or = [{ status: "approved" }, { status: "pending", createdBy: res.locals.user._id }];
    } else {
      query.status = { $ne: "rejected" };
    }

    const entries = await MetricEntry.find(query).sort({ recordedAt: -1 }).lean();
    res.send(entries);
  } catch (err) {
    next(err);
  }
};

const list_pending_metrics = async (req, res, next) => {
  try {
    const pending = await MetricEntry.find({
      user: res.locals.user._id,
      status: "pending",
    })
      .sort({ recordedAt: -1 })
      .lean();
    res.send(pending);
  } catch (err) {
    next(err);
  }
};

const review_metric = async (req, res, next) => {
  try {
    const { entryId, approved } = req.body;
    const status = approved ? "approved" : "rejected";
    const entry = await MetricEntry.findOneAndUpdate(
      { _id: entryId, user: res.locals.user._id, status: "pending" },
      { status, reviewedBy: res.locals.user._id, reviewedAt: new Date() },
      { new: true }
    );
    if (!entry) {
      return res.status(404).send({ error: "Pending metric entry not found." });
    }
    res.send(entry);
  } catch (err) {
    next(err);
  }
};

const latest_metric = async (req, res, next) => {
  try {
    const access = await get_target_user(req, res);
    if (!access) {
      return res.status(403).send({ error: "Not authorized to view metrics for this user." });
    }
    const { targetUserId } = access;
    const latest = await MetricEntry.findOne({ user: targetUserId, status: "approved" })
      .sort({ recordedAt: -1 })
      .lean();
    res.send(latest || null);
  } catch (err) {
    next(err);
  }
};

const update_metric_entry = async (req, res, next) => {
  try {
    const { entryId } = req.body;
    const entry = await MetricEntry.findById(entryId);
    if (!entry) {
      return res.status(404).send({ error: "Metric entry not found." });
    }
    const isOwner = String(entry.user) === String(res.locals.user._id);
    const isCreator = String(entry.createdBy) === String(res.locals.user._id);
    if (!isOwner && !isCreator) {
      return res.status(403).send({ error: "Not authorized to update this entry." });
    }

    if (!isOwner && isCreator) {
      const relationship = await isTrainerForClient(res.locals.user._id, entry.user);
      if (!relationship) {
        return res.status(403).send({ error: "Not authorized to update this entry." });
      }
    }

    const entryPayload = buildEntryPayload(req.body);
    const userDoc = await User.findById(entry.user).lean();
    const heightInches = parseHeightToInches(userDoc?.height);
    const bmiValue = calculateBmi(entryPayload.weight, heightInches);

    entry.recordedAt = entryPayload.recordedAt;
    entry.weight = entryPayload.weight;
    entry.bodyFatPercent = entryPayload.bodyFatPercent;
    entry.restingHeartRate = entryPayload.restingHeartRate;
    entry.circumference = entryPayload.circumference;
    entry.bmi = bmiValue ?? undefined;

    const savedEntry = await entry.save();
    res.send(savedEntry);
  } catch (err) {
    next(err);
  }
};

const delete_metric_entry = async (req, res, next) => {
  try {
    const { entryId } = req.body;
    const entry = await MetricEntry.findById(entryId);
    if (!entry) {
      return res.status(404).send({ error: "Metric entry not found." });
    }
    const isOwner = String(entry.user) === String(res.locals.user._id);
    const isCreator = String(entry.createdBy) === String(res.locals.user._id);
    if (!isOwner && !isCreator) {
      return res.status(403).send({ error: "Not authorized to delete this entry." });
    }

    if (!isOwner && isCreator) {
      const relationship = await isTrainerForClient(res.locals.user._id, entry.user);
      if (!relationship) {
        return res.status(403).send({ error: "Not authorized to delete this entry." });
      }
    }

    await MetricEntry.deleteOne({ _id: entryId });
    res.send({ status: "success", entryId, userId: entry.user });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create_metric_entry,
  list_metrics,
  list_pending_metrics,
  review_metric,
  latest_metric,
  update_metric_entry,
  delete_metric_entry,
};
