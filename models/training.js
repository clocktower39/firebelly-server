const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    accountId: { type: String, required: true },
    category: { type: String },
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
              weight: { type: Array },
            },
          },
        ],
      ],
      default: [
        [
          {
            exercise: "",
            goals: {
              sets: 1,
              minReps: 0,
              maxReps: 0,
            },
            achieved: {
              sets: 0,
              reps: [0],
              weight: [0],
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
