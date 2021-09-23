const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    unit: { type: String, required: true },
    goal: { type: Number, required: true },
    achieved: { type: Number, required: true },
    accountId: { type: String, required: true },
    date: { type: Date, required: true },
})

const Nutrition = mongoose.model('Nutrition', nutritionSchema);
module.exports = Nutrition;