const Relationship = require('../models/relationship');
const User = require('../models/user');
const userController = require('./userController');
const mongoose = require('mongoose');

const manage_relationship = (req, res, next) => {
    req.body.client = res.locals.user._id;
    req.body.accepted = false;
    req.body.requestedBy = 'client';
    if (!mongoose.Types.ObjectId.isValid(req.body.trainer)) {
        res.send('Invalid ID entered');
    }
    else {
        User.findById(req.body.trainer, function (err, data) {
            if (err) return next(err);
            if (data === null || data.isTrainer === false) {
                res.send({ status: 'error', error: 'Trainer does not exist', });
            }
            else {
                User.findById(req.body.client, function (err, data) {
                    if (err) throw err;
                    if (data === null) {
                        res.send({ status: 'error', error: 'Client does not exist' });
                    }
                    else {
                        let relationship = new Relationship(req.body);
                        relationship.save((err) => {
                            if (err) {
                                res.send({ error: { err }, status: 'error', });
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

const change_relationship_status = (req, res, next) => {
    const { client, accepted } = req.body;

    Relationship.findOneAndUpdate({ client, trainer: res.locals.user._id }, { accepted }, function (err, data) {
        if (err) return next(err);
        res.sendStatus(204)
    });
}

const get_relationships = (req, res, next) => {
    if (req.params.type === 'trainer') {
        Relationship.find({ trainer: req.params._id, client: res.locals.user._id }, function (err, data) {
            if (err) return next(err);
            res.send(data)
        });
    }
    else if (req.params.type === 'client') {
        Relationship.find({ client: req.params._id, trainer: res.locals.user._id }, function (err, data) {
            if (err) return next(err);
            res.send(data)
        });
    }
    else {
        res.send('Invalid request')
    }
}

const get_my_relationships = async (req, res, next) => {
    const relationships = await Relationship.find({ client: res.locals.user._id }).lean().exec();

    const promises = relationships.map(r => User.findById({ _id: r.trainer }).lean().exec());
    const trainers = await Promise.all(promises);

    const trainerInfo = trainers.map(t => {
        const accepted = relationships.filter(r => r.trainer.toString() === t._id.toString())[0].accepted;

        return {
            firstName: t.firstName,
            lastName: t.lastName,
            trainer: t._id,
            accepted,
        }
    })
    res.send(trainerInfo)
}

const get_my_clients = async (req, res, next) => {
    const clients = await Relationship.find({ trainer: res.locals.user._id })
    .populate("client","firstName lastName")
    .exec();

    // const promises = relationships.map(r => User.findById({ _id: r.client }).lean().exec());
    // const clients = await Promise.all(promises);

    // const clientInfo = clients.map(c => {
    //     const accepted = relationships.filter(r => r.client.toString() === c._id.toString())[0].accepted;
    //     return {
    //         firstName: c.firstName,
    //         lastName: c.lastName,
    //         client: c._id,
    //         accepted,
    //     }
    // })
    res.send(clients)
}

const remove_relationship = (req, res, next) => {
    const { trainer } = req.body;
    Relationship.findOneAndDelete({ client: res.locals.user._id, trainer, }, function (err, data) {
        if (err) {
            res.send({ error: err })
        }
        else {
            res.sendStatus(200);
        }
    })
}

module.exports = {
    manage_relationship,
    change_relationship_status,
    get_relationships,
    get_my_relationships,
    get_my_clients,
    remove_relationship,
}