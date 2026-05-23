const mongoose = require("mongoose");
const logger = require("../utils/logger");

const isProduction = process.env.NODE_ENV === "production";

const formatValidationErrors = (err) => {
  const errors = {};
  for (const field of Object.keys(err.errors)) {
    errors[field] = err.errors[field].message;
  }
  return errors;
};

const duplicateKeyMessage = (err) => {
  const fields = Object.keys(err.keyPattern || err.keyValue || {});
  if (fields.some((f) => f.toLowerCase().includes("email"))) {
    return "Email already exists";
  }
  return "Duplicate value already exists";
};

const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const logContext = {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip,
    userId: req.user?._id?.toString(),
  };

  // Mongoose validation
  if (err instanceof mongoose.Error.ValidationError) {
    logger.warn("Validation error", { ...logContext, err: err.message });
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formatValidationErrors(err),
    });
  }

  // Invalid ObjectId / cast
  if (err instanceof mongoose.Error.CastError) {
    logger.warn("Cast error", { ...logContext, path: err.path, value: err.value });
    return res.status(400).json({
      success: false,
      message: "Invalid ID format",
    });
  }

  // Duplicate key
  if (err.code === 11000) {
    logger.warn("Duplicate key error", logContext);
    return res.status(400).json({
      success: false,
      message: duplicateKeyMessage(err),
    });
  }

  // JWT
  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    logger.warn("JWT error", { ...logContext, err: err.message });
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }

  const statusCode = err.status || err.statusCode || 500;

  if (statusCode < 500) {
    logger.warn(err.message || "Client error", logContext);
    return res.status(statusCode).json({
      success: false,
      message: err.message || "Request failed",
    });
  }

  logger.error(err.message || "Internal server error", {
    ...logContext,
    stack: err.stack,
    name: err.name,
  });

  if (isProduction) {
    return res.status(500).json({
      success: false,
      message: "Something went wrong",
    });
  }

  return res.status(500).json({
    success: false,
    message: err.message || "Internal server error",
    error: err.name,
    stack: err.stack,
  });
};

module.exports = errorHandler;
