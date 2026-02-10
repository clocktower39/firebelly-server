const mongoose = require("mongoose");

const guardianLinkSchema = new mongoose.Schema(
  {
    guardianId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    childId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    permissions: {
      viewAll: { type: Boolean, default: true },
      manageProfile: { type: Boolean, default: false },
      resetPin: { type: Boolean, default: false },
      consent: { type: Boolean, default: true },
    },
    status: { type: String, enum: ["active", "revoked"], default: "active" },
    revokedAt: { type: Date },
  },
  { timestamps: true }
);

guardianLinkSchema.index({ guardianId: 1, childId: 1 }, { unique: true });

const GuardianLink = mongoose.model("GuardianLink", guardianLinkSchema);
module.exports = GuardianLink;
