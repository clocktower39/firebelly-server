const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
  {
    baseExercise: { type: String },
    equipment: { type: Array },
    generalVariation: { type: Array },
    tempo: { type: Array },
    anatomicalHandPosition: { type: Array },
    footSetup: { type: Array },
    handSetup: { type: Array },
    movementPattern: { type: Array },
    bodyPosition: { type: Array },
  },
  { minimize: false }
);

const Exercise = mongoose.model("Exercise", exerciseSchema);
module.exports = Exercise;
