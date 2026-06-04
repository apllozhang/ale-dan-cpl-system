import { router, publicProcedure } from "../_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "../db";
import { compare } from "bcryptjs";
import { logActivity } from "./helpers";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { createSession, revokeSession, SESSION_DURATION_MS } from "../db/sessions";
import { parse as parseCookieHeader } from "cookie";
import { checkDualRateLimit, recordDualLoginFailure, clearDualLoginAttempts } from "../db/loginAttempts";

export const authRouter = router({
  me: publicProcedure.query(({ ctx }) => {
    if (!ctx.user) return null;
    const { passwordHash: _passwordHash, ...safeUser } = ctx.user;
    return safeUser;
  }),
  logout: publicProcedure.mutation(async ({ ctx }) => {
    if (ctx.user) {
      await logActivity({ user: ctx.user, req: ctx.req }, { action: "logout", resourceType: "auth" });
    }

    // Revoke server-side session
    const cookieHeader = ctx.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const sessionId = cookies[COOKIE_NAME];
      if (sessionId) {
        await revokeSession(sessionId).catch(console.error);
      }
    }

    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
  login: publicProcedure
    .meta({ rateLimit: { max: 5, windowMs: 900_000 } })
    .input(z.object({
      username: z.string().max(128),
      password: z.string().max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      // Dual-dimension rate limiting: IP + username
      // Prevents brute-force from distributed IPs and targeted attacks on a single account
      const clientIp = ctx.req.ip || (ctx.req.headers["x-forwarded-for"] as string) || "unknown";
      const ipKey = `login:ip:${clientIp}`;
      const userKey = `login:user:${input.username.toLowerCase()}`;

      // Check rate limit (both dimensions)
      const { blocked } = await checkDualRateLimit(ipKey, userKey);
      if (blocked) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "登录尝试次数过多，请15分钟后重试",
        });
      }

      const user = await db.getUserByUsername(input.username);
      if (!user || !user.passwordHash) {
        // Track failed login attempt on both dimensions
        await recordDualLoginFailure(ipKey, userKey);

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      const valid = await compare(input.password, user.passwordHash);
      if (!valid) {
        // Track failed login attempt on both dimensions
        await recordDualLoginFailure(ipKey, userKey);

        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "用户名或密码错误",
        });
      }

      // Clear rate limit on successful login (both dimensions)
      await clearDualLoginAttempts(ipKey, userKey);

      // Update lastSignedIn
      await db.upsertUser({
        openId: user.openId,
        lastSignedIn: new Date(),
      });

      // Audit log
      await logActivity({ user, req: ctx.req }, {
        action: "login", resourceType: "auth", detail: { method: "local" },
      });

      // Create server-side session
      const sessionId = await createSession(user.id, SESSION_DURATION_MS);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, sessionId, {
        ...cookieOptions,
        maxAge: SESSION_DURATION_MS,
      });

      return { success: true, name: user.name || user.username };
    }),
});
