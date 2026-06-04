export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};

/**
 * Require an environment variable to be set and non-empty.
 * Exits immediately in production if missing.
 */
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    console.error(`[FATAL] ${name} is not set. Server cannot start without it.`);
    process.exit(1);
  }
  return value;
}

// Production startup validation — all hard dependencies checked before any listener is bound
if (ENV.isProduction) {
  requireEnv("DATABASE_URL");
  requireEnv("CORS_ORIGINS");
  requireEnv("JWT_SECRET");
  requireEnv("PORT");
}

// Non-production warning for missing secrets
if (!ENV.isProduction && !ENV.cookieSecret) {
  console.warn("[WARN] JWT_SECRET is not set. Using empty string — tokens are trivially forgeable. Set JWT_SECRET in .env");
}
