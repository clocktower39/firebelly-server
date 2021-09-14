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


module.exports = {
    create_training,
}