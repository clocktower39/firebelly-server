const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    note: { type: String, required: true },
    account: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: Date, required: true },
})

const Note = mongoose.model('Note', noteSchema);
module.exports = Note;