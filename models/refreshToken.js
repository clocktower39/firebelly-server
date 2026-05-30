const mongoose = require("mongoose");

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    createdByIp: { type: String, default: "" },
    revokedByIp: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true }
);

refreshTokenSchema.index({ userId: 1, revokedAt: 1, expiresAt: 1 });

const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
module.exports = RefreshToken;
