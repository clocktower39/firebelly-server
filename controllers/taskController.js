const Task = require("../models/task");

const get_tasks = (req, res) => {
  Task.find({ accountId: res.locals.user._id }, function (err, data) {
    if (err) throw err;
    res.send(data);
  });
};

const update_task_history_date = (req, res) => {
  let taskHistoryDate = new Date(req.body.date);
  taskHistoryDate = new Date(
    taskHistoryDate.getTime() + Math.abs(taskHistoryDate.getTimezoneOffset() * 60000)
  ).toString();

  if (taskHistoryDate !== "Invalid Date") {
    Task.findOne({ accountId: res.locals.user._id }, function (err, data) {
      if (err) throw err;
      let newHistoryDate = 0;

      data.history.map((day) => {
        if (new Date(day.date).toString() === new Date(taskHistoryDate).toString()) {
          day.tasks = req.body.tasks;
          newHistoryDate++;
        }
        return day;
      });

      if (newHistoryDate === 0) {
        newHistoryDate = {
          ...req.body,
          date: taskHistoryDate,
        };
        data.history.push(newHistoryDate);
      }

      data.save((err) => {
        if (err) throw err;
        res.send({ status: "Successful" });
      });
    });
  } else {
    res.send({ error: "Invalid Date" });
  }
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
  update_task_history_date,
  update_default_tasks,
};
