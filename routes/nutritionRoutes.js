const express = require('express');
const nutritionController = require('../controllers/nutritionController');

const router = express.Router();

router.post('/nutrition', nutritionController.get_nutrition);
router.post('/createNutrition', nutritionController.create_nutrition);

module.exports = router;