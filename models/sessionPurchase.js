const mongoose = require("mongoose");

const sessionPurchaseSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    sessionsPurchased: { type: Number, required: true, min: 1 },
    purchasedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

sessionPurchaseSchema.index({ trainerId: 1, clientId: 1, active: 1 });

const SessionPurchase = mongoose.model("SessionPurchase", sessionPurchaseSchema);
module.exports = SessionPurchase;
