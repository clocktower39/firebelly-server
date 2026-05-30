const Training = require("../../models/training");
const ScheduleEvent = require("../../models/scheduleEvent");
const { createEventDebitEntry, reverseEventDebitEntry } = require("../../services/billingLedgerService");
const Relationship = require("../../models/relationship");
const mongoose = require("mongoose");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const Exercise = require("../../models/exercise");
const User = require("../../models/user");
const { canWriteUserResource } = require("../../services/accessControl");
const { pick } = require("../../utils/object");

dayjs.extend(utc);

const TRAINING_UPDATE_FIELDS = [
  "title",
  "date",
  "workoutType",
  "cardio",
  "category",
  "training",
  "workoutFeedback",
  "queuePosition",
  "isTemplate",
  "complete",
];

const checkClientRelationship = (trainerId, clientId) => {
  return Relationship.findOne({ trainer: trainerId, client: clientId })
    .then((relationship) => {
      if (!relationship) {
        return { error: "Relationship does not exist." };
      } else if (relationship.accepted) {
        return { accepted: true, relationship };
      } else {
        return { error: "Relationship pending." };
      }
    })
    .catch((err) => {
      throw err;
    });
};

module.exports = {
  Exercise,
  Relationship,
  ScheduleEvent,
  TRAINING_UPDATE_FIELDS,
  Training,
  User,
  canWriteUserResource,
  checkClientRelationship,
  createEventDebitEntry,
  dayjs,
  mongoose,
  pick,
  reverseEventDebitEntry,
};
