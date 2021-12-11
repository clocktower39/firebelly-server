const Task = require('../models/task');

const create_task = (req, res) => {
    let task = new Task({
        ...req.body,
        accountId: res.locals.user._id,
    });
    let saveTask = () => {
        task.save((err) => {
            if (err) {
                console.log(err);
                res.send({ error: { err } });
            }
            else {
                res.send({
                    status: 'success',
                    task
                })
            }
        });
    }
    saveTask();
}

const update_task = (req, res) => {
    Task.findOneAndReplace({ _id: req.body._id}, { ...req.body.newDailyTask }, { new: true}, (err, task) => {
        if (err) throw err;
        else {
            res.send({ task });
        }
      })
}

const get_tasks = (req, res) => {
    Task.find({ accountId: res.locals.user._id, date: req.body.date }, function(err, data) {
        if(err) throw err;
        res.send(data);
    });
}

module.exports = {
    create_task,
    get_tasks,
    update_task,
}