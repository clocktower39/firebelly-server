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


module.exports = {
    create_task,
}