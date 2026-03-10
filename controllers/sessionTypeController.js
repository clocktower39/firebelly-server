const SessionType = require("../models/sessionType");

const ensureTrainer = (user) => user && user.isTrainer;

const DEFAULT_SESSION_TYPES = [
  { name: "60 Min Session", durationMinutes: 60, creditsRequired: 1 },
  { name: "30 Min Session", durationMinutes: 30, creditsRequired: 0.5 },
];

const ensureDefaultSessionTypes = async (trainerId) => {
  const names = DEFAULT_SESSION_TYPES.map((type) => type.name);
  const existing = await SessionType.find({ trainerId, name: { $in: names } }).lean();
  const existingMap = new Map(existing.map((type) => [type.name, type]));

  const creates = [];
  const updates = [];

  DEFAULT_SESSION_TYPES.forEach((spec) => {
    const found = existingMap.get(spec.name);
    if (!found) {
      creates.push(
        new SessionType({
          trainerId,
          name: spec.name,
          description: "",
          durationMinutes: spec.durationMinutes,
          creditsRequired: spec.creditsRequired,
          defaultPrice: null,
          currency: "USD",
          defaultPayout: null,
          payoutCurrency: "USD",
          active: true,
          isDefault: true,
        }).save()
      );
    } else if (
      found.isDefault !== true ||
      Number(found.durationMinutes) !== Number(spec.durationMinutes) ||
      Number(found.creditsRequired) !== Number(spec.creditsRequired)
    ) {
      updates.push(
        SessionType.updateOne(
          { _id: found._id },
          {
            $set: {
              isDefault: true,
              durationMinutes: spec.durationMinutes,
              creditsRequired: spec.creditsRequired,
            },
          }
        )
      );
    }
  });

  if (creates.length || updates.length) {
    await Promise.all([...creates, ...updates]);
  }
};

const list_session_types = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!ensureTrainer(user)) {
      return res.status(403).json({ error: "Trainer access required." });
    }
    await ensureDefaultSessionTypes(user._id);
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
    const {
      name,
      description,
      durationMinutes,
      creditsRequired,
      defaultPrice,
      currency,
      defaultPayout,
      payoutCurrency,
      active,
    } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required." });
    }
    const sessionType = new SessionType({
      trainerId: user._id,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      durationMinutes: Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 60,
      creditsRequired: Number.isFinite(Number(creditsRequired)) ? Number(creditsRequired) : 1,
      defaultPrice: defaultPrice === "" || defaultPrice === null
        ? null
        : Number.isFinite(Number(defaultPrice))
          ? Number(defaultPrice)
          : 0,
      currency: currency || "USD",
      defaultPayout: defaultPayout === "" || defaultPayout === null
        ? null
        : Number.isFinite(Number(defaultPayout))
          ? Number(defaultPayout)
          : 0,
      payoutCurrency: payoutCurrency || "USD",
      active: active !== undefined ? Boolean(active) : true,
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
    const {
      name,
      description,
      durationMinutes,
      creditsRequired,
      defaultPrice,
      currency,
      defaultPayout,
      payoutCurrency,
      active,
    } = req.body;
    const existing = await SessionType.findById(id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Session type not found." });
    }
    const updates = {
      ...(name !== undefined ? { name: String(name).trim() } : {}),
      ...(description !== undefined ? { description: String(description).trim() } : {}),
      ...(durationMinutes !== undefined
        ? { durationMinutes: Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : 60 }
        : {}),
      ...(creditsRequired !== undefined
        ? { creditsRequired: Number.isFinite(Number(creditsRequired)) ? Number(creditsRequired) : 1 }
        : {}),
      ...(defaultPrice !== undefined
        ? {
            defaultPrice:
              defaultPrice === "" || defaultPrice === null
                ? null
                : Number.isFinite(Number(defaultPrice))
                  ? Number(defaultPrice)
                  : 0,
          }
        : {}),
      ...(currency ? { currency } : {}),
      ...(defaultPayout !== undefined
        ? {
            defaultPayout:
              defaultPayout === "" || defaultPayout === null
                ? null
                : Number.isFinite(Number(defaultPayout))
                  ? Number(defaultPayout)
                  : 0,
          }
        : {}),
      ...(payoutCurrency ? { payoutCurrency } : {}),
      ...(active !== undefined ? { active: Boolean(active) } : {}),
    };

    if (existing.isDefault) {
      const spec = DEFAULT_SESSION_TYPES.find((entry) => entry.name === existing.name);
      updates.name = existing.name;
      if (spec) {
        updates.durationMinutes = spec.durationMinutes;
        updates.creditsRequired = spec.creditsRequired;
      }
    }
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
    if (existing.isDefault) {
      return res.status(400).json({ error: "Default session types cannot be deleted." });
    }
    await SessionType.deleteOne({ _id: id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  ensureDefaultSessionTypes,
  list_session_types,
  create_session_type,
  update_session_type,
  delete_session_type,
};
