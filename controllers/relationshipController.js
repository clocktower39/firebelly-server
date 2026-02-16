const Relationship = require("../models/relationship");
const User = require("../models/user");
const userController = require("./userController");
const mongoose = require("mongoose");
const { createAccessToken } = require("../services/tokenService");

const manage_relationship = (req, res, next) => {
  req.body.client = res.locals.user._id;
  req.body.accepted = false;
  req.body.requestedBy = "client";

  if (!mongoose.Types.ObjectId.isValid(req.body.trainer)) {
    return res.send("Invalid ID entered");
  }

  User.findById(req.body.trainer)
    .then((trainerData) => {
      if (!trainerData || trainerData.isTrainer === false) {
        return res.send({ status: "error", error: "Trainer does not exist" });
      }

      return User.findById(req.body.client).then((clientData) => {
        if (!clientData) {
          return res.send({ status: "error", error: "Client does not exist" });
        }

        let relationship = new Relationship(req.body);
        return relationship
          .save()
          .then((savedRelationship) => {
            res.send({
              status: "success",
              relationship: savedRelationship,
            });
          })
          .catch((err) => next(err));
      });
    })
    .catch((err) => next(err));
};

const change_relationship_status = (req, res, next) => {
  const { client, accepted } = req.body;

  Relationship.findOneAndUpdate({ client, trainer: res.locals.user._id }, { accepted })
    .then((data) => {
      if (!data) return res.status(404).send({ message: "Relationship not found." });
      res.sendStatus(204);
    })
    .catch((err) => next(err));
};

const get_relationships = (req, res, next) => {
  if (req.params.type === "trainer") {
    Relationship.find({ trainer: req.params._id, client: res.locals.user._id })
      .then((data) => {
        if (!data) return res.status(404).send({ message: "Relationship not found." });
        res.send(data);
      })
      .catch((err) => next(err));
  } else if (req.params.type === "client") {
    Relationship.find({ client: req.params._id, trainer: res.locals.user._id })
      .then((data) => {
        res.send(data);
      })
      .catch((err) => next(err));
  } else {
    res.send("Invalid request");
  }
};

const get_my_relationships = async (req, res, next) => {
  const relationships = await Relationship.find({ client: res.locals.user._id }).lean().exec();

  const promises = relationships.map((r) => User.findById({ _id: r.trainer }).lean().exec());
  const trainers = await Promise.all(promises);

  const trainerInfo = trainers.map((t) => {
    const relationship = relationships.find(
      (r) => r.trainer.toString() === t._id.toString()
    );
    const lastActivityAt = relationship?.updatedAt || relationship?.createdAt || null;

    return {
      firstName: t.firstName,
      lastName: t.lastName,
      trainer: t._id,
      profilePicture: t.profilePicture,
      accepted: relationship?.accepted ?? false,
      metricsApprovalRequired: relationship?.metricsApprovalRequired ?? true,
      lastActivityAt,
    };
  });
  res.send(trainerInfo);
};

const get_my_clients = async (req, res, next) => {
  const clients = await Relationship.find({ trainer: res.locals.user._id })
    .populate("client", "firstName lastName profilePicture")
    .exec();
  res.send(clients);
};

const remove_relationship = (req, res, next) => {
  const { trainer, client } = req.body;
  const userId = res.locals.user._id;

  // Ensure that the request is made by either the trainer or the client
  if (trainer === userId || client === userId) {
    Relationship.findOneAndDelete({ client, trainer })
      .then((data) => {
        if (!data) {
          return res.status(404).send({ message: "Relationship not found." });
        }
        res.sendStatus(200); // Successfully deleted
      })
      .catch((err) => next(err));
  } else {
    res.status(403).send({ error: "This request must include your own ID." });
  }
};

const update_metrics_approval = (req, res, next) => {
  const { trainer, metricsApprovalRequired } = req.body;

  Relationship.findOneAndUpdate(
    { trainer, client: res.locals.user._id },
    { metricsApprovalRequired },
    { new: true }
  )
    .then((data) => {
      if (!data) return res.status(404).send({ message: "Relationship not found." });
      res.send({ status: "success", relationship: data });
    })
    .catch((err) => next(err));
};

const issue_client_view_token = async (req, res, next) => {
  try {
    const trainerId = res.locals.user._id;
    const { clientId } = req.body;

    if (!clientId) {
      return res.status(400).json({ error: "clientId is required." });
    }

    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ error: "Invalid client ID." });
    }

    const relationship = await Relationship.findOne({
      trainer: trainerId,
      client: clientId,
      accepted: true,
    }).lean();

    if (!relationship) {
      return res.status(403).json({ error: "Not authorized for this client." });
    }

    const client = await User.findById(clientId).lean();
    if (!client) {
      return res.status(404).json({ error: "Client not found." });
    }

    const accessToken = createAccessToken(
      client,
      { viewOnly: true, trainerId },
      { expiresIn: "60m" }
    );

    res.send({ accessToken, expiresIn: 3600 });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  manage_relationship,
  change_relationship_status,
  get_relationships,
  get_my_relationships,
  get_my_clients,
  remove_relationship,
  update_metrics_approval,
  issue_client_view_token,
};
