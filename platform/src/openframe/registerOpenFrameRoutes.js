const registerLegacyServiceRoutes = require("./legacyServiceRoutes");
const registerStorageRoutes = require("./storageRoutes");
const registerControlPlaneRoutes = require("./controlPlaneRoutes");
const registerWorkspaceRoutes = require("./workspaceRoutes");

module.exports = function registerOpenFrameRoutes(app, deps) {
  registerLegacyServiceRoutes(app, deps);
  registerStorageRoutes(app, deps);
  registerControlPlaneRoutes(app, deps);
  registerWorkspaceRoutes(app, deps);
};
