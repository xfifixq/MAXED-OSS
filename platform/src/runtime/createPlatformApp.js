const createServiceApp = require("../shared/createServiceApp");

module.exports = function createPlatformApp({ requireAuth, supabaseConnected }) {
  return createServiceApp({
    serviceName: "maxed-api",
    version: "0.1.0",
    requireAuth,
    publicPaths: [
      "/auth/login",
      "/auth/verify",
      "/register",
      "/auth/forgot-password",
      "/auth/reset-password",
    ],
    includeSupabaseStatus: true,
    supabaseConnected,
  });
};
