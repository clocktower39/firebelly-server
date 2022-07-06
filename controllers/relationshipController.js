const Relationship = require('../models/relationship');
const User = require('../models/user');
const userController = require('./userController');
const mongoose = require('mongoose');

const manage_relationship = (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.body.trainerId) || !mongoose.Types.ObjectId.isValid(req.body.clientId)) {
        res.send('Invalid ID entered');
    }
    else {
        User.findById(req.body.trainerId, function (err, data) {
            if (err) return next(err);
            if (data === null || data.isTrainer === false) {
                res.send('Trainer does not exist');
            }
            else {
                User.findById(req.body.clientId, function (err, data) {
                    if (err) throw err;
                    if (data === null) {
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
    if (req.params.type === 'trainer') {
        Relationship.find({ trainerId: req.params._id, clientId: res.locals.user._id }, function (err, data) {
            if (err) return next(err);
            res.send(data)
        });
    }
    else if (req.params.type === 'client') {
        Relationship.find({ clientId: req.params._id, trainerId: res.locals.user._id }, function (err, data) {
            if (err) return next(err);
            res.send(data)
        });
    }
    else {
        res.send('Invalid request')
    }
}

const get_my_relationships = async (req, res, next) => {
    const relationships = await Relationship.find({ clientId: res.locals.user._id }).lean().exec();

    const promises = relationships.map(r => User.findById({ _id: r.trainerId }).lean().exec());
    const trainers = await Promise.all(promises);

    const trainerInfo = trainers.map(t => {
        const accepted = relationships.filter(r => r.trainerId.toString() === t._id.toString())[0].accepted;

        return {
            firstName: t.firstName,
            lastName: t.lastName,
            trainerId: t._id,
            accepted,
        }
    })
    res.send(trainerInfo)
}

const get_my_clients = async (req, res, next) => {
    const relationships = await Relationship.find({ trainerId: res.locals.user._id }).lean().exec();

    const promises = relationships.map(r => User.findById({ _id: r.clientId }).lean().exec());
    const clients = await Promise.all(promises);

    const clientInfo = clients.map(c => {
        const accepted = relationships.filter(r => r.clientId.toString() === c._id.toString())[0].accepted;
        return {
            firstName: c.firstName,
            lastName: c.lastName,
            clientId: c._id,
            accepted,
        }
    })
    res.send(clientInfo)
}

module.exports = {
    manage_relationship,
    get_relationships,
    get_my_relationships,
    get_my_clients,
}