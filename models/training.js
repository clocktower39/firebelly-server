const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const commentSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    text: { type: String, required: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: true }
);

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
            exercise: { type: mongoose.Schema.Types.ObjectId, ref: "Exercise", required: true },
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
            feedback: {
              difficulty: { type: Number, min: 0, max: 2, default: 1 },
              comments: { type: [commentSchema], default: [], }
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
    workoutFeedback: {
      difficulty: { type: Number, min: 0, max: 2, default: 1 },
      comments: { type: [commentSchema], default: [], }
    },
    queuePosition: {
      type: Number,
      default: 0,
    },
    isTemplate: { type: Boolean, default: false },
    complete: { type: Boolean, default: false },
  },
  { minimize: false }
);

trainingSchema.plugin(mongoosePaginate);

const Training = mongoose.model("Training", trainingSchema);
module.exports = Training;
