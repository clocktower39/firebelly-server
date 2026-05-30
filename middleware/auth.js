const jwt = require("jsonwebtoken");
require("dotenv").config();
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const [scheme, token] = authHeader ? authHeader.split(" ") : [];

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "A token is required for authentication." });
  }
  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: "Invalid or expired token." });
    res.locals.user = user;
    next();
  });
};

module.exports = {
  verifyAccessToken,
};
