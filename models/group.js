const mongoose = require("mongoose");

const billingSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["INACTIVE", "TRIALING", "ACTIVE", "PAST_DUE", "CANCELLED"],
      default: "INACTIVE",
    },
    planId: { type: String, default: null },
    customerId: { type: String, default: null },
    subscriptionId: { type: String, default: null },
    trialEndsAt: { type: Date, default: null },
  },
  { _id: false }
);

const groupSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    sport: { type: String, default: "" },
    season: { type: String, default: "" },
    timezone: { type: String, default: "UTC" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    archivedAt: { type: Date, default: null },
    picture: { type: mongoose.Schema.Types.ObjectId, ref: "groupPicture.files", default: null },
    billing: { type: billingSchema, default: () => ({}) },
  },
  { timestamps: true, minimize: false }
);

groupSchema.index({ name: 1 });

const Group = mongoose.model("Group", groupSchema);
module.exports = Group;
