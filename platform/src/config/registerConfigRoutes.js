const {
  MAXED_SERVICE_PORTS,
  getGatewayPublicUrl,
  getInternalServiceBaseUrl,
} = require("../shared/runtimeConfig");

module.exports = function registerConfigRoutes(app, deps) {
  const {
    SERVICES,
    PUBLIC_SERVICES,
    SERVICE_CATALOG,
    SERVICE_WORKSPACE_PATHS,
    SERVICE_ACCESS_CAPABILITIES,
  } = deps;

  app.get("/api/config/runtime", (_req, res) => {
    res.json({
      gatewayPublicUrl: getGatewayPublicUrl(),
      internalServices: {
        gateway: getInternalServiceBaseUrl("gateway"),
        auth: getInternalServiceBaseUrl("auth"),
        api: getInternalServiceBaseUrl("api"),
        externalApi: getInternalServiceBaseUrl("externalApi"),
        stream: getInternalServiceBaseUrl("stream"),
        config: getInternalServiceBaseUrl("config"),
      },
      ports: MAXED_SERVICE_PORTS,
    });
  });

  app.get("/api/config/services", (_req, res) => {
    res.json({
      services: SERVICES,
      publicServices: PUBLIC_SERVICES,
      catalog: SERVICE_CATALOG,
      workspacePaths: SERVICE_WORKSPACE_PATHS,
      accessCapabilities: SERVICE_ACCESS_CAPABILITIES,
    });
  });

  app.get("/api/config/openframe", (_req, res) => {
    res.json({
      deployables: [
        "maxed-gateway",
        "maxed-auth",
        "maxed-api",
        "maxed-external-api",
        "maxed-stream",
        "maxed-config",
      ],
      boundary: {
        browserFacing: "maxed-gateway",
        authentication: "maxed-auth",
        internalApi: "maxed-api",
        publicExternal: "maxed-external-api",
        streaming: "maxed-stream",
        configuration: "maxed-config",
      },
    });
  });
};
