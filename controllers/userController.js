const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;

const signup_user = (req, res, next) => {
  let user = new User(req.body);
  let saveUser = () => {
    user.save((err) => {
      if (err) return next(err);
      res.send({
        status: "success",
        user,
      });
    });
  };
  saveUser();
};

const login_user = (req, res, next) => {
  User.findOne({ email: req.body.email }, function (err, user) {
    if (err) return next(err);
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

const change_password = (req, res, next) => {
  User.findOne({ email: res.locals.user.email }, function (err, user) {
    if (err) return next(err);
    if (!user) {
      res.send({
        error: { status: "User not found" },
      });
    } else {
      user.comparePassword(req.body.currentPassword, function (err, isMatch) {
        if (err) {
          res.send({
            error: { status: 'Incorrect Current Password' },
          });
        }
        if (isMatch) {
          user.password = req.body.newPassword;
          user.save().then(savedUser => {
            const accessToken = jwt.sign(savedUser._doc, ACCESS_TOKEN_SECRET, {
              expiresIn: "30d", // expires in 30 days
            });
            res.send({ accessToken });
          })
        } else {
          res.send({
            error: { status: "Password change failed." },
          });
        }
      });
    }
  });
};

const update_user = (req, res, next) => {
  User.findByIdAndUpdate(res.locals.user._id, { ...req.body }, { new: true }, function (err, user) {
    if (err) return next(err);
    if (!user) {
      res.send({
        status: 'error',
        err: err ? err : '',
      })
    }
    else {
      console.log({ ...req.body })
      console.log(user)
      console.log(user._doc)
      const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
        expiresIn: "30d", // expires in 30 days
      });
      res.send({ status: 'Successful', accessToken });
    }
  })
}

const checkAuthLoginToken = (req, res, next) => {
  res.send("Authorized");
};


const get_userInfo = (req, res, next) => {
  if (req.body._id.length === 24) {
    User.findById({ _id: req.body._id }, function (err, user) {
      if (err) return next(err);
      if (!user) {
        res.send({
          error: "User not found",
        });
      } else {
        res.send({
          firstName: user.firstName,
          lastName: user.lastName,
        });
      }
    });
  } else {
    res.send({ error: "ID not valid" });
  }
};

const get_trainers = (req, res, next) => {
  User.find({ isTrainer: true }, function (err, trainers) {
    if (err) return next(err);
    const publicTrainers = trainers.map(trainer => ({
      trainerId: trainer._id,
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      sex: trainer.sex,
    }))
    res.send(publicTrainers);
  });
};

module.exports = {
  signup_user,
  login_user,
  update_user,
  checkAuthLoginToken,
  get_userInfo,
  change_password,
  get_trainers,
};
