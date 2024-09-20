const User = require("../models/user");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const path = require('path');
const { verifyRefreshToken } = require("../middleware/auth");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

const createTokens = (user) => {
  const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
    expiresIn: "180m", // Set a shorter expiration for access tokens
  });

  const refreshToken = jwt.sign(user._doc, REFRESH_TOKEN_SECRET, {
    expiresIn: "90d", // Set a longer expiration for refresh tokens
  });

  return { accessToken, refreshToken };
};

const signup_user = (req, res, next) => {
  let user = new User(req.body);
  let saveUser = () => {
    user.save()
      .then(() => {
        const tokens = createTokens(user);
        res.send({
          status: "success",
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        });
      })
      .catch((err) => next(err));
  };
  saveUser();
};

const login_user = (req, res, next) => {
  User.findOne({ email: req.body.email })
    .then((user) => {
      if (!user) {
        res.send({
          authenticated: false,
          error: { email: "Username not found" },
        });
      } else {
        user.comparePassword(req.body.password)
          .then((isMatch) => {
            if (isMatch) {
              const tokens = createTokens(user);
              res.send({
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
              });
            } else {
              res.send({
                error: { password: "Incorrect Password" },
              });
            }
          })
          .catch(() => res.send({ authenticated: false }));
      }
    })
    .catch((err) => next(err));
};

const refresh_tokens = (req, res, next) => {
  const { refreshToken } = req.body;

  verifyRefreshToken(refreshToken)
    .then((verifiedRefreshToken) => {
      return User.findById(verifiedRefreshToken._id).exec();
    })
    .then((user) => {
      if (!user) {
        return res.status(404).send({ error: "User not found" });
      }

      const tokens = createTokens(user);
      res.send({
        accessToken: tokens.accessToken,
      });
    })
    .catch((err) => res.status(403).send({ error: "Invalid refresh token", err }));
};

const change_password = (req, res, next) => {
  User.findOne({ email: res.locals.user.email })
    .then((user) => {
      if (!user) {
        res.send({
          error: { status: "User not found" },
        });
      } else {
        return user.comparePassword(req.body.currentPassword).then((isMatch) => {
          if (isMatch) {
            user.password = req.body.newPassword;
            return user.save().then((savedUser) => {
              const tokens = createTokens(savedUser);
              res.send({
                status: "success",
                user: savedUser,
                accessToken: tokens.accessToken,
              });
            });
          } else {
            res.send({
              name: "Validation Failed",
              message: "Validation Failed",
              statusCode: 400,
              error: "Bad Request",
              details: {
                body: [
                  {
                    message: "Incorrect Current Password.",
                    path: ["currentPassword"],
                    context: {
                      label: "currentPassword",
                      value: "",
                      key: "currentPassword",
                    },
                  },
                ],
                status: "Incorrect Current Password.",
              },
            });
          }
        });
      }
    })
    .catch((err) => next(err));
};

const update_user = (req, res, next) => {
  User.findByIdAndUpdate(res.locals.user._id, { ...req.body }, { new: true })
    .then((user) => {
      if (!user) {
        res.send({
          status: "error",
          err: "",
        });
      } else {
        const tokens = createTokens(user);
        res.send({
          status: "success",
          user,
          accessToken: tokens.accessToken,
        });
      }
    })
    .catch((err) => next(err));
};

const checkAuthLoginToken = (req, res, next) => {
  res.send("Authorized");
};

const get_userInfo = (req, res, next) => {
  if (req.body._id.length === 24) {
    User.findById({ _id: req.body._id })
      .then((user) => {
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
      })
      .catch((err) => next(err));
  } else {
    res.send({ error: "ID not valid" });
  }
};

const get_trainers = (req, res, next) => {
  User.find({ isTrainer: true })
    .then((trainers) => {
      const publicTrainers = trainers.map((trainer) => ({
        trainer: trainer._id,
        profilePicture: trainer.profilePicture,
        firstName: trainer.firstName,
        lastName: trainer.lastName,
        sex: trainer.sex,
      }));
      res.send(publicTrainers);
    })
    .catch((err) => next(err));
};

const upload_profile_picture = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePicture"
    });

    const user = await User.findById(res.locals.user._id);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Check if the user has a profile picture before deleting
    if (user.profilePicture) {
      const existingFile = await gridfsBucket
        .find({ _id: new mongoose.Types.ObjectId(user.profilePicture) })
        .toArray();

      // Add a log to check the existing profile picture details
      console.log("Checking if profile picture exists:", existingFile);

      if (existingFile.length > 0) {
        await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
      } else {
        console.warn(`File not found for id ${user.profilePicture}, skipping delete.`);
      }
    }

    const filename = crypto.randomBytes(16).toString("hex") + path.extname(req.file.originalname);

    // Upload the new profile picture to GridFS
    const uploadStream = gridfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype
    });
    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', async () => {
      // Save the new file ID to the user profile
      user.profilePicture = new mongoose.Types.ObjectId(uploadStream.id);
      const savedUser = await user.save();
      const tokens = createTokens(savedUser);

      res.status(200).json({
        accessToken: tokens.accessToken,
      });
    });

    uploadStream.on('error', (err) => {
      console.error("Error during file upload:", err);
      res.status(500).send({ error: "Error uploading file", err });
    });

  } catch (err) {
    console.error("Error in profile picture upload process:", err);
    res.status(500).send({ error: "Failed to upload profile picture", err });
  }
};

const get_profile_picture = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePicture"
    });

    const files = await gridfsBucket
      .find({ _id: new mongoose.Types.ObjectId(req.params.id) })
      .toArray();

    if (!files || files.length === 0) {
      return res.status(404).json({ error: "No profile picture found" });
    }

    if (files[0].contentType === "image/jpeg" || files[0].contentType === "image/png") {
      const readstream = gridfsBucket.openDownloadStream(files[0]._id);
      readstream.pipe(res);
    } else {
      res.status(404).json({ error: "File is not an image" });
    }
  } catch (err) {
    res.status(500).send({ error: "Error retrieving profile picture", err });
  }
};

const delete_profile_picture = async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const gridfsBucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: "profilePicture"
    });

    const user = await User.findById(res.locals.user._id);
    if (user && user.profilePicture) {
      await gridfsBucket.delete(new mongoose.Types.ObjectId(user.profilePicture));
      user.profilePicture = undefined;
      await user.save();
      return res.sendStatus(200);
    } else {
      return res.sendStatus(204); // No content to delete
    }
  } catch (err) {
    res.status(500).send({ error: "Failed to delete profile picture", err });
  }
};

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
  refresh_tokens,
};
