const mongoose = require("mongoose");

const groupMembershipSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: {
      type: String,
      enum: ["TRAINER", "COACH", "ATHLETE", "ADMIN"],
      required: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INVITED", "REMOVED"],
      default: "ACTIVE",
    },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

groupMembershipSchema.index({ groupId: 1, userId: 1 }, { unique: true });

const GroupMembership = mongoose.model("GroupMembership", groupMembershipSchema);
module.exports = GroupMembership;
