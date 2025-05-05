const Task = require("../models/task");

const get_tasks = (req, res, next) => {
  Task.find({ user: res.locals.user._id })
    .then((data) => {
      res.send(data);
    })
    .catch((err) => next(err));
};

const update_task_history = (req, res, next) => {
  const query = { user: res.locals.user._id };

  Task.findOne(query)
    .then((result) => {
      result.history = req.body.history;

      result
        .save()
        .then((result) => {
          res.send(result);
        })
        .catch((err) => next(err));
    })
    .catch((err) => next(err));
};

const update_default_tasks = (req, res, next) => {
  Task.findOne({ user: res.locals.user._id })
    .then((data) => {
      data.defaultTasks = req.body.defaultTasks;

      data
        .save()
        .then((data) => {
          res.send({ status: "Successful" });
        })
        .catch((err) => next(err));
    })
    .catch((err) => next(err));
};

module.exports = {
  get_tasks,
  update_task_history,
  update_default_tasks,
};
