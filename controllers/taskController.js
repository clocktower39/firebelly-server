const Task = require('../models/task');

const create_task = (req, res) => {
    let task = new Task(req.body);
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

const get_tasks = (req, res) => {
    Task.find({ accountId: req.body.accountId, date: req.body.date }, function(err, data) {
        if(err) throw err;
        res.send(data);
    });
}

module.exports = {
    create_task,
    get_tasks,
}