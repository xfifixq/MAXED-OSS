const registerLegacyServiceRoutes = require("./legacyServiceRoutes");
const registerStorageRoutes = require("./storageRoutes");
const registerControlPlaneRoutes = require("./controlPlaneRoutes");
const registerWorkspaceRoutes = require("./workspaceRoutes");

module.exports = function registerOpenFrameRoutes(app, deps) {
  app.use("/api/services", (req, _res, next) => {
    req.firmId = req.headers["x-firm-id"] || null;
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
