require("dotenv").config({ override: true });

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
const rateLimit = require("express-rate-limit");

require("./server/config/db");

const authRoutes = require("./server/routes/authRoutes");
const truckRoutes = require("./server/routes/truckRoutes");
const driverRoutes = require("./server/routes/driverRoutes");
const customerRoutes = require("./server/routes/customerRoutes");
const tripRoutes = require("./server/routes/tripRoutes");
const fuelRoutes = require("./server/routes/fuelRoutes");
const reportRoutes = require("./server/routes/reportRoutes");
const dashboardRoutes = require("./server/routes/dashboardRoutes");
const maintenanceRoutes = require("./server/routes/maintenanceRoutes");
const { authenticateToken } = require("./server/middleware/authMiddleware");
const errorHandler = require("./server/middleware/errorMiddleware");
const { initSocket } = require("./server/socket");

const app = express();
const server = http.createServer(app);

const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
initSocket(server);

const cron = require("node-cron");
const backupDatabase = require("./server/scripts/backup");

// Schedule database backup every day at 02:00 AM
cron.schedule("0 2 * * *", async () => {
  try {
    await backupDatabase();
  } catch (err) {
    console.error("[Cron Error] Database backup failed", err);
  }
});

// The current frontend uses CDN scripts and inline handlers; disable CSP for compatibility.
app.use(helmet({ contentSecurityPolicy: false }));

// Build allowed origins list from FRONTEND_ORIGIN (supports comma-separated values)
const allowedOrigins = frontendOrigin.split(",").map((o) => o.trim());

app.use(
  cors({
    origin(origin, callback) {
      // Allow same-origin/server-to-server requests with no Origin header.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/vendor/chart", express.static(path.join(__dirname, "node_modules", "chart.js", "dist")));

const rateLimitWindowMs = 15 * 60 * 1000;
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || 500);

const authLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const apiLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: apiRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

// Apply API-wide limiter first, then stricter limiter for auth endpoints.
app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

const analyticsRoutes = require("./server/routes/analyticsRoutes");

app.use("/api/auth", authRoutes);
app.use("/api", authenticateToken, truckRoutes);
app.use("/api", authenticateToken, driverRoutes);
app.use("/api", authenticateToken, customerRoutes);
app.use("/api", authenticateToken, tripRoutes);
app.use("/api", authenticateToken, fuelRoutes);
app.use("/api", authenticateToken, reportRoutes);
app.use("/api", authenticateToken, dashboardRoutes);
app.use("/api", authenticateToken, maintenanceRoutes);
app.use("/api", authenticateToken, analyticsRoutes);

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   🚛  TruckBoss Pro — Fleet Command      ║");
  console.log(`║   Server running on port ${PORT}             ║`);
  console.log("╚══════════════════════════════════════════╝");
});
