const jwt = require("jsonwebtoken");

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const buildTokenPayload = (user, overrides = {}) => ({
  _id: user._id,
  email: user.email || null,
  username: user.username || null,
  firstName: user.firstName || "",
  lastName: user.lastName || "",
  phoneNumber: user.phoneNumber || null,
  dateOfBirth: user.dateOfBirth || null,
  height: user.height || null,
  sex: user.sex || null,
  gymBarcode: user.gymBarcode || null,
  profilePicture: user.profilePicture || null,
  themeMode: user.themeMode || "light",
  customThemes: user.customThemes || [],
  weeklyFrequency: user.weeklyFrequency || null,
  preferredWorkoutDays: user.preferredWorkoutDays || [],
  isTrainer: Boolean(user.isTrainer),
  accountType: user.accountType || "adult",
  ageBand: user.ageBand || null,
  coppaStatus: user.coppaStatus || null,
  consentScope: user.consentScope || null,
  saleShareOptIn: Boolean(user.saleShareOptIn),
  adPersonalizationAllowed: Boolean(user.adPersonalizationAllowed),
  viewOnly: Boolean(overrides.viewOnly),
  guardianId: overrides.guardianId || null,
});

const createTokens = (user, overrides = {}) => {
  const payload = buildTokenPayload(user, overrides);

  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: "180m",
  });

  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, {
    expiresIn: "90d",
  });

  return { accessToken, refreshToken };
};

const createAccessToken = (user, overrides = {}, options = {}) => {
  const payload = buildTokenPayload(user, overrides);
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, {
    expiresIn: options.expiresIn || "60m",
  });
};

module.exports = {
  buildTokenPayload,
  createTokens,
  createAccessToken,
};
