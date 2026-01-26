const mongoose = require("mongoose");

const sessionTypeSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    defaultPrice: { type: Number, default: 0, min: 0 },
    currency: { type: String, enum: ["USD", "EUR", "JPY"], default: "USD" },
  },
  { timestamps: true }
);

sessionTypeSchema.index({ trainerId: 1, name: 1 }, { unique: true });

const SessionType = mongoose.model("SessionType", sessionTypeSchema);
module.exports = SessionType;
