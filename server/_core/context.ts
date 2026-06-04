import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import crypto from "crypto";
import { validateSession } from "../db/sessions";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  requestId: string;
};

/** Extract user from request cookie (for non-tRPC middleware) */
export async function getUserFromRequest(req: CreateExpressContextOptions["req"]): Promise<User | null> {
  try {
    const cookieHeader = req.headers.cookie;
    if (!cookieHeader) return null;
    const cookies = parseCookieHeader(cookieHeader);
    const sessionId = cookies[COOKIE_NAME];
    if (!sessionId) return null;

    // Validate session and get user ID
    const userId = await validateSession(sessionId);
    if (!userId) return null;

    return await db.getUserById(userId) ?? null;
  } catch {
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    const cookieHeader = opts.req.headers.cookie;
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const sessionId = cookies[COOKIE_NAME];
      if (sessionId) {
        // Validate session and get user ID
        const userId = await validateSession(sessionId);
        if (userId) {
          const dbUser = await db.getUserById(userId);
          if (dbUser) {
            user = dbUser;
          }
        }
      }
    }
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    requestId: crypto.randomUUID(),
  };
}
