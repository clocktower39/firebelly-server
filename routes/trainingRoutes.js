const express = require('express');
const trainingController = require('../controllers/trainingController');

const router = express.Router();

router.post('/createTraining', trainingController.create_training);

module.exports = router;