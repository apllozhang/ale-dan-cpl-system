import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG, hasPermission, type Permission } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { logger, logSlowOperation } from "./logger";

// ── In-memory sliding window rate limiter ──
const rateLimitBuckets = new Map<string, { count: number; windowStart: number }>();
const DEFAULT_RATE_LIMIT = { max: 100, windowMs: 60_000 };

function checkRateLimit(key: string, max: number, windowMs: number): number | null {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    rateLimitBuckets.set(key, { count: 1, windowStart: now });
    return null;
  }
  bucket.count++;
  if (bucket.count > max) {
    return Math.ceil((windowMs - (now - bucket.windowStart)) / 1000);
  }
  return null;
}

// Cleanup stale buckets every 5 minutes
setInterval(() => {
  const now = Date.now();
  rateLimitBuckets.forEach((bucket, key) => {
    if (now - bucket.windowStart > 300_000) rateLimitBuckets.delete(key);
  });
}, 300_000).unref();

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

// ── Structured logging + rate limiting middleware ──
// This middleware is now applied to ALL procedures (not just publicProcedure)
const loggingMiddleware = t.middleware(async opts => {
  const start = Date.now();
  const { path, type, meta } = opts;
  const userId = opts.ctx.user?.id ?? null;
  const requestId = opts.ctx.requestId;

  // Rate limiting for mutations
  if (type === 'mutation' && opts.ctx.user) {
    const rl = (meta as Record<string, unknown> | undefined)?.rateLimit as
      | { max: number; windowMs: number }
      | undefined;
    const limit = rl ?? DEFAULT_RATE_LIMIT;
    const key = `rl:${userId}:${path}`;
    const retryAfter = checkRateLimit(key, limit.max, limit.windowMs);
    if (retryAfter !== null) {
      const duration = Date.now() - start;
      logger.warn("rate_limited", { requestId, userId, path, type, duration });
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Rate limit exceeded. Try again in ${retryAfter}s`,
      });
    }
  }

  try {
    const result = await opts.next();
    const duration = Date.now() - start;

    // Log slow requests
    logSlowOperation(`trpc.${path}`, duration);

    logger.info("trpc_request", { requestId, userId, path, type, duration, outcome: "success" });
    return result;
  } catch (error) {
    const duration = Date.now() - start;
    const errorCode = error instanceof TRPCError ? error.code : "INTERNAL_SERVER_ERROR";
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error("trpc_request", { requestId, userId, path, type, duration, outcome: "error", errorCode, errorMessage });
    throw error;
  }
});

export const router = t.router;

// All procedures now go through loggingMiddleware
export const publicProcedure = t.procedure.use(loggingMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// protectedProcedure chains logging + auth
export const protectedProcedure = t.procedure.use(loggingMiddleware).use(requireUser);

export const adminProcedure = t.procedure.use(loggingMiddleware).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || (ctx.user.role !== 'admin' && !ctx.user.isSuperAdmin)) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

export const superAdminProcedure = t.procedure.use(loggingMiddleware).use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || !ctx.user.isSuperAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: "需要超级管理员权限" });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Permission-based procedure factory
export function permissionProcedure(permission: Permission) {
  return t.procedure.use(loggingMiddleware).use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
      }

      if (!hasPermission(ctx.user, permission)) {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );
}
