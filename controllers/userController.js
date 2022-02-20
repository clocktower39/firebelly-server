const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const signup_user = (req, res) => {
  let user = new User(req.body);
  let saveUser = () => {
    user.save((err) => {
      if (err) {
        console.log(err);
        res.send({ error: { err } });
      } else {
        res.send({
          status: "success",
          user,
        });
      }
    });
  };
  saveUser();
};

const login_user = (req, res) => {
  User.findOne({ email: req.body.email }, function (err, user) {
    if (err) throw err;
    if (!user) {
      res.send({
        authenticated: false,
        error: { email: "Username not found" },
      });
    } else {
      user.comparePassword(req.body.password, function (err, isMatch) {
        if (err) {
          res.send({
            authenticated: false,
          });
        }
        //if the password does not match and previous session was not authenticated, do not authenticate
        if (isMatch) {
          const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
            expiresIn: "30d", // expires in 30 days
          });
          res.send({
            accessToken: accessToken,
          });
        } else {
          res.send({
            error: { password: "Incorrect Password" },
          });
        }
      });
    }
  });
};

const checkAuthLoginToken = (req, res) => {
  res.send("Authorized");
};


const get_userInfo = (req, res) => {
  if (req.body._id.length === 24) {
    User.findById({ _id: req.body._id }, function (err, user) {
      if (err) throw err;
      if (!user) {
        res.send({
          error: "User not found",
        });
      } else {
        console.log(user.firstName)
        res.send({
          firstName: user.firstName,
          lastName: user.lastName,
        });
      }
    });
  } else {
    res.send({ error: "ID not valid"});
  }
};

module.exports = {
  signup_user,
  login_user,
  checkAuthLoginToken,
  get_userInfo,
};
