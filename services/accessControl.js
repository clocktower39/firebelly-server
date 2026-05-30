const Relationship = require("../models/relationship");

const sameId = (left, right) => String(left || "") === String(right || "");

const isTrainerForClient = async (trainerId, clientId) => {
  if (!trainerId || !clientId) return null;
  return Relationship.findOne({ trainer: trainerId, client: clientId, accepted: true });
};

const canWriteUserResource = async (user, ownerId) => {
  if (!user || !ownerId) return false;
  if (sameId(user._id, ownerId)) return true;
  if (user.delegationMode && sameId(user.viewedUserId, ownerId)) {
    return Boolean(user.canModifyViewedAccount);
  }
  if (!user.isTrainer) return false;
  return Boolean(await isTrainerForClient(user._id, ownerId));
};

module.exports = {
  canWriteUserResource,
  isTrainerForClient,
  sameId,
};
