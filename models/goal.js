const mongoose = require("mongoose");

const goalSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true, index: { unique: true } },
  description: { type: String },
  category: { type: String, enum: ["General", "Strength", "Cardio", "Skill", "Weight", ""], default: "General" },
  distanceUnit: { type: String, enum: ["Miles", "Kilometers", "Meters", "Yards", ""], default: "" },
  distanceValue: { type: Number },
  goalTime: { type: String },
  goalWeight: { type: Number },
  // Strength goal specific fields
  exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise" },
  targetWeight: { type: Number },
  targetReps: { type: Number },
  targetDate: { type: Date },
  achievedDate: { type: Date },
  achievementSeen: { type: Boolean, default: false },
  createdDate: { type: Date, required: true },
  comments: {
    type: [
      {
        createdDate: { type: Date, required: true },
        comment: { type: String, required: true },
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      },
    ],
  },
});

const Goal = mongoose.model("Goals", goalSchema);
module.exports = Goal;
