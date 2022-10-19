const Goal = require('../models/goal');
const Relationship = require('../models/relationship');

const create_goal = (req, res, next) => {
    let goal = new Goal({
        ...req.body,
        createdDate: new Date(),
        user: res.locals.user._id,
    });
    let saveGoal = () => {
        goal.save((err) => {
            if (err) return next(err);
            res.send(goal)
        });
    }
    saveGoal();
}

const remove_goal = (req, res, next) => {
    Goal.findOneAndDelete({ user: res.locals.user._id, _id: req.body.goalId }, function (err, data) {
        if (err) {
            res.send({ error: err })
        }
        else {
            res.send({ status: 'Record deleted' })
        }
    })
}

const update_goal = (req, res, next) => {
    const { title, description, achievedDate, targetDate } = req.body;
    Goal.findByIdAndUpdate(req.body._id, { title, description, achievedDate, targetDate }, { new: true }, (err, goal) => {
        if (err) return next(err);
        else {
            res.send(goal);
        }
    })
}

const comment_on_goal = (req, res, next) => {
    const { comment } = req.body;
    Goal.findById(req.body._id, (err, goal) => {
        if (err) return next(err);
        else {
            const newComment = {
                createdDate: new Date(),
                comment,
            }
            goal.comments ? goal.comments.push(newComment) : goal.comments = [newComment];

            let saveGoal = () => {
                goal.save((err) => {
                    if (err) return next(err);
                    res.send(goal)
                });
            }
            saveGoal();
        }
    })
}

const get_goals = (req, res, next) => {
    Goal.find({ user: res.locals.user._id }, function (err, data) {
        if (err) return next(err);
        res.send(data || { results: "No Results" });
    });
}

const get_client_goals = (req, res, next) => {
    const { client } = req.body;
    Relationship.findOne({ trainer: res.locals.user._id, client }, (err, relationship) => {
        if (err) return next(err);
        
        if(!relationship){
            res.send({ error: 'Relationship does not exist.'});
        }
        else if(relationship.accepted){
            Goal.find({ user: client }, function (err, data) {
                if (err) return next(err);
                res.send(data);
            });
        }
        else{
            res.send({ error: 'Relationship pending.'});
        }
    })

}

module.exports = {
    create_goal,
    remove_goal,
    update_goal,
    get_goals,
    comment_on_goal,
    get_client_goals,
}