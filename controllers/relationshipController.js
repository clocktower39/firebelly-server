const Relationship = require('../models/relationship');
const User = require('../models/user');
const mongoose = require('mongoose');

const manage_relationship = (req, res, next) => {
    if(!mongoose.Types.ObjectId.isValid(req.body.trainerId) || !mongoose.Types.ObjectId.isValid(req.body.clientId)){
        res.send('Invalid ID entered');
    }
    else{
        User.findById(req.body.trainerId, function(err, data) {
            if (err) return next(err);
            if(data === null || data.isTrainer === false){
                res.send('Trainer does not exist');
            }
            else {
                User.findById(req.body.clientId, function(err, data) {
                    if (err) throw err;
                    if(data === null){
                        res.send('Client does not exist');
                    }
                    else {
                        let relationship = new Relationship(req.body);
                        relationship.save((err) => {
                            if (err) {
                                console.log(err);
                                res.send({ error: { err } });
                            }
                            else {
                                res.send({
                                    status: 'success',
                                    relationship
                                })
                            }
                        });
                    }
                })

            }
        })
    }
}

const get_relationships = (req, res, next) => {
    if(req.params.type === 'trainer'){
        Relationship.find({trainerId: req.params._id}, function (err, data) {
            if (err) return next(err);
            res.send(data)
        });
    }
    else if(req.params.type === 'client'){
        Relationship.find({clientId: req.params._id}, function (err, data) {
            if (err) return next(err);
            res.send(data)
        });
    }
    else {
        res.send('Invalid request')
    }
}

module.exports = {
    manage_relationship,
    get_relationships,
}