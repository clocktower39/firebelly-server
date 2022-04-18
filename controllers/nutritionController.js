const Nutrition = require('../models/nutrition');

const create_nutrition = (req, res, next) => {
    let nutrition = new Nutrition({
        ...req.body,
        accountId: res.locals.user._id,
    });
    let saveNutrition = () => {
        nutrition.save((err) => {
            if (err) return next(err);
            res.send({
                status: 'success',
                nutrition
            })
        });
    }
    saveNutrition();
}

const update_nutrition = (req, res, next) => {
    Nutrition.findByIdAndUpdate(req.body._id, { stats: { ...req.body.nutrition.stats } }, { new: true }, (err, nutrition) => {
        if (err) return next(err);
        else {
            res.send({ nutrition });
        }
    })
}

const get_nutrition = (req, res, next) => {
    Nutrition.find({ accountId: res.locals.user._id, date: new Date(req.body.date) }, function (err, data) {
        if (err) return next(err);
        res.send(data);
    });
}

const get_weekly_nutrition = (req, res, next) => {

    let loopDate = new Date(req.body.startDate);
    let endDate = new Date(req.body.endDate);
    let week = [];

    while (loopDate <= endDate) {
        week.push(loopDate)
        loopDate = new Date(new Date(loopDate).getTime() + 1 * (24 * 60 * 60 * 1000));
    }

    Nutrition.find({
        $or: week.map(day => {
            return { date: day };
        })
    }, function (err, data) {
        if (err) return next(err);
        res.send(data);
    });

}

module.exports = {
    create_nutrition,
    get_nutrition,
    update_nutrition,
    get_weekly_nutrition,
}