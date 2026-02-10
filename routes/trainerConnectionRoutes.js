const express = require('express');
const trainerConnectionController = require('../controllers/trainerConnectionController');
const { verifyAccessToken } = require("../middleware/auth");
const { ensureWriteAccess } = require("../middleware/ensureWriteAccess");

const router = express.Router();

router.post('/trainer-connections/search', verifyAccessToken, trainerConnectionController.search_trainers);
router.post('/trainer-connections/request', verifyAccessToken, ensureWriteAccess, trainerConnectionController.request_connection);
router.post('/trainer-connections/respond', verifyAccessToken, ensureWriteAccess, trainerConnectionController.respond_to_connection);
router.get('/trainer-connections', verifyAccessToken, trainerConnectionController.get_my_connections);
router.post('/trainer-connections/remove', verifyAccessToken, ensureWriteAccess, trainerConnectionController.remove_connection);
router.post('/trainer-connections/permissions', verifyAccessToken, ensureWriteAccess, trainerConnectionController.update_permissions);

module.exports = router;
