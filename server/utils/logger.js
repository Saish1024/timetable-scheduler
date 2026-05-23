const winston = require("winston");

const SENSITIVE_KEY_PATTERN =
  /password|token|authorization|cookie|secret|jwt|refresh/i;

const redactValue = (value) => {
  if (value == null || typeof value !== "object") {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  const redacted = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      redacted[key] = "[REDACTED]";
    } else {
      redacted[key] = redactValue(nested);
    }
  }
  return redacted;
};

const sanitizeMeta = (meta) => {
  if (!meta || typeof meta !== "object") {
    return meta;
  }
  return redactValue(meta);
};

const isProduction = process.env.NODE_ENV === "production";

const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format((info) => {
    if (info.meta) {
      info.meta = sanitizeMeta(info.meta);
    }
    if (info.request) {
      info.request = sanitizeMeta(info.request);
    }
    return info;
  })(),
  winston.format.json()
);

const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...rest }) => {
    const extra = Object.keys(rest).length
      ? ` ${JSON.stringify(sanitizeMeta(rest), null, 2)}`
      : "";
    const stackTrace = stack ? `\n${stack}` : "";
    return `${timestamp} [${level}]: ${message}${extra}${stackTrace}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),
  levels: {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3,
  },
  format: isProduction ? productionFormat : developmentFormat,
  transports: [new winston.transports.Console()],
});

/**
 * Log with automatic redaction of sensitive fields in metadata.
 */
const safeLog = (level, message, meta) => {
  if (meta !== undefined) {
    logger.log(level, message, sanitizeMeta(meta));
  } else {
    logger.log(level, message);
  }
};

module.exports = {
  ...logger,
  error: (message, meta) => safeLog("error", message, meta),
  warn: (message, meta) => safeLog("warn", message, meta),
  info: (message, meta) => safeLog("info", message, meta),
  debug: (message, meta) => safeLog("debug", message, meta),
};
