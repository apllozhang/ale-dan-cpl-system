import { COOKIE_NAME } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as crypto from "crypto";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import { ENV } from "./env";
import { createSession, SESSION_DURATION_MS } from "../db/sessions";

// In-memory store for OAuth state tokens (nonce -> {redirectUri, expiresAt})
const oauthStateStore = new Map<string, { redirectUri: string; expiresAt: number }>();

// Clean up expired states every 5 minutes
setInterval(() => {
  const now = Date.now();
  oauthStateStore.forEach((value, key) => {
    if (now > value.expiresAt) {
      oauthStateStore.delete(key);
    }
  });
}, 5 * 60 * 1000).unref();

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  // OAuth login initiation — generates state with nonce and redirects to OAuth server
  app.get("/api/oauth/login", (req: Request, res: Response) => {
    const redirectUri = getQueryParam(req, "redirect") || "/";

    // Generate random nonce for CSRF protection
    const nonce = crypto.randomBytes(32).toString("hex");

    // Store state with 5-minute expiry
    oauthStateStore.set(nonce, {
      redirectUri,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    // Build state parameter: base64(nonce + ":" + redirectUri)
    const stateValue = Buffer.from(`${nonce}:${redirectUri}`).toString("base64");

    // Redirect to OAuth server
    const oauthServerUrl = ENV.oAuthServerUrl;
    if (!oauthServerUrl) {
      res.status(500).json({ error: "OAuth server not configured" });
      return;
    }

    const authUrl = new URL("/authorize", oauthServerUrl);
    authUrl.searchParams.set("client_id", ENV.appId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", `${req.protocol}://${req.get("host")}/api/oauth/callback`);
    authUrl.searchParams.set("state", stateValue);

    res.redirect(302, authUrl.toString());
  });

  // OAuth callback — validates state nonce and exchanges code for token
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      // Decode and validate state
      const decoded = Buffer.from(state, "base64").toString("utf-8");
      const [nonce, redirectUri] = decoded.split(":", 2);

      if (!nonce || !redirectUri) {
        res.status(400).json({ error: "Invalid state parameter" });
        return;
      }

      // Check nonce exists and hasn't expired
      const storedState = oauthStateStore.get(nonce);
      if (!storedState) {
        res.status(400).json({ error: "Invalid or expired state parameter" });
        return;
      }

      if (Date.now() > storedState.expiresAt) {
        oauthStateStore.delete(nonce);
        res.status(400).json({ error: "State parameter expired" });
        return;
      }

      // Delete nonce after use (one-time use)
      oauthStateStore.delete(nonce);

      // Exchange code for token
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      // Get user ID for session creation
      const user = await db.getUserByOpenId(userInfo.openId);
      if (!user) {
        res.status(500).json({ error: "Failed to create user session" });
        return;
      }

      // Create server-side session
      const sessionId = await createSession(user.id, SESSION_DURATION_MS);

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionId, { ...cookieOptions, maxAge: SESSION_DURATION_MS });

      // Redirect to the original URI
      res.redirect(302, redirectUri);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
