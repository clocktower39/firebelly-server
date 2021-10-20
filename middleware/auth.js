const jwt = require("jsonwebtoken");
require('dotenv').config();
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; 

  if(token === null) return res.status(401).send("A token is required for authentication");
  jwt.verify(token, ACCESS_TOKEN_SECRET, (err, user) => {
      if(err) return res.sendStatus(403);
      req.user = user;
      next();
  });
};

module.exports = verifyToken;