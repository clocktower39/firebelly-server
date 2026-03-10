const mongoose = require("mongoose");

const sessionTypeSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    durationMinutes: { type: Number, default: 60, min: 1 },
    creditsRequired: { type: Number, default: 1, min: 0 },
    defaultPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
    defaultPayout: { type: Number, default: 0, min: 0 },
    payoutCurrency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
    active: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

sessionTypeSchema.index({ trainerId: 1, name: 1 }, { unique: true });

const SessionType = mongoose.model("SessionType", sessionTypeSchema);
module.exports = SessionType;
