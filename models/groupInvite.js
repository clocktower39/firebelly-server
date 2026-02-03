const mongoose = require("mongoose");

const groupInviteSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["ADMIN", "TRAINER", "COACH", "ATHLETE"],
      default: "ATHLETE",
    },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true, index: true },
    status: {
      type: String,
      enum: ["PENDING", "ACCEPTED", "EXPIRED", "REVOKED"],
      default: "PENDING",
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    acceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

groupInviteSchema.index({ groupId: 1, email: 1, status: 1 });

const GroupInvite = mongoose.model("GroupInvite", groupInviteSchema);
module.exports = GroupInvite;
