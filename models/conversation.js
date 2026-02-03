const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", default: null },
    messages: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            message: { type: String },
            timestamp: { type: Date, default: Date.now },
        },
    ],
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { minimize: false })

ConversationSchema.index({ groupId: 1 }, { unique: true, sparse: true });

const Conversation = mongoose.model('Conversation', ConversationSchema);
module.exports = Conversation;
