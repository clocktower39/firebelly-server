const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    accountId: { type: String, required: true },
    history: {
        type: [
            {
                date: { type: String, required: true, index: { unique: true } },
                tasks: {
                    type: [
                        {
                            title: { type: String },
                            goal: { type: Number },
                            achieved: { type: Number },
                        }
                    ]
                }
            },
        ],
        default: [],
        required: true
    },
    defaultTasks: {
        type: [],
        required: true
    },
})

const Task = mongoose.model('Task', taskSchema);
module.exports = Task;