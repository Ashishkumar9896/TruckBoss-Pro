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
const expenseRoutes = require("./server/routes/expenseRoutes");
const { authenticateToken } = require("./server/middleware/authMiddleware");
const errorHandler = require("./server/middleware/errorMiddleware");
const compression = require("compression");
const { initSocket } = require("./server/socket");

const app = express();
const server = http.createServer(app);

/**
 * Trust the reverse proxy (e.g., Render, Nginx) to ensure the rate limiter
 * correctly identifies client IPs via the X-Forwarded-For header.
 */
app.set('trust proxy', 1);

// Enable Gzip compression to optimize payload size and transfer speeds.
app.use(compression());

const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
initSocket(server);

const cron = require("node-cron");
const backupDatabase = require("./server/scripts/backup");

/**
 * Schedule a full database backup daily at 02:00 AM.
 */
cron.schedule("0 2 * * *", async () => {
  try {
    await backupDatabase();
  } catch (err) {
    console.error("[Cron Error] Database backup failed", err);
  }
});

/**
 * Deployment Configuration:
 * Disable strict Content Security Policy (CSP) to maintain compatibility 
 * with legacy CDN scripts and inline event handlers used in the frontend.
 */
app.use(helmet({ contentSecurityPolicy: false }));

// Configure CORS allowed origins based on environment settings and deployment platform.
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
/**
 * Static Asset Management:
 * Specific route for app.js to bypass browser caching. This ensures client-side
 * logic updates are applied immediately upon deployment.
 */
app.get('/app.js', (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.sendFile(path.join(__dirname, 'public', 'app.js'));
});

app.use(express.static(path.join(__dirname, "public"), {
  maxAge: '1d', // Cache static assets for 24 hours to improve repeat-load performance.
  etag: true
}));
app.use("/vendor/chart", express.static(path.join(__dirname, "node_modules", "chart.js", "dist")));

const rateLimitWindowMs = 15 * 60 * 1000;
// Global API rate limiting configuration.
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

/**
 * Route Middleware Application:
 * Apply the general API limiter first, followed by stricter limits
 * on high-sensitivity authentication endpoints.
 */
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
app.use("/api", authenticateToken, expenseRoutes);

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
