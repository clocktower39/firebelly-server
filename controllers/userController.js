const User = require("../models/user");
const Relationship = require("../models/relationship");
const ScheduleEvent = require("../models/scheduleEvent");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const path = require('path');
const { verifyRefreshToken } = require("../middleware/auth");
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const { sendEmail } = require("../services/emailService")

const createTokens = (user) => {
  const accessToken = jwt.sign(user._doc, ACCESS_TOKEN_SECRET, {
    expiresIn: "180m", // Set a shorter expiration for access tokens
  });

  const refreshToken = jwt.sign(user._doc, REFRESH_TOKEN_SECRET, {
    expiresIn: "90d", // Set a longer expiration for refresh tokens
  });

  return { accessToken, refreshToken };
};

const signup_user = async (req, res, next) => {
  try {
    const user = new User(req.body);

    // Generate a verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days

    // Assign token and expiration to the user
    user.verified = {
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
    };

    // Save the user
    await user.save();

    // Create verification URL
    const verificationUrl = `https://www.firebellyfitness.com/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

    // Prepare email options
    const mailOptions = {
      from: '"Firebelly Fitness" <info@firebellyfitness.com>',
      to: user.email,
      subject: 'Verify Your Email',
      html: `
        <p>Hi ${user.firstName},</p>
        <p>Thank you for registering at Firebelly Fitness.</p>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
    };

    // Send the verification email
    await sendEmail(mailOptions);

    res.status(200).json({
      status: "success",
      message: "Registration successful. Please check your email to verify your account.",
    });
  } catch (err) {
    next(err);
  }
};

const verify_email = async (req, res, next) => {
  const { token, email } = req.query;

  try {
    const user = await User.findOne({
      email,
      'verified.verificationToken': token,
      'verified.verificationTokenExpires': { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired verification token." });
    }

    // Update user verification status
    user.verified.isVerified = true;
    user.verified.verificationToken = undefined;
    user.verified.verificationTokenExpires = undefined;

    await user.save();

    // Optionally, generate tokens to log the user in
    const tokens = createTokens(user);

    res.status(200).json({
      status: "success",
      message: "Email verified successfully.",
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  } catch (err) {
    next(err);
  }
};

const resend_verification_email = async (req, res, next) => {
  const { email } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ error: "Email not found." });
    }

    if (user.verified.isVerified) {
      return res.status(400).json({ error: "Account is already verified." });
    }

    // Generate a new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

    // Update user with new token
    user.verified.verificationToken = verificationToken;
    user.verified.verificationTokenExpires = verificationTokenExpires;

    await user.save();

    // Create verification URL
    const verificationUrl = `https://www.firebellyfitness.com/verify-email?token=${verificationToken}&email=${encodeURIComponent(user.email)}`;

    // Prepare email options
    const mailOptions = {
      from: '"Firebelly Fitness" <info@firebellyfitness.com>',
      to: user.email,
      subject: 'Verify Your Email',
      html: `
        <p>Hi ${user.firstName},</p>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 24 hours.</p>
      `,
    };

    // Send the verification email
    await sendEmail(mailOptions);

    res.status(200).json({
      status: "success",
      message: "Verification email resent. Please check your email.",
    });
  } catch (err) {
    next(err);
  }
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
        if (!user.verified.isVerified) {
          return res.status(400).json({
            authenticated: false,
            error: { email: "Please verify your email before logging in." },
          });
        }
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

const get_public_trainer_info = (req, res, next) => {
  const { id } = req.params;

  User.findById(id)
    .then(async (user) => {
      if (!user) {
        return res.status(404).json({ error: "Trainer not found." });
      }

      if (!user.isTrainer) {
        const [hasClients, hasEvents] = await Promise.all([
          Relationship.exists({ trainer: id }),
          ScheduleEvent.exists({ trainerId: id }),
        ]);
        if (!hasClients && !hasEvents) {
          return res.status(404).json({ error: "Trainer not found." });
        }
      }

      return res.json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        profilePicture: user.profilePicture,
      });
    })
    .catch((err) => next(err));
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
  verify_email,
  resend_verification_email,
  login_user,
  update_user,
  checkAuthLoginToken,
  get_userInfo,
  get_public_trainer_info,
  change_password,
  get_trainers,
  upload_profile_picture,
  get_profile_picture,
  delete_profile_picture,
  refresh_tokens,
};
