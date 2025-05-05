const Nutrition = require("../models/nutrition");

const create_nutrition = (req, res, next) => {
  let nutrition = new Nutrition({
    ...req.body,
    user: res.locals.user._id,
  });

  let saveNutrition = () => {
    nutrition
      .save()
      .then((data) =>
        res.send({
          status: "success",
          nutrition: data,
        })
      )
      .catch((err) => next(err));
  };
  saveNutrition();
};

const update_nutrition = (req, res, next) => {
  Nutrition.findByIdAndUpdate(
    req.body._id,
    { stats: { ...req.body.nutrition.stats } },
    { new: true }
  )
    .then((data) => res.send({ nutrition: data }))
    .catch((err) => next(err));
};

const get_nutrition = (req, res, next) => {
  const { date } = req.body;
  if (!date) return res.send({ status: "Date required" });
  Nutrition.find({ user: res.locals.user._id, date: new Date(date) })
    .then((data) => res.send(data))
    .catch((err) => next(err));
};

const get_weekly_nutrition = (req, res, next) => {
  let loopDate = new Date(req.body.startDate);
  let endDate = new Date(req.body.endDate);
  let week = [];

  while (loopDate <= endDate) {
    week.push(loopDate);
    loopDate = new Date(new Date(loopDate).getTime() + 1 * (24 * 60 * 60 * 1000));
  }

  Nutrition.find({
    $or: week.map((day) => {
      return { date: day };
    }),
  })
    .then((data) => res.send(data))
    .catch((err) => next(err));
};

module.exports = {
  create_nutrition,
  get_nutrition,
  update_nutrition,
  get_weekly_nutrition,
};
