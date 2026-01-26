const mongoose = require("mongoose");

const circumferenceSchema = new mongoose.Schema(
  {
    neck: { type: Number },
    shoulders: { type: Number },
    arms: { type: Number },
    forearms: { type: Number },
    chest: { type: Number },
    waist: { type: Number },
    glutes: { type: Number },
    thighs: { type: Number },
    calves: { type: Number },
  },
  { _id: false }
);

const metricEntrySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    recordedAt: { type: Date, required: true },
    status: { type: String, enum: ["approved", "pending", "rejected"], default: "approved" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    weight: { type: Number },
    bodyFatPercent: { type: Number },
    bmi: { type: Number },
    restingHeartRate: { type: Number },
    circumference: { type: circumferenceSchema },
  },
  { minimize: false }
);

const MetricEntry = mongoose.model("MetricEntry", metricEntrySchema);
module.exports = MetricEntry;
