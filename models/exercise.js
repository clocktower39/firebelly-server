const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema(
  {
    exerciseTitle: { type: String, required: true, unique: true, },
    muscleGroups: {
      primary: { type: Array, required: true, default: [], },
      secondary: { type: Array, required: true, default: [], },
    },
    equipment: { type: Array, required: true, default: [], },
    instructions: { type: String, required: false, default: '', },
    tags: { type: Array, required: true, default: [], },

    generalVariation: { type: Array },
    tempo: { type: Array },
    anatomicalHandPosition: { type: Array },
    footSetup: { type: Array },
    handSetup: { type: Array },
    movementPattern: { type: Array },
    bodyPosition: { type: Array },
    verified: { type: Boolean, default: false, required: true, },
  },
  { minimize: false }
);

const Exercise = mongoose.model("Exercise", exerciseSchema);
module.exports = Exercise;