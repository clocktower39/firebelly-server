const express = require('express');
const conversationController = require('../controllers/conversationController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.get('/conversation/getConversations', verifyAccessToken, conversationController.get_conversations);
router.post('/conversation/create', verifyAccessToken, conversationController.create_conversation);
router.post('/conversation/message/delete', verifyAccessToken, conversationController.delete_message);
router.post('/conversation/message/send', verifyAccessToken, conversationController.send_message);

module.exports = router;