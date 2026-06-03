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

// Validate critical environment variables at startup
if (ENV.isProduction && !ENV.cookieSecret) {
  console.error("[FATAL] JWT_SECRET is not set. Refusing to start in production without a signing key.");
  process.exit(1);
}
if (!ENV.cookieSecret) {
  console.warn("[WARN] JWT_SECRET is not set. Using empty string — tokens are trivially forgeable. Set JWT_SECRET in .env");
}
