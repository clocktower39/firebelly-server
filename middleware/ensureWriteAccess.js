const ensureWriteAccess = (req, res, next) => {
  if (res.locals.user?.viewOnly) {
    return res.status(403).json({ error: "View-only access. Changes are not allowed." });
  }
  return next();
};

module.exports = {
  ensureWriteAccess,
};
