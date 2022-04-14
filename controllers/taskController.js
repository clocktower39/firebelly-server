const Task = require("../models/task");

const get_tasks = (req, res) => {
  Task.find({ accountId: res.locals.user._id }, function (err, data) {
    if (err) throw err;
    res.send(data);
  });
};

const update_task_history = (req, res) => {
  const query = { accountId: res.locals.user._id };

  // Find the document
  Task.findOne(query, function (error, result) {
    if (error) return;

    result.history = req.body.history;
    result.save();
    res.send(result)
  });
};

const update_default_tasks = (req, res) => {
  Task.findOne({ accountId: res.locals.user._id }, function (err, data) {
    if (err) throw err;

    data.defaultTasks = req.body.defaultTasks;
    data.save((err) => {
      if (err) throw err;
      res.send({ status: "Successful" });
    });
  });
};

module.exports = {
  get_tasks,
  update_task_history,
  update_default_tasks,
};
