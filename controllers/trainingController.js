const Training = require('../models/training');

const create_training = (req, res) => {
    let training = new Training(req.body);
    let saveTraining = () => {
        training.save((err) => {
            if (err) {
                console.log(err);
                res.send({ error: { err } });
            }
            else {
                res.send({
                    status: 'success',
                    training
                })
            }
        });
    }
    saveTraining();
}

const update_training = (req, res) => {
    Training.findByIdAndUpdate(req.body._id, { training: req.body.training }, { new: true }, (err, training) => {
        if (err) throw err;
        else {
            res.send({ training });
        }
    })
}

const get_training = (req, res) => {
    Training.find({ accountId: req.body.accountId, date: req.body.date }, function(err, data) {
        if(err) throw err;
        res.send(data);
    });
}

module.exports = {
    create_training,
    get_training,
    update_training,
}