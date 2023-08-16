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
      trainer: trainer._id,
      firstName: trainer.firstName,
      lastName: trainer.lastName,
      sex: trainer.sex,
    }))
    res.send(publicTrainers);
  });
};
const upload_profile_picture = (req, res) => {
    let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'profilePicture'
    });

    User.findById(res.locals.user._id, (err, user) => {
        if (err) return res.send(err);
        if (user.profilePicture) {
            gridfsBucket.delete(mongoose.Types.ObjectId(user.profilePicture));
        }
        user.profilePicture = res.req.file.id;
        user.save((err, u) => {
            if (err) return res.send(err);
            return res.sendStatus(200);
        });
    })
}

const get_profile_picture = (req, res) => {
    if (req.params.id) {
        let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
            bucketName: 'profilePicture'
        });

        gridfsBucket.find({ _id: mongoose.Types.ObjectId(req.params.id) }).toArray((err, files) => {
            // Check if files
            if (!files || files.length === 0) {
                return res.status(404).json({
                    err: 'No files exist'
                });
            }

            // Check if image
            if (files[0].contentType === 'image/jpeg' || files[0].contentType === 'image/png') {
                // Read output to browser
                const readstream = gridfsBucket.openDownloadStream(files[0]._id);
                readstream.pipe(res);
            } else {
                res.status(404).json({
                    err: 'Not an image'
                });
            }
        });
    }
    else {
        res.status(404).json({
            err: 'Missing parameter',
        })
    }
}

const delete_profile_picture = (req, res) => {
    let gridfsBucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
        bucketName: 'profilePicture'
    });

    User.findById(res.locals.user._id, (err, user) => {
        if (err) return res.send(err);
        if (user.profilePicture) {
            gridfsBucket.delete(mongoose.Types.ObjectId(user.profilePicture));
            user.profilePicture = undefined;
            user.save((err, u) => {
                if (err) return res.send(err);
                return res.sendStatus(200);
            });
        }
        else {
            return res.sendStatus(204);
        }
    })


}

module.exports = {
  signup_user,
  login_user,
  update_user,
  checkAuthLoginToken,
  get_userInfo,
  change_password,
  get_trainers,
  upload_profile_picture,
  get_profile_picture,
  delete_profile_picture,
};
