import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "../_core/env";
import * as db from "../db";
import { compare } from "bcryptjs";
import { logActivity } from "./helpers";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";

// Simple in-memory login rate limiter
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getSessionSecret() {
  return new TextEncoder().encode(ENV.cookieSecret);
}

async function createLocalSession(openId: string, name: string): Promise<string> {
  const issuedAt = Date.now();
  const expirationSeconds = Math.floor((issuedAt + ONE_YEAR_MS) / 1000);
  return new SignJWT({
    openId,
    appId: ENV.appId,
    name,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(expirationSeconds)
    .sign(getSessionSecret());
}

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    const { passwordHash, ...safeUser } = ctx.user;
    return safeUser;
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.user) {
      await logActivity(ctx, { action: "logout", resourceType: "auth" });
    }
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  login: publicProcedure
    .input(z.object({
      username: z.string().max(128),
      password: z.string().max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      // Rate limiting by IP
      const clientIp = ctx.req.ip || (ctx.req.headers["x-forwarded-for"] as string) || "unknown";
      const now = Date.now();
      const attempts = loginAttempts.get(clientIp);
      if (attempts) {
        if (now - attempts.lastAttempt < LOGIN_WINDOW_MS) {
          if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "登录尝试次数过多，请15分钟后重试",
            });
          }
        } else {
          // Window expired, reset
          loginAttempts.delete(clientIp);
        }
      }

      const user = await db.getUserByUsername(input.username);
      if (!user || !user.passwordHash) {
        // Track failed login attempt
        const record = loginAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
        record.count++;
        record.lastAttempt = now;
        loginAttempts.set(clientIp, record);

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      const valid = await compare(input.password, user.passwordHash);
      if (!valid) {
        // Track failed login attempt
        const record = loginAttempts.get(clientIp) || { count: 0, lastAttempt: 0 };
        record.count++;
        record.lastAttempt = now;
        loginAttempts.set(clientIp, record);

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      // Clear rate limit on successful login
      loginAttempts.delete(clientIp);

      // Update lastSignedIn
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Audit log
      await logActivity({ user, req: ctx.req }, {
        action: "login", resourceType: "auth", detail: { method: "local" },
      });

      // Create session token
      const token = await createLocalSession(user.openId, user.name || user.username || "User");
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: ONE_YEAR_MS,
      });

      return { success: true, name: user.name || user.username };
    }),
});
