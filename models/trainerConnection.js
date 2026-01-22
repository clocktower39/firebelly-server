const mongoose = require('mongoose');

const trainerConnectionSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  permissions: {
    type: [String],
    enum: ["templates", "programs"],
    default: ["templates", "programs"]
  },
}, { timestamps: true });

trainerConnectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

const TrainerConnection = mongoose.model('TrainerConnection', trainerConnectionSchema);
module.exports = TrainerConnection;
