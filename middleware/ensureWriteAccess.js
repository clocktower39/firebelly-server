const ensureWriteAccess = (req, res, next) => {
  if (res.locals.user?.viewOnly) {
    return res.status(403).json({ error: "View-only access. Changes are not allowed." });
  }
  if (res.locals.user?.delegationMode && !res.locals.user?.canModifyViewedAccount) {
    return res.status(403).json({ error: "Delegated access cannot modify this account." });
  }
  return next();
};

module.exports = {
  ensureWriteAccess,
};
