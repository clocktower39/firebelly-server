const express = require('express');
const conversationController = require('../controllers/conversationController');
const auth = require("../middleware/auth");

const router = express.Router();

router.get('/conversation/getConversations', auth, conversationController.get_conversations);
router.post('/conversation/create', auth, conversationController.create_conversation);
router.post('/conversation/message/delete', auth, conversationController.delete_message);
router.post('/conversation/message/send', auth, conversationController.send_message);

module.exports = router;