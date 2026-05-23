const express = require("express");
const mongoose = require("mongoose");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const hpp = require("hpp");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const dotenv = require("dotenv");

const connectDB = require("./config/db");
const logger = require("./utils/logger");
const errorHandler = require("./middleware/errorHandler");

const authRoutes = require("./routes/auth");
const timetableRoutes = require("./routes/timetable");
const facultyRoutes = require("./routes/faculty");
const changeRequestRoutes = require("./routes/changerequest");
const departmentRoutes = require("./routes/departments");
const subjectRoutes = require("./routes/subjects");
const assignmentRoutes = require("./routes/assignments");
const roomRoutes = require("./routes/rooms");
const userRoutes = require("./routes/users");
const pdfRoutes = require("./routes/pdf");
const scheduleRoutes = require("./routes/schedule");

dotenv.config();

const app = express();

if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

const parseAllowedOrigins = () =>
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const rateLimitJson = {
  message: "Too many requests, please try again later",
};

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(rateLimitJson),
  skip: (req) => req.path === "/health",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json(rateLimitJson),
});

// 1. Helmet
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// 2. CORS — reject unknown origins with 403
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = parseAllowedOrigins();

  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ message: "Forbidden origin" });
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      const allowedOrigins = parseAllowedOrigins();
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  })
);

// Health check (no auth, no rate limit — for UptimeRobot / Render)
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date(),
    dbStatus:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// 3. Rate limiters
app.use("/api", generalLimiter);
app.use("/api/auth", authLimiter);

// 4. Mongo sanitize
app.use(mongoSanitize());

// 5. XSS clean
app.use(xss());

// 6. HPP
app.use(hpp());

// 7. Compression
app.use(compression());

// 8. Body limit (+ cookies for refresh token)
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// Sanitize parsed JSON bodies (requires parser above)
app.use(mongoSanitize());
app.use(xss());

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Timetable Scheduler API is running",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/timetable", timetableRoutes);
app.use("/api/faculty", facultyRoutes);
app.use("/api/changerequest", changeRequestRoutes);
app.use("/api/departments", departmentRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/pdf", pdfRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

let server;

const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server", { message: error.message, stack: error.stack });
    process.exit(1);
  }
};

process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection", { message: err?.message, stack: err?.stack });
  if (server) {
    server.close(() => process.exit(1));
  } else {
    process.exit(1);
  }
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception", { message: err?.message, stack: err?.stack });
  process.exit(1);
});

startServer();
