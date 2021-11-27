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
    Training.findByIdAndUpdate(req.body._id, { ...req.body.training }, { new: true }, (err, training) => {
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

const get_weekly_training = (req, res) => {

    let loopDate =  new Date(req.body.startDate);
    let endDate = new Date(req.body.endDate);
    let week = [];
    
    while(loopDate <= endDate){
        week.push(loopDate)
        loopDate = new Date(new Date(loopDate).getTime() + 1 * (24 * 60 * 60 * 1000));
    }

    Training.find({
        $or: week.map(day=> {
            return {'date': day};
        })
      }, function(err, data) {
        if(err) throw err;
        res.send(data);
    });    

}

module.exports = {
    create_training,
    get_training,
    update_training,
    get_weekly_training,
}