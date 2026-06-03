import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getDb } from "../db";
import { sql } from "drizzle-orm";
import { serveStatic, setupVite } from "./vite";

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

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Trust proxy — only enable behind a reverse proxy
  // Prevents x-forwarded-for spoofing
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  // CORS — origin allowlist from env, credentials for cookie auth
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : ["https://www.extremecloudiq.cn"];
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
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

  // CSRF protection for mutations — validate Origin/Referer
  app.use((req, res, next) => {
    if (req.method === "POST" || req.method === "PUT" || req.method === "DELETE" || req.method === "PATCH") {
      const origin = req.headers.origin || req.headers.referer;
      if (origin && !allowedOrigins.some(o => origin.startsWith(o))) {
        res.status(403).json({ error: "CSRF validation failed" });
        return;
      }
    }
    next();
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);

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

  // Health check — no auth required
  app.get("/api/health", async (_req, res) => {
    try {
      const db = await getDb();
      if (!db) {
        res.status(503).json({ status: "unhealthy", db: "disconnected" });
        return;
      }
      await db.execute(sql`SELECT 1`);
      res.json({ status: "healthy", db: "connected" });
    } catch {
      res.status(503).json({ status: "unhealthy", db: "error" });
    }
  });

  // Liveness probe
  app.get("/api/ready", (_req, res) => {
    res.json({ status: "ready" });
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
  app.use("/uploads/eflash", requireAuth, (req, res, next) => {
    const uploadsPath = path.resolve(process.cwd(), "uploads/eflash");
    express.static(uploadsPath)(req, res, next);
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
      console.error(`Port ${preferredPort} is not available in production mode`);
      process.exit(1);
    }
    port = preferredPort;
  } else {
    port = await findAvailablePort(preferredPort);
    if (port !== preferredPort) {
      console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
    }
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
