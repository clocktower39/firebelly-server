const SessionType = require("../models/sessionType");

const ensureTrainer = (user) => user && user.isTrainer;

const list_session_types = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const types = await SessionType.find({ trainerId: user._id }).sort({ name: 1 }).lean();
    return res.json({ sessionTypes: types });
  } catch (err) {
    return next(err);
  }
};

const create_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { name, description, defaultPrice, currency } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    const sessionType = new SessionType({
      trainerId: user._id,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      defaultPrice: Number.isFinite(Number(defaultPrice)) ? Number(defaultPrice) : 0,
      currency: currency || "USD",
    });
    const saved = await sessionType.save();
    return res.json({ sessionType: saved });
  } catch (err) {
    return next(err);
  }
};

const update_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { id } = req.params;
    const { name, description, defaultPrice, currency } = req.body;
    const existing = await SessionType.findById(id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    const updates = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: String(description).trim() } : {}),
      ...(defaultPrice !== undefined
        ? { defaultPrice: Number.isFinite(Number(defaultPrice)) ? Number(defaultPrice) : 0 }
        : {}),
      ...(currency ? { currency } : {}),
    };
    const updated = await SessionType.findByIdAndUpdate(id, updates, { new: true });
    return res.json({ sessionType: updated });
  } catch (err) {
    return next(err);
  }
};

const delete_session_type = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    const { id } = req.params;
    const existing = await SessionType.findById(id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    await SessionType.deleteOne({ _id: id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  list_session_types,
  create_session_type,
  update_session_type,
  delete_session_type,
};
