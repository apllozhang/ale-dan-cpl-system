import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import path from "path";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerUploadRoutes } from "./upload";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { serveStatic, setupVite } from "./vite";
import { startImportWorker } from "../workers/importWorker";
import { logger, logSlowOperation } from "./logger";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

// ── Process-level error handlers ──
process.on("uncaughtException", (error) => {
  logger.error("uncaught_exception", {
    error: error.message,
    stack: error.stack,
    name: error.name,
  });
  // Give logger time to flush before exiting
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason) => {
  logger.error("unhandled_rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// ── Simple in-memory metrics collector ──
const metrics = {
  requests: { total: 0, byStatus: {} as Record<number, number>, byMethod: {} as Record<string, number> },
  startTime: Date.now(),
};

function recordRequest(method: string, statusCode: number): void {
  metrics.requests.total++;
  metrics.requests.byStatus[statusCode] = (metrics.requests.byStatus[statusCode] || 0) + 1;
  metrics.requests.byMethod[method] = (metrics.requests.byMethod[method] || 0) + 1;
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust proxy — only enable behind a reverse proxy
  // Prevents x-forwarded-for spoofing
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // CORS — origin allowlist from env, credentials for cookie auth
  // In development, automatically allow localhost origins
  const isDev = process.env.NODE_ENV !== "production";
  const baseAllowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["https://www.extremecloudiq.cn"];
  const allowedOrigins = isDev
    ? [...baseAllowedOrigins, /^https?:\/\/localhost(:\d+)?$/]
    : baseAllowedOrigins;
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.some(o => (typeof o === "string" ? o === origin : o.test(origin)))) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    })
  );

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ── HTTP Request logging middleware ──
  app.use((req, res, next) => {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const statusCode = res.statusCode;

      // Record metrics
      recordRequest(req.method, statusCode);

      // Log slow requests
      logSlowOperation(`http.${req.method} ${req.path}`, duration);

      // Skip logging for health check and static assets
      const isHealthCheck = req.path === "/api/health" || req.path === "/api/ready";
      const isStaticAsset = req.path.startsWith("/assets/") || req.path === "/favicon.ico";

      if (!isHealthCheck && !isStaticAsset) {
        logger.info("http_request", {
          method: req.method,
          path: req.path,
          statusCode,
          duration,
          ip: req.ip || req.socket.remoteAddress,
          userAgent: req.headers["user-agent"],
        });
      }
    });

    next();
  });

  // CSRF protection for mutations — validate Origin/Referer
  // Only applied to cross-origin requests; same-origin requests are inherently safe
  app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE" || req.method === "PATCH") {
      const origin = req.headers.origin || req.headers.referer;

      // Allow health check and upload endpoints without origin (for non-browser clients)
      const isExemptPath = req.path === "/api/health" || req.path === "/api/ready" || req.path === "/api/upload";

      if (!isExemptPath && origin) {
        // Extract hostname from origin for comparison with Host header
        const hostHeader = req.headers.host || "";
        let originHost = "";
        try {
          originHost = new URL(origin).host;
        } catch {
          // If origin can't be parsed (e.g., it was a referer URL), extract manually
          const match = origin.match(/^https?:\/\/([^/:]+)/);
          originHost = match ? match[1] : "";
        }

        // Skip CSRF check for same-origin requests
        if (originHost && originHost === hostHeader) {
          next();
          return;
        }

        // For cross-origin requests, validate against allowlist
        if (!allowedOrigins.some(o => (typeof o === "string" ? origin.startsWith(o) : o.test(origin)))) {
          res.status(403).json({ error: "CSRF validation failed: invalid origin" });
          return;
        }
      }
    }
    next();
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerUploadRoutes(app);

  // Auth middleware for protected static files
  const requireAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const { getUserFromRequest } = await import("./context");
    try {
      const user = await getUserFromRequest(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      next();
    } catch {
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  // ── Enhanced health check — no auth required ──
  app.get("/api/health", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({ status: "unhealthy", db: "disconnected" });
        return;
      }
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      const dbLatency = Date.now() - start;

      const memUsage = process.memoryUsage();

      res.json({
        status: "healthy",
        db: "connected",
        dbLatency,
        uptime: Math.floor(process.uptime()),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        node: process.version,
        env: process.env.NODE_ENV || "development",
      });
    } catch (error) {
      logger.error("health_check_failed", { error: error instanceof Error ? error.message : String(error) });
      res.status(503).json({ status: "unhealthy", db: "error" });
    }
  });

  // Liveness probe
  app.get("/api/ready", (_req, res) => {
    res.json({ status: "ready" });
  });

  // ── Metrics endpoint — returns application metrics ──
  app.get("/api/metrics", async (_req, res) => {
    try {
      const db = await getDb();

      // Get import job stats
      let importJobStats = { pending: 0, processing: 0, succeeded: 0, failed: 0 };
      if (db) {
        try {
          const { getImportJobStats } = await import("../db/importJobs");
          importJobStats = await getImportJobStats();
        } catch {
          // Non-fatal
        }
      }

      const memUsage = process.memoryUsage();

      res.json({
        uptime: Math.floor(process.uptime()),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024),
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        },
        requests: metrics.requests,
        importJobs: importJobStats,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("metrics_failed", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Failed to collect metrics" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // Serve eFlash uploaded files (requires auth)
  // Force attachment download with security headers
  app.get("/uploads/eflash/:eflashId/:filename", requireAuth, async (req, res) => {
    try {
      const { eflashId, filename } = req.params;

      // Sanitize path components to prevent traversal
      const safeEflashId = path.basename(eflashId);
      const safeFilename = path.basename(filename);

      if (!safeEflashId || !safeFilename || safeEflashId === "." || safeFilename === ".") {
        res.status(400).json({ error: "Invalid path" });
        return;
      }

      const filePath = path.resolve(process.cwd(), "uploads", "eflash", safeEflashId, safeFilename);

      // Verify the resolved path is within the uploads directory
      const uploadsDir = path.resolve(process.cwd(), "uploads", "eflash");
      if (!filePath.startsWith(uploadsDir)) {
        res.status(403).json({ error: "Access denied" });
        return;
      }

      // Check if file exists
      try {
        await fsPromises.access(filePath, fs.constants.R_OK);
      } catch {
        res.status(404).json({ error: "File not found" });
        return;
      }

      // Set security headers
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(safeFilename)}"`);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "no-store");

      // Stream the file
      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
    } catch (error) {
      logger.error("download_failed", { error: error instanceof Error ? error.message : String(error) });
      res.status(500).json({ error: "Download failed" });
    }
  });

  // ── Global Express error handler ──
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error("unhandled_express_error", {
      error: err.message,
      stack: err.stack,
      method: req.method,
      path: req.path,
    });
    res.status(500).json({ error: "Internal server error" });
  });

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");

  // Production: bind to specified port or fail fast
  // Development: auto-find available port
  let port: number;
  if (process.env.NODE_ENV === "production") {
    if (!(await isPortAvailable(preferredPort))) {
      logger.error("port_unavailable", { port: preferredPort });
      process.exit(1);
    }
    port = preferredPort;
  } else {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      logger.info("port_fallback", { preferred: preferredPort, actual: port });
    }
  }

  server.listen(port, () => {
    logger.info("server_started", { port, env: process.env.NODE_ENV || "development" });
    // Start background import worker
    startImportWorker();
  });
}

startServer().catch((error) => {
  logger.error("server_startup_failed", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});
