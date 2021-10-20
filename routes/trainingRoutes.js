const express = require('express');
const trainingController = require('../controllers/trainingController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/training', auth, trainingController.get_training);
router.post('/updateTraining', auth, trainingController.update_training);
router.post('/createTraining', auth, trainingController.create_training);

module.exports = router;