const jwt = require("jsonwebtoken");
require('dotenv').config();
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const verifyAccessToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if(token === null) return res.status(401).send("A token is required for authentication");
  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
      if(err) return res.sendStatus(403);
      res.locals.user = user;
      next();
  });
};

const verifyRefreshToken = (refreshToken) => {
  return new Promise((resolve, reject) => {
    jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, verifiedRefreshToken) => {
      if (err) return reject(err);
      resolve(verifiedRefreshToken);
    });
  });
};

module.exports = {
  verifyAccessToken,
  verifyRefreshToken
};
