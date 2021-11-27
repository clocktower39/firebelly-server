const express = require('express');
const nutritionController = require('../controllers/nutritionController');
const auth = require("../middleware/auth");

const router = express.Router();

router.post('/nutrition', auth, nutritionController.get_nutrition);
router.post('/createNutrition', auth, nutritionController.create_nutrition);
router.post('/updateNutrition', auth, nutritionController.update_nutrition);
router.post('/nutritionWeek', auth, nutritionController.get_weekly_nutrition);

module.exports = router;