const Task = require('../models/task');

const get_tasks = (req, res) => {
    Task.find({ accountId: res.locals.user._id }, function(err, data) {
        if(err) throw err;
        res.send(data);
    });
}

module.exports = {
    get_tasks,
}