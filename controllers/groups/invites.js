const {
  ACTIVE_STATUS,
  ASSIGN_ROLES,
  Conversation,
  Group,
  GroupInvite,
  GroupMembership,
  GroupProgramAssignment,
  Program,
  ROLE,
  TRAINER_ROLES,
  Training,
  User,
  buildInviteUrl,
  buildTemplateMap,
  buildWorkoutsForUser,
  crypto,
  dayjs,
  ensureRole,
  escapeRegex,
  groupPictureBucket,
  isValidObjectId,
  mongoose,
  normalizeRole,
  requireMembership,
  resolveDayMap,
} = require("./context");

const create_invite = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId } = req.params;
    const { email, role = ROLE.ATHLETE } = req.body;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    if (!email || !String(email).includes("@")) {
      return res.status(400).json({ error: "Valid email is required." });
    }

    if (!Object.values(ROLE).includes(role)) {
      return res.status(400).json({ error: "Invalid role." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({
      email: new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i"),
    })
      .select("_id email")
      .lean();

    if (existingUser) {
      const existingMembership = await GroupMembership.findOne({
        groupId,
        userId: existingUser._id,
        status: ACTIVE_STATUS,
      });
      if (existingMembership) {
        return res.status(400).json({ error: "User is already in the group." });
      }
    }

    const group = await Group.findById(groupId).select("name").lean();
    if (!group) {
      return res.status(404).json({ error: "Group not found." });
    }

    const expiresAt = dayjs().add(7, "day").toDate();
    const token = crypto.randomBytes(32).toString("hex");

    let invite = await GroupInvite.findOne({
      groupId,
      email: normalizedEmail,
      status: "PENDING",
    });

    if (invite) {
      invite.token = token;
      invite.expiresAt = expiresAt;
      invite.role = resolvedRole;
      invite.invitedBy = adminId;
    } else {
      invite = new GroupInvite({
        groupId,
        email: normalizedEmail,
        role: resolvedRole,
        invitedBy: adminId,
        token,
        expiresAt,
      });
    }

    await invite.save();

    const inviter = await User.findById(adminId)
      .select("firstName lastName")
      .lean();

    const inviteUrl = buildInviteUrl(invite.token);
    const mailOptions = {
      from: '"Firebelly Fitness" <info@firebellyfitness.com>',
      to: normalizedEmail,
      subject: `You're invited to join ${group.name}`,
      html: `
        <p>Hi there,</p>
        <p>${inviter?.firstName || "A coach"} invited you to join <strong>${group.name}</strong> on Firebelly Fitness.</p>
        <p>Your role: <strong>${resolvedRole}</strong></p>
        <p>Click the link below to accept the invite:</p>
        <a href="${inviteUrl}">Accept Invite</a>
        <p>This invite will expire in 7 days.</p>
      `,
    };

    await sendEmail(mailOptions);

    return res.json({ status: "sent", invite });
  } catch (err) {
    return next(err);
  }
};

const list_invites = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId } = req.params;

    if (!isValidObjectId(groupId)) {
      return res.status(400).json({ error: "Invalid group ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const invites = await GroupInvite.find({ groupId, status: "PENDING" })
      .sort({ createdAt: -1 })
      .lean();

    const normalized = invites.map((invite) => ({
      ...invite,
      role: normalizeRole(invite.role),
    }));

    return res.json(normalized);
  } catch (err) {
    return next(err);
  }
};

const revoke_invite = async (req, res, next) => {
  try {
    const adminId = res.locals.user._id;
    const { groupId, inviteId } = req.params;

    if (!isValidObjectId(groupId) || !isValidObjectId(inviteId)) {
      return res.status(400).json({ error: "Invalid group or invite ID." });
    }

    const membership = await requireMembership(groupId, adminId);
    if (!ensureRole(membership, TRAINER_ROLES)) {
      return res.status(403).json({ error: "Trainer access required." });
    }

    const invite = await GroupInvite.findOne({
      _id: inviteId,
      groupId,
      status: "PENDING",
    });

    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    invite.status = "REVOKED";
    await invite.save();

    return res.json({ status: "revoked" });
  } catch (err) {
    return next(err);
  }
};

const get_invite_by_token = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ error: "Invite token required." });
    }

    const invite = await GroupInvite.findOne({ token }).lean();
    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
      await GroupInvite.updateOne({ _id: invite._id }, { status: "EXPIRED" });
      return res.status(400).json({ error: "Invite expired." });
    }

    const group = await Group.findById(invite.groupId).select("name").lean();

    return res.json({
      invite: {
        email: invite.email,
        role: normalizeRole(invite.role),
        status: invite.status,
        expiresAt: invite.expiresAt,
        groupId: invite.groupId,
      },
      group: group || null,
    });
  } catch (err) {
    return next(err);
  }
};

const accept_invite = async (req, res, next) => {
  try {
    const userId = res.locals.user._id;
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Invite token required." });
    }

    const invite = await GroupInvite.findOne({ token });
    if (!invite) {
      return res.status(404).json({ error: "Invite not found." });
    }

    if (invite.status !== "PENDING") {
      return res.status(400).json({ error: `Invite is ${invite.status.toLowerCase()}.` });
    }

    if (invite.expiresAt < new Date()) {
      invite.status = "EXPIRED";
      await invite.save();
      return res.status(400).json({ error: "Invite expired." });
    }

    const user = await User.findById(userId).select("email").lean();
    if (!user || user.email.toLowerCase() !== invite.email.toLowerCase()) {
      return res.status(403).json({ error: "Invite email does not match your account." });
    }

    const resolvedRole = normalizeRole(invite.role);
    let membership = await GroupMembership.findOne({ groupId: invite.groupId, userId });
    if (membership) {
      membership.role = resolvedRole;
      membership.status = ACTIVE_STATUS;
      membership.joinedAt = membership.joinedAt || new Date();
      await membership.save();
    } else {
      membership = new GroupMembership({
        groupId: invite.groupId,
        userId,
        role: resolvedRole,
        status: ACTIVE_STATUS,
        addedBy: invite.invitedBy,
        joinedAt: new Date(),
      });
      await membership.save();
    }

    if (membership.role === ROLE.ATHLETE) {
      await applyAssignmentsForMember({
        groupId: invite.groupId,
        userId,
        addedBy: invite.invitedBy,
      });
    }

    invite.role = resolvedRole;
    invite.status = "ACCEPTED";
    invite.acceptedAt = new Date();
    invite.acceptedBy = userId;
    await invite.save();

    return res.json({ status: "accepted", groupId: invite.groupId });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  create_invite,
  list_invites,
  revoke_invite,
  get_invite_by_token,
  accept_invite
};
