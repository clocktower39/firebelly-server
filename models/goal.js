const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, index: { unique: true } },
    description: { type: String, required: true, },
    targetDate: { type: Date },
    achievedDate: { type: Date },
    createdDate: { type: Date, required: true },
    comments: {
        type: [{
            createdDate: { type: Date, required: true },
            comment: { type: String, required: true }
        }]
    }
})

const Goal = mongoose.model('Goals', goalSchema);
module.exports = Goal;