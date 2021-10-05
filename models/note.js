const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    note: { type: String },
    accountId: { type: String, required: true },
    date: { type: Date, required: true },
})

const Note = mongoose.model('Note', noteSchema);
module.exports = Note;