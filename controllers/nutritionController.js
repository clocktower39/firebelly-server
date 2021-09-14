const Nutrition = require('../models/nutrition');

const create_nutrition = (req, res) => {
    let nutrition = new Nutrition(req.body);
    let saveNutrition = () => {
        nutrition.save((err) => {
            if (err) {
                console.log(err);
                res.send({ error: { err } });
            }
            else {
                res.send({
                    status: 'success',
                    nutrition
                })
            }
        });
    }
    saveNutrition();
}


module.exports = {
    create_nutrition,
}