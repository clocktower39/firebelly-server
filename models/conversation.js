const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    messages: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            message: { type: String },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { minimize: false })

const Conversation = mongoose.model('Conversation', ConversationSchema);
module.exports = Conversation;