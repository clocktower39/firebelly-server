const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    accountId: { type: String, required: true },
    date: { type: Date, required: true },
    tasks: {
        type: [
            {
                title: { type: String },
                goal: { type: Number },
                achieved: { type: Number },
            },
        ],
        default: [
            
        ],
        required: true,
    }
})

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;