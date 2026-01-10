const mongoose = require("mongoose");

const scheduleEventSchema = new mongoose.Schema(
  {
    trainerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    startDateTime: { type: Date, required: true, index: true },
    endDateTime: { type: Date, required: true, index: true },
    eventType: {
      type: String,
      enum: ["APPOINTMENT", "INDEPENDENT", "AVAILABILITY"],
      required: true,
    },
    status: {
      type: String,
      enum: ["OPEN", "REQUESTED", "BOOKED", "COMPLETED", "CANCELLED"],
      required: true,
    },
    workoutId: { type: mongoose.Schema.Types.ObjectId, ref: "Training", default: null },
    customClientName: { type: String, default: "" },
    customClientEmail: { type: String, default: "" },
    customClientPhone: { type: String, default: "" },
    recurrenceRule: { type: String, default: null },
    recurrenceGroupId: { type: mongoose.Schema.Types.ObjectId, default: null, index: true },
    availabilitySource: {
      type: String,
      enum: ["NORMAL", "MANUAL"],
      default: "MANUAL",
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    notes: { type: String, default: "" },
  },
  { timestamps: true }
);

scheduleEventSchema.index({ trainerId: 1, startDateTime: 1, endDateTime: 1 });
scheduleEventSchema.index({ clientId: 1, startDateTime: 1 });

const ScheduleEvent = mongoose.model("ScheduleEvent", scheduleEventSchema);
module.exports = ScheduleEvent;
