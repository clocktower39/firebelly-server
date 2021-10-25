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

const update_nutrition = (req, res) => {
    Nutrition.findByIdAndUpdate(req.body._id, { stats: { ...req.body.nutrition.stats } }, { new: true}, (err, nutrition) => {
        if (err) throw err;
        else {
            res.send({ nutrition });
        }
      })
}

const get_nutrition = (req, res) => {
    Nutrition.find({ accountId: req.body.accountId, date: req.body.date }, function(err, data) {
        if(err) throw err;
        res.send(data);
    });
}

module.exports = {
    create_nutrition,
    get_nutrition,
    update_nutrition,
}