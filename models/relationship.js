const mongoose = require('mongoose');

const relationshipSchema = new mongoose.Schema({
  trainerId: { type: String, required: true },
  clientId: { type: String, required: true },
  requestedBy: { type: String, required: true },
  accepted: { type: Boolean, required: true },
})

const Relationship = mongoose.model('Relationship', relationshipSchema);
module.exports = Relationship;