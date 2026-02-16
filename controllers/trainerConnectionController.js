const TrainerConnection = require("../models/trainerConnection");
const User = require("../models/user");
const mongoose = require("mongoose");

const search_trainers = async (req, res, next) => {
  try {
    const { query } = req.body;
    const currentUserId = res.locals.user._id;

    if (!query || query.trim().length < 2) {
      return res.json([]);
    }

    const searchRegex = new RegExp(query.trim(), "i");

    // Find users who are trainers (have clients) excluding current user
    const trainersWithClients = await mongoose.model("Relationship").distinct("trainer");
    
    const trainers = await User.find({
      _id: { $in: trainersWithClients, $ne: currentUserId },
      $or: [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
      ],
    })
      .select("_id firstName lastName email profilePicture")
      .limit(20)
      .lean();

    // Get existing connections to show status
    const existingConnections = await TrainerConnection.find({
      $or: [
        { requester: currentUserId, recipient: { $in: trainers.map((t) => t._id) } },
        { recipient: currentUserId, requester: { $in: trainers.map((t) => t._id) } },
      ],
    }).lean();

    const trainersWithStatus = trainers.map((trainer) => {
      const connection = existingConnections.find(
        (c) =>
          c.requester.toString() === trainer._id.toString() ||
          c.recipient.toString() === trainer._id.toString()
      );
      return {
        ...trainer,
        connectionStatus: connection?.status || null,
        connectionId: connection?._id || null,
      };
    });

    res.json(trainersWithStatus);
  } catch (err) {
    next(err);
  }
};

const request_connection = async (req, res, next) => {
  try {
    const { recipientId, permissions } = req.body;
    const requesterId = res.locals.user._id;

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ error: "Invalid trainer ID" });
    }

    if (recipientId === requesterId.toString()) {
      return res.status(400).json({ error: "Cannot connect with yourself" });
    }

    // Check if connection already exists in either direction
    const existing = await TrainerConnection.findOne({
      $or: [
        { requester: requesterId, recipient: recipientId },
        { requester: recipientId, recipient: requesterId },
      ],
    });

    if (existing) {
      return res.status(400).json({ error: "Connection already exists" });
    }

    const connection = new TrainerConnection({
      requester: requesterId,
      recipient: recipientId,
      status: "pending",
      permissions: permissions || ["templates", "programs"],
    });

    await connection.save();

    const populated = await TrainerConnection.findById(connection._id)
      .populate("recipient", "firstName lastName email profilePicture")
      .lean();

    res.json({ status: "success", connection: populated });
  } catch (err) {
    next(err);
  }
};

const respond_to_connection = async (req, res, next) => {
  try {
    const { connectionId, accept } = req.body;
    const userId = res.locals.user._id;

    const connection = await TrainerConnection.findOne({
      _id: connectionId,
      recipient: userId,
      status: "pending",
    });

    if (!connection) {
      return res.status(404).json({ error: "Connection request not found" });
    }

    connection.status = accept ? "accepted" : "rejected";
    await connection.save();

    const populated = await TrainerConnection.findById(connection._id)
      .populate("requester", "firstName lastName email profilePicture")
      .populate("recipient", "firstName lastName email profilePicture")
      .lean();

    res.json({ status: "success", connection: populated });
  } catch (err) {
    next(err);
  }
};

const get_my_connections = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;

    const connections = await TrainerConnection.find({
      $or: [{ requester: userId }, { recipient: userId }],
    })
      .populate("requester", "firstName lastName email profilePicture")
      .populate("recipient", "firstName lastName email profilePicture")
      .sort({ createdAt: -1 })
      .lean();

    // Organize connections by status and role
    const organized = {
      pending: {
        incoming: connections.filter(
          (c) => c.status === "pending" && c.recipient._id.toString() === userId.toString()
        ),
        outgoing: connections.filter(
          (c) => c.status === "pending" && c.requester._id.toString() === userId.toString()
        ),
      },
      accepted: connections.filter((c) => c.status === "accepted"),
      archived: connections.filter((c) => c.status === "rejected"),
    };

    res.json(organized);
  } catch (err) {
    next(err);
  }
};

const get_connected_trainer_ids = async (userId) => {
  const connections = await TrainerConnection.find({
    $or: [{ requester: userId }, { recipient: userId }],
    status: "accepted",
  }).lean();

  return connections.map((c) =>
    c.requester.toString() === userId.toString() ? c.recipient : c.requester
  );
};

const remove_connection = async (req, res, next) => {
  try {
    const { connectionId } = req.body;
    const userId = res.locals.user._id;

    const connection = await TrainerConnection.findOne({
      _id: connectionId,
      $or: [{ requester: userId }, { recipient: userId }],
    });

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    await TrainerConnection.deleteOne({ _id: connectionId });

    res.json({ status: "success" });
  } catch (err) {
    next(err);
  }
};

const update_permissions = async (req, res, next) => {
  try {
    const { connectionId, permissions } = req.body;
    const userId = res.locals.user._id;

    const connection = await TrainerConnection.findOne({
      _id: connectionId,
      $or: [{ requester: userId }, { recipient: userId }],
      status: "accepted",
    });

    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }

    connection.permissions = permissions;
    await connection.save();

    res.json({ status: "success", connection });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  search_trainers,
  request_connection,
  respond_to_connection,
  get_my_connections,
  get_connected_trainer_ids,
  remove_connection,
  update_permissions,
};
