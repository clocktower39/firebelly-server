const crypto = require("crypto");
const RefreshToken = require("../models/refreshToken");
const User = require("../models/user");
const { createAccessToken } = require("./tokenService");

const REFRESH_COOKIE_NAME = "fb_refresh";
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;

const getRequestIp = (req) =>
  req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || req.socket?.remoteAddress || "";

const getCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_MS,
  };
};

const parseCookies = (cookieHeader = "") =>
  cookieHeader.split(";").reduce((cookies, cookie) => {
    const [rawName, ...rawValueParts] = cookie.trim().split("=");
    if (!rawName) return cookies;
    cookies[rawName] = decodeURIComponent(rawValueParts.join("=") || "");
    return cookies;
  }, {});

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const createOpaqueToken = () => crypto.randomBytes(64).toString("base64url");

const getRefreshTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies[REFRESH_COOKIE_NAME] || req.body?.refreshToken || null;
};

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE_NAME, token, getCookieOptions());
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...getCookieOptions(),
    maxAge: undefined,
  });
};

const persistRefreshToken = async ({ userId, req, familyId }) => {
  const token = createOpaqueToken();
  const tokenHash = hashToken(token);
  const refreshToken = new RefreshToken({
    userId,
    tokenHash,
    familyId: familyId || crypto.randomUUID(),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    createdByIp: getRequestIp(req),
    userAgent: req.headers["user-agent"] || "",
  });
  await refreshToken.save();
  return { token, refreshToken };
};

const issueRefreshToken = async ({ user, req, res }) => {
  const { token } = await persistRefreshToken({ userId: user._id, req });
  setRefreshCookie(res, token);
};

const revokeRefreshToken = async ({ token, req, replacedByTokenHash = null }) => {
  if (!token) return null;
  const tokenHash = hashToken(token);
  return RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    {
      revokedAt: new Date(),
      revokedByIp: getRequestIp(req),
      replacedByTokenHash,
    },
    { new: true }
  );
};

const revokeRefreshTokenFamily = async (familyId, req) => {
  if (!familyId) return;
  await RefreshToken.updateMany(
    { familyId, revokedAt: null },
    {
      revokedAt: new Date(),
      revokedByIp: getRequestIp(req),
    }
  );
};

const rotateRefreshToken = async ({ req, res }) => {
  const token = getRefreshTokenFromRequest(req);
  if (!token) {
    const error = new Error("Refresh token is required.");
    error.statusCode = 401;
    throw error;
  }

  const tokenHash = hashToken(token);
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing) {
    const error = new Error("Invalid refresh token.");
    error.statusCode = 403;
    throw error;
  }

  if (existing.revokedAt) {
    await revokeRefreshTokenFamily(existing.familyId, req);
    const error = new Error("Refresh token was already used.");
    error.statusCode = 403;
    throw error;
  }

  if (existing.expiresAt <= new Date()) {
    await revokeRefreshToken({ token, req });
    clearRefreshCookie(res);
    const error = new Error("Refresh token expired.");
    error.statusCode = 403;
    throw error;
  }

  const user = await User.findById(existing.userId);
  if (!user) {
    await revokeRefreshToken({ token, req });
    clearRefreshCookie(res);
    const error = new Error("User not found.");
    error.statusCode = 404;
    throw error;
  }

  const next = await persistRefreshToken({
    userId: user._id,
    req,
    familyId: existing.familyId,
  });
  await revokeRefreshToken({
    token,
    req,
    replacedByTokenHash: next.refreshToken.tokenHash,
  });
  setRefreshCookie(res, next.token);

  return {
    accessToken: createAccessToken(user),
    user,
  };
};

const revokeRefreshTokenFromRequest = async ({ req, res }) => {
  const token = getRefreshTokenFromRequest(req);
  await revokeRefreshToken({ token, req });
  clearRefreshCookie(res);
};

module.exports = {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  getRefreshTokenFromRequest,
  issueRefreshToken,
  revokeRefreshTokenFromRequest,
  rotateRefreshToken,
};
