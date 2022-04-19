const Task = require("../models/task");

const get_tasks = (req, res, next) => {
  Task.find({ accountId: res.locals.user._id }, function (err, data) {
    if (err) return next(err);
    res.send(data);
  });
};

const update_task_history = (req, res, next) => {
  const query = { accountId: res.locals.user._id };

  // Find the document
  Task.findOne(query, function (err, result) {
    if (err) return next(err);

    result.history = req.body.history;
    result.save((err, result) => {
      if (err) return next(err);
      res.send(result)
    });
  });
};

const update_default_tasks = (req, res, next) => {
  Task.findOne({ accountId: res.locals.user._id }, function (err, data) {
    if (err) return next(err);

    data.defaultTasks = req.body.defaultTasks;
    data.save((err) => {
      if (err) return next(err);
      res.send({ status: "Successful" });
    });
  });
};

module.exports = {
  get_tasks,
  update_task_history,
  update_default_tasks,
};
