const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    accountId: { type: String, required: true },
    stats: {
        caloriesIn: {
            type: {
                title: { type: String, required: true },
                unit: { type: String, required: true },
                goal: { type: Number, required: true },
                achieved: { type: Number, required: true },
            },
            default: {
                title: "Calories In",
                unit: "calories",
                goal: 2000,
                achieved: 0,
            }
        },
        caloriesOut: {
            type: {
                title: { type: String, required: true },
                unit: { type: String, required: true },
                goal: { type: Number, required: true },
                achieved: { type: Number, required: true },
            },
            default: {
                title: "Calories Out",
                unit: "calories",
                goal: 1000,
                achieved: 0,
            }
        },
        carbs: {
            type: {
                title: { type: String, required: true },
                unit: { type: String, required: true },
                goal: { type: Number, required: true },
                achieved: { type: Number, required: true },
            },
            default: {
                title: "Carbs",
                unit: "grams",
                goal: 250,
                achieved: 0,
            }
        },
        fats: {
            type: {
                title: { type: String, required: true },
                unit: { type: String, required: true },
                goal: { type: Number, required: true },
                achieved: { type: Number, required: true },
            },
            default: {
                title: "Fats",
                unit: "grams",
                goal: 50,
                achieved: 0,
            }
        },
        protein: {
            type: {
                title: { type: String, required: true },
                unit: { type: String, required: true },
                goal: { type: Number, required: true },
                achieved: { type: Number, required: true },
            },
            default: {
                title: "Protein",
                unit: "grams",
                goal: 150,
                achieved: 0,
            }
        },
    }
})

const Nutrition = mongoose.model('Nutrition', nutritionSchema);
module.exports = Nutrition;