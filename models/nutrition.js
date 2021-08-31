const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
    title: { type: String, required: true, index: { unique: true } },
    unit: { type: String, required: true },
    goal: { type: Number, required: true },
    achieved: { type: Number, required: true },
    accountId: { type: Number, required: true },
    date: { type: Date, required: true },
})

const Nutrition = mongoose.model('Nutrition', nutritionSchema);
module.exports = Nutrition;