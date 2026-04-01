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
const compression = require("compression");
const { initSocket } = require("./server/socket");

const app = express();
const server = http.createServer(app);

// Trust Render's reverse proxy so express-rate-limit can correctly
// identify client IPs via the X-Forwarded-For header.
app.set('trust proxy', 1);

// Enable Gzip compression for faster data transfer
app.use(compression());

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

// Build allowed origins list, including Render's external URL if provided.
const allowedOrigins = [
  ...frontendOrigin.split(",").map((o) => o.trim()),
  process.env.RENDER_EXTERNAL_URL,
].filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, "");
      const isExplicitlyAllowed = allowedOrigins.some(
        (allowed) => allowed.replace(/\/$/, "") === normalizedOrigin
      );

      // Support for Render subdomains automatically
      const isRenderDomain = normalizedOrigin.endsWith(".onrender.com");

      if (isExplicitlyAllowed || isRenderDomain) {
        return callback(null, true);
      }

      console.error(`[CORS REJECTED] Origin: "${origin}" | Allowed: ${allowedOrigins.join(", ")}`);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "10kb" }));
// Prevent browser caching of app.js so code updates take effect immediately
app.get('/app.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'app.js'));
});

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '1d', // Cache static assets for 1 day for speed
  etag: true
}));
app.use("/vendor/chart", express.static(path.join(__dirname, "node_modules", "chart.js", "dist")));

const rateLimitWindowMs = 15 * 60 * 1000;
// Increased default rate limit to 2000 for a smoother experience
const apiRateLimitMax = Number(process.env.API_RATE_LIMIT_MAX || 2000);

const authLimiter = rateLimit({
  windowMs: rateLimitWindowMs,
  max: 50, // Increased auth attempt limit slightly
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
  console.log("║   🚛  Bihal Suppliers — Fleet Manager    ║");
  console.log(`║   Server running on port ${PORT}             ║`);
  console.log("╚══════════════════════════════════════════╝");
});
