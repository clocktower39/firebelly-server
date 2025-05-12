const Goal = require("../models/goal");
const Relationship = require("../models/relationship");

const create_goal = (req, res, next) => {
  let goal = new Goal({
    ...req.body,
    createdDate: new Date(),
    user: res.locals.user._id,
  });

  goal
    .save()
    .then((savedGoal) => {
      res.send(savedGoal);
    })
    .catch((err) => next(err));
};

const remove_goal = (req, res, next) => {
  Goal.findOneAndDelete({ user: res.locals.user._id, _id: req.body.goalId })
    .then((data) => {
      if (!data) {
        return res.status(404).send({ error: "Goal not found" });
      }
      res.send({ status: "Record deleted" });
    })
    .catch((err) => next(err));
};

const update_goal = (req, res, next) => {
  const { title, description, achievedDate, targetDate } = req.body;

  Goal.findByIdAndUpdate(
    req.body._id,
    { title, description, achievedDate, targetDate },
    { new: true }
  )
    .then((goal) => {
      if (!goal) {
        return res.status(404).send({ error: "Goal not found" });
      }
      res.send(goal);
    })
    .catch((err) => next(err));
};

const comment_on_goal = (req, res, next) => {
  const { comment } = req.body;
  Goal.findById(req.body._id)
    .then((goal) => {
      if (!goal) {
        return res.status(404).send({ error: "Goal not found" });
      }
      const newComment = {
        createdDate: new Date(),
        comment,
        user: res.locals.user._id,
      };
      goal.comments ? goal.comments.push(newComment) : (goal.comments = [newComment]);

      return goal.save();
    })
    .then((savedGoal) => {
      res.send(savedGoal);
    })
    .catch((err) => next(err));
};

const get_goals = (req, res, next) => {
  Goal.find({ user: res.locals.user._id })
    .populate("comments.user", "firstName lastName profilePicture")
    .then((data) => {
      res.send(data || { results: "No Results" });
    })
    .catch((err) => next(err));
};

const get_client_goals = (req, res, next) => {
  const { client } = req.body;
  Relationship.findOne({ trainer: res.locals.user._id, client })
    .then((relationship) => {
      if (!relationship) {
        res.send({ error: "Relationship does not exist." });
      } else if (relationship.accepted) {
        Goal.find({ user: client })
          .populate("comments.user", "firstName lastName profilePicture")
          .then((data) => {
            res.send(data);
          })
          .catch((err) => next(err));
      } else {
        res.send({ error: "Relationship pending." });
      }
    })
    .catch((err) => next(err));
};

module.exports = {
  create_goal,
  remove_goal,
  update_goal,
  get_goals,
  comment_on_goal,
  get_client_goals,
};
