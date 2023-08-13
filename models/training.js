const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const trainingSchema = new mongoose.Schema(
  {
    title: { type: String },
    date: { type: Date },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
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
              oneRepMax: { type: Number },
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

trainingSchema.plugin(mongoosePaginate);

const Training = mongoose.model("Training", trainingSchema);
module.exports = Training;
