const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema({
  trainer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  client: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  requestedBy: { type: String, required: true },
  accepted: { type: Boolean, required: true },
})

const Relationship = mongoose.model('Relationship', relationshipSchema);
module.exports = Relationship;