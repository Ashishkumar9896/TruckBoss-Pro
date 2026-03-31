function authorizePermission(permission) {
  return (req, res, next) => {
    // Admin bypass
    if (req.user && req.user.role === "admin") {
      return next();
    }

    if (!req.user || !req.user.permissions || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: "Access denied. Missing permission: " + permission });
    }

    next();
  };
}

module.exports = { authorizePermission };
