const crypto = require("crypto");
const User = require("../models/user");
const GuardianLink = require("../models/guardianLink");
const { sendEmail } = require("../services/emailService");
const { createAccessToken } = require("../services/tokenService");
const { getAgeBand } = require("../utils/age");

const ensureGuardianAccount = async (guardianId) => {
  await User.findByIdAndUpdate(
    guardianId,
    { $set: { accountType: "guardian", ageBand: "18_plus" } },
    { new: true }
  );
};

const create_child = async (req, res, next) => {
  try {
    const guardianId = res.locals.user._id;
    const { firstName, lastName, username, pin, dateOfBirth, email } = req.body;
    const normalizedUsername = String(username || "").trim();

    if (!firstName || !lastName || !normalizedUsername || !pin || !dateOfBirth) {
      return res.status(400).json({
        error: "firstName, lastName, username, pin, and dateOfBirth are required.",
      });
    }

    const ageBand = getAgeBand(dateOfBirth);
    if (!ageBand) {
      return res.status(400).json({ error: "Invalid dateOfBirth." });
    }
    if (ageBand === "18_plus") {
      return res.status(400).json({ error: "Child accounts must be under 18." });
    }

    const existingUsername = await User.findOne({
      usernameLower: normalizedUsername.toLowerCase(),
    }).lean();
    if (existingUsername) {
      return res.status(400).json({ error: { username: "Username already in use." } });
    }

    if (email) {
      const existingEmail = await User.findOne({ email }).lean();
      if (existingEmail) {
        return res.status(400).json({ error: { email: "Email already in use." } });
      }
    }

    const accountType = ageBand === "u13" ? "child" : "teen";
    const coppaStatus = ageBand === "u13" ? "needs_consent" : null;

    const user = new User({
      firstName,
      lastName,
      username: normalizedUsername,
      password: pin,
      dateOfBirth: new Date(dateOfBirth),
      email: email || undefined,
      accountType,
      ageBand,
      coppaStatus,
      saleShareOptIn: false,
      adPersonalizationAllowed: false,
      verified: {
        isVerified: email ? false : true,
      },
    });

    if (email) {
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const verificationTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;
      user.verified = {
        isVerified: false,
        verificationToken,
        verificationTokenExpires,
      };
    }

    const savedChild = await user.save();

    await GuardianLink.create({
      guardianId,
      childId: savedChild._id,
    });

    await ensureGuardianAccount(guardianId);

    if (email) {
      const verificationUrl = `https://www.firebellyfitness.com/verify-email?token=${savedChild.verified.verificationToken}&email=${encodeURIComponent(email)}`;
      await sendEmail({
        from: '"Firebelly Fitness" <info@firebellyfitness.com>',
        to: email,
        subject: "Verify Your Email",
        html: `
          <p>Hi ${firstName},</p>
          <p>Please verify your email by clicking the link below:</p>
          <a href="${verificationUrl}">Verify Email</a>
          <p>This link will expire in 7 days.</p>
        `,
      });
    }

    res.status(201).json({
      status: "success",
      child: {
        _id: savedChild._id,
        firstName: savedChild.firstName,
        lastName: savedChild.lastName,
        username: savedChild.username,
        ageBand: savedChild.ageBand,
        coppaStatus: savedChild.coppaStatus,
      },
    });
  } catch (err) {
    next(err);
  }
};

const list_children = async (req, res, next) => {
  try {
    const guardianId = res.locals.user._id;
    const links = await GuardianLink.find({ guardianId, status: "active" })
      .populate("childId", "firstName lastName username ageBand coppaStatus profilePicture email")
      .lean();

    const children = links
      .filter((link) => link.childId)
      .map((link) => ({
        _id: link.childId._id,
        firstName: link.childId.firstName,
        lastName: link.childId.lastName,
        username: link.childId.username,
        ageBand: link.childId.ageBand,
        coppaStatus: link.childId.coppaStatus,
        profilePicture: link.childId.profilePicture,
        email: link.childId.email || null,
      }));

    res.send({ children });
  } catch (err) {
    next(err);
  }
};

const issue_child_view_token = async (req, res, next) => {
  try {
    const guardianId = res.locals.user._id;
    const { childId } = req.body;
    if (!childId) {
      return res.status(400).json({ error: "childId is required." });
    }

    const link = await GuardianLink.findOne({ guardianId, childId, status: "active" });
    if (!link) {
      return res.status(403).json({ error: "Not authorized for this child." });
    }

    const child = await User.findById(childId);
    if (!child) {
      return res.status(404).json({ error: "Child not found." });
    }

    const accessToken = createAccessToken(
      child,
      { viewOnly: true, guardianId },
      { expiresIn: "60m" }
    );

    res.send({ accessToken, expiresIn: 3600 });
  } catch (err) {
    next(err);
  }
};

const record_consent = async (req, res, next) => {
  try {
    const guardianId = res.locals.user._id;
    const { childId, scope, method } = req.body;

    if (!childId || !scope || !method) {
      return res.status(400).json({ error: "childId, scope, and method are required." });
    }

    const link = await GuardianLink.findOne({ guardianId, childId, status: "active" });
    if (!link || link.permissions?.consent === false) {
      return res.status(403).json({ error: "Not authorized to consent for this child." });
    }

    const update = {
      coppaStatus: "consented",
      consentScope: scope,
      coppaConsent: {
        method,
        scope,
        consentedAt: new Date(),
        guardianId,
      },
    };

    const child = await User.findByIdAndUpdate(childId, update, { new: true });
    if (!child) {
      return res.status(404).json({ error: "Child not found." });
    }

    res.send({
      status: "success",
      child: {
        _id: child._id,
        coppaStatus: child.coppaStatus,
        consentScope: child.consentScope,
      },
    });
  } catch (err) {
    next(err);
  }
};

const add_child_email = async (req, res, next) => {
  try {
    const guardianId = res.locals.user._id;
    const { childId, email } = req.body;
    if (!childId || !email) {
      return res.status(400).json({ error: "childId and email are required." });
    }

    const link = await GuardianLink.findOne({ guardianId, childId, status: "active" });
    if (!link) {
      return res.status(403).json({ error: "Not authorized for this child." });
    }

    const existingEmail = await User.findOne({ email }).lean();
    if (existingEmail && String(existingEmail._id) !== String(childId)) {
      return res.status(400).json({ error: { email: "Email already in use." } });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenExpires = Date.now() + 7 * 24 * 60 * 60 * 1000;

    const child = await User.findByIdAndUpdate(
      childId,
      {
        email,
        "verified.isVerified": false,
        "verified.verificationToken": verificationToken,
        "verified.verificationTokenExpires": verificationTokenExpires,
      },
      { new: true }
    );

    if (!child) {
      return res.status(404).json({ error: "Child not found." });
    }

    const verificationUrl = `https://www.firebellyfitness.com/verify-email?token=${verificationToken}&email=${encodeURIComponent(email)}`;
    await sendEmail({
      from: '"Firebelly Fitness" <info@firebellyfitness.com>',
      to: email,
      subject: "Verify Your Email",
      html: `
        <p>Hi ${child.firstName},</p>
        <p>Please verify your email by clicking the link below:</p>
        <a href="${verificationUrl}">Verify Email</a>
        <p>This link will expire in 7 days.</p>
      `,
    });

    res.send({ status: "success" });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  create_child,
  list_children,
  issue_child_view_token,
  record_consent,
  add_child_email,
};
