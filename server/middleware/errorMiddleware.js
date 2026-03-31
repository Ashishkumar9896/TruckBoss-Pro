function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.sqlMessage || err.message || "Internal Server Error",
    code: err.code || undefined,
  });
}

module.exports = errorHandler;
