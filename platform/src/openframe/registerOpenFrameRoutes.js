const registerLegacyServiceRoutes = require("./legacyServiceRoutes");
const registerStorageRoutes = require("./storageRoutes");
const registerControlPlaneRoutes = require("./controlPlaneRoutes");
const registerWorkspaceRoutes = require("./workspaceRoutes");
const { getAuthContext } = require("../shared/tenantAccess");

module.exports = function registerOpenFrameRoutes(app, deps) {
  app.use("/api/services", (req, res, next) => {
    const authContext = getAuthContext(req);
    const requestedFirmId = req.headers["x-firm-id"] || null;

    if (!authContext.isPlatformAdmin && requestedFirmId && authContext.firmId && requestedFirmId !== authContext.firmId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    req.firmId = authContext.isPlatformAdmin
      ? (requestedFirmId || authContext.firmId || null)
      : (authContext.firmId || requestedFirmId || null);

    if (!req.firmId && req.path !== "/urls" && req.path !== "/catalog" && req.path !== "/status" && req.path !== "/diagnose") {
      console.warn(`[service-proxy] Request to ${req.path} without X-Firm-Id header`);
    }
    next();
  });

  registerLegacyServiceRoutes(app, deps);
  registerStorageRoutes(app, deps);
  registerControlPlaneRoutes(app, deps);
  registerWorkspaceRoutes(app, deps);
};
