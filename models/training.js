const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    accountId: { type: String, required: true },
    category: { type: String, required: true },
    training: {
      type: [
        [
          {
            exercise: { type: String },
            goals: {
              sets: { type: Number },
              minReps: { type: Number },
              maxReps: { type: Number },
            },
            achieved: {
              sets: { type: Number },
              reps: { type: Array },
            },
          },
        ],
      ],
      default: [
        [
          {
            exercise: "Unset",
            goals: {
              sets: 0,
              minReps: 0,
              maxReps: 0,
            },
            achieved: {
              sets: 0,
              reps: [],
            },
          },
        ],
      ],
      required: true,
    },
  },
  { minimize: false }
);

const Training = mongoose.model("Training", trainingSchema);
module.exports = Training;
