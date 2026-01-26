const express = require('express');
const trainerConnectionController = require('../controllers/trainerConnectionController');
const { verifyAccessToken } = require("../middleware/auth");

const router = express.Router();

router.post('/trainer-connections/search', verifyAccessToken, trainerConnectionController.search_trainers);
router.post('/trainer-connections/request', verifyAccessToken, trainerConnectionController.request_connection);
router.post('/trainer-connections/respond', verifyAccessToken, trainerConnectionController.respond_to_connection);
router.get('/trainer-connections', verifyAccessToken, trainerConnectionController.get_my_connections);
router.post('/trainer-connections/remove', verifyAccessToken, trainerConnectionController.remove_connection);
router.post('/trainer-connections/permissions', verifyAccessToken, trainerConnectionController.update_permissions);

module.exports = router;
