const mongoose = require("mongoose");

const trainingSchema = new mongoose.Schema(
  {
    date: { type: Date, required: true },
    accountId: { type: String, required: true },
    category: { type: Array, required: true },
    training: {
      type: [
        [
          {
            exercise: { type: String },
            exerciseType: { type: String },
            goals: {
              sets: { type: Number },
              minReps: { type: Array },
              maxReps: { type: Array },
              exactReps: { type: Array },
              weight: { type: Array },
              percent: { type: Array },
              seconds: { type: Array },
            },
            achieved: {
              sets: { type: Number },
              reps: { type: Array },
              weight: { type: Array },
              percent: { type: Array },
              seconds: { type: Array },
            },
          },
        ],
      ],
      default: [
        [
          {
            exercise: "",
            exerciseType: "Reps",
            goals: {
              sets: 1,
              minReps: [0],
              maxReps: [0],
              exactReps: [0],
              weight: [0],
              percent: [0],
              seconds: [0],
            },
            achieved: {
              sets: 0,
              reps: [0],
              weight: [0],
              percent: [0],
              seconds: [0],
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
