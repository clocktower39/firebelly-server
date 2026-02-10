const ensureGuardianAccess = (req, res, next) => {
  const user = res.locals.user;
  const accountType = user?.accountType;

  if (!user) {
    return res.status(401).json({ error: "Authentication required." });
  }

  if (user.viewOnly) {
    return res.status(403).json({ error: "View-only access. Changes are not allowed." });
  }

  if (!["adult", "guardian"].includes(accountType)) {
    return res.status(403).json({
      error: "Only adult or guardian accounts can manage child accounts.",
    });
  }

  return next();
};

module.exports = {
  ensureGuardianAccess,
};
