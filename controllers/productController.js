const mongoose = require("mongoose");
const Product = require("../models/product");
const SessionType = require("../models/sessionType");
const Relationship = require("../models/relationship");

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);
const ITEM_TYPES = new Set(["SESSION", "PROGRAM", "NUTRITION", "MERCH", "CUSTOM"]);

const ensureRelationship = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const normalizeCredits = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : fallback;
};

const resolveSessionType = async (trainerId, sessionTypeId) => {
  if (!sessionTypeId || !isValidObjectId(sessionTypeId)) return null;
  const type = await SessionType.findOne({ _id: sessionTypeId, trainerId }).lean();
  return type || null;
};

const list_products = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const isTrainer = res.locals.user?.isTrainer;
    const trainerId = req.query.trainerId || (isTrainer ? userId : null);
    const activeOnly =
      req.query.activeOnly === undefined ? !isTrainer : req.query.activeOnly === "true";

    if (!trainerId || !isValidObjectId(trainerId)) {
      return res.status(400).json({ error: "trainerId is required." });
    }

    if (String(trainerId) !== String(userId)) {
      const relationship = await ensureRelationship(trainerId, userId);
      if (!relationship) {
        return res.status(403).json({ error: "Unauthorized access." });
      }
    }

    const query = { trainerId };
    if (activeOnly) query.active = true;

    const products = await Product.find(query)
      .populate("sessionTypeId", "name creditsRequired durationMinutes")
      .sort({ name: 1 })
      .lean();
    return res.json({ products });
  } catch (err) {
    return next(err);
  }
};

const create_product = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!user?.isTrainer) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const {
      itemType,
      name,
      description,
      price,
      currency,
      taxable,
      active,
      sessionTypeId,
      creditsPerUnit,
      deliverableType,
      deliverableValue,
    } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Name is required." });
    }

    const normalizedType = ITEM_TYPES.has(itemType) ? itemType : "CUSTOM";

    let resolvedSessionTypeId = null;
    let resolvedCredits = 0;

    if (normalizedType === "SESSION") {
      const sessionType = await resolveSessionType(user._id, sessionTypeId);
      if (!sessionType) {
        return res.status(400).json({ error: "Valid sessionTypeId is required for sessions." });
      }
      resolvedSessionTypeId = sessionType._id;
      resolvedCredits =
        normalizeCredits(creditsPerUnit, sessionType.creditsRequired || 1) || 1;
    }

    const product = new Product({
      trainerId: user._id,
      itemType: normalizedType,
      name: String(name).trim(),
      description: description ? String(description).trim() : "",
      price: normalizeCredits(price, 0),
      currency: currency || "USD",
      taxable: taxable !== undefined ? Boolean(taxable) : true,
      active: active !== undefined ? Boolean(active) : true,
      sessionTypeId: resolvedSessionTypeId,
      creditsPerUnit: resolvedCredits,
      deliverableType: deliverableType || "NONE",
      deliverableValue: String(deliverableValue || "").trim(),
    });

    const saved = await product.save();
    return res.json({ product: saved });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Product name already exists." });
    }
    return next(err);
  }
};

const update_product = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!user?.isTrainer) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid product id." });
    }

    const existing = await Product.findById(id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Product not found." });
    }

    const {
      itemType,
      name,
      description,
      price,
      currency,
      taxable,
      active,
      sessionTypeId,
      creditsPerUnit,
      deliverableType,
      deliverableValue,
    } = req.body;

    const updates = {};
    if (itemType !== undefined) {
      updates.itemType = ITEM_TYPES.has(itemType) ? itemType : "CUSTOM";
    }
    if (name !== undefined) updates.name = String(name).trim();
    if (description !== undefined) updates.description = String(description).trim();
    if (price !== undefined) updates.price = normalizeCredits(price, 0);
    if (currency !== undefined) updates.currency = currency || "USD";
    if (taxable !== undefined) updates.taxable = Boolean(taxable);
    if (active !== undefined) updates.active = Boolean(active);
    if (deliverableType !== undefined) updates.deliverableType = deliverableType || "NONE";
    if (deliverableValue !== undefined) {
      updates.deliverableValue = String(deliverableValue || "").trim();
    }

    if ((updates.itemType || existing.itemType) === "SESSION") {
      const sessionType = await resolveSessionType(
        user._id,
        sessionTypeId !== undefined ? sessionTypeId : existing.sessionTypeId
      );
      if (!sessionType) {
        return res.status(400).json({ error: "Valid sessionTypeId is required for sessions." });
      }
      updates.sessionTypeId = sessionType._id;
      updates.creditsPerUnit = normalizeCredits(
        creditsPerUnit !== undefined ? creditsPerUnit : existing.creditsPerUnit,
        sessionType.creditsRequired || 1
      );
    } else if (itemType !== undefined && itemType !== "SESSION") {
      updates.sessionTypeId = null;
      updates.creditsPerUnit = 0;
    }

    const updated = await Product.findByIdAndUpdate(id, updates, { new: true });
    return res.json({ product: updated });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "Product name already exists." });
    }
    return next(err);
  }
};

const delete_product = async (req, res, next) => {
  try {
    const user = res.locals.user;
    if (!user?.isTrainer) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: "Invalid product id." });
    }

    const existing = await Product.findById(id);
    if (!existing || String(existing.trainerId) !== String(user._id)) {
      return res.status(404).json({ error: "Product not found." });
    }

    await Product.deleteOne({ _id: id });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  list_products,
  create_product,
  update_product,
  delete_product,
};
