const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: { type: String, required: true, index: { unique: true } },
    goal: { type: Number, required: true },
    achieved: { type: Number, required: true },
    accountId: { type: String, required: true },
    date: { type: Date, required: true },
})

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;