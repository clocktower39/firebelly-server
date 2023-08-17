const express = require('express');
const nutritionController = require('../controllers/nutritionController');
const { verifyAccessToken, verifyRefreshToken } = require("../middleware/auth");

const router = express.Router();

router.post('/nutrition', verifyAccessToken, nutritionController.get_nutrition);
router.post('/createNutrition', verifyAccessToken, nutritionController.create_nutrition);
router.post('/updateNutrition', verifyAccessToken, nutritionController.update_nutrition);
router.post('/nutritionWeek', verifyAccessToken, nutritionController.get_weekly_nutrition);

module.exports = router;