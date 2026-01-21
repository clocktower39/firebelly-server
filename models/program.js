const mongoose = require("mongoose");

const programDaySchema = new mongoose.Schema(
  {
    dayIndex: { type: Number, required: true },
    workoutId: { type: mongoose.Schema.Types.ObjectId, ref: "Training", default: null },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const programSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, default: "" },
    description: { type: String, default: "" },
    weeksCount: { type: Number, required: true, min: 1, max: 52 },
    daysPerWeek: { type: Number, required: true, min: 1, max: 7 },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED"],
      default: "DRAFT",
    },
    publishedAt: { type: Date, default: null },
    price: { type: Number, default: null },
    coverImage: { type: String, default: null },
    tags: { type: [String], default: [] },
    category: { type: String, default: null },
    weeks: { type: [[programDaySchema]], default: [] },
  },
  { timestamps: true, minimize: false }
);

const Program = mongoose.model("Program", programSchema);
module.exports = Program;
