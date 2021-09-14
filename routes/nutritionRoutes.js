const express = require('express');
const nutritionController = require('../controllers/nutritionController');

const router = express.Router();

router.post('/createNutrition', nutritionController.create_nutrition);

module.exports = router;