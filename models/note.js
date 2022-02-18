const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
    note: { type: String, required: true },
    accountId: { type: String, required: true },
    date: { type: Date, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
})

const Note = mongoose.model('Note', noteSchema);
module.exports = Note;