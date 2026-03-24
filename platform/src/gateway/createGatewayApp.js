const createServiceApp = require("../shared/createServiceApp");
const proxyRequest = require("../shared/proxyRequest");
const emitRuntimeEvent = require("../shared/emitRuntimeEvent");
const { prisma } = require("../shared/platformData");
const { createPlatformSessionHelpers } = require("../shared/platformSession");
const { getInternalServiceBaseUrl } = require("../shared/runtimeConfig");

const { resolvePlatformSessionFromRequest } = createPlatformSessionHelpers({ prisma });

function isPublicGatewayPath(req) {
  return (
    req.path === "/api/auth/login" ||
    req.path === "/api/auth/forgot-password" ||
    req.path === "/api/auth/reset-password" ||
    req.path === "/api/register" ||
    req.path === "/api/clients/login"
  );
}

function resolveGatewayTarget(pathname) {
  if (pathname.startsWith("/api/auth") || pathname === "/api/clients/login") {
    return "auth";
  }
  if (pathname.startsWith("/api/config")) {
    return "config";
  }
  if (pathname.startsWith("/api/stream")) {
    return "stream";
  }
  if (pathname.startsWith("/api/external")) {
    return "externalApi";
  }
  if (pathname.startsWith("/bridge/")) {
    return "externalApi";
  }
  return "api";
}

module.exports = function createGatewayApp({ readinessCheck = null } = {}) {
  const app = createServiceApp({
    serviceName: "maxed-gateway",
    publicPaths: [
      isPublicGatewayPath,
    ],
    readinessCheck,
  });

  app.use(async (req, res, next) => {
    if (req.path === "/health") {
      return next();
    }

    if (req.path.startsWith("/api") && !isPublicGatewayPath(req)) {
      const session = await resolvePlatformSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      req.platformSession = session;
      req.gatewayIdentityHeaders = {
        "x-maxed-session-id": session.id,
        "x-maxed-user-id": session.teamMemberId,
        "x-maxed-firm-id": session.firmId || "",
        "x-maxed-role": session.role || "",
        "x-maxed-platform-admin": session.isPlatformAdmin ? "true" : "false",
      };
    }

    return next();
  });

  app.all(["/api/*", "/bridge/*"], async (req, res) => {
    const targetRole = resolveGatewayTarget(req.path);

    emitRuntimeEvent({
      type: "gateway.request",
      source: "maxed-gateway",
      firmId: req.platformSession?.firmId || null,
      actorId: req.platformSession?.teamMemberId || null,
      detail: {
        method: req.method,
        path: req.originalUrl,
        targetRole,
      },
    });

    return proxyRequest(req, res, {
      targetBaseUrl: getInternalServiceBaseUrl(targetRole),
      extraHeaders: {
        ...req.gatewayIdentityHeaders,
      },
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      status: "ok",
      service: "maxed-gateway",
      routes: {
        auth: "/api/auth/*",
        api: "/api/*",
        external: "/api/external/*",
        stream: "/api/stream/*",
        config: "/api/config/*",
        bridge: "/bridge/:service",
      },
    });
  });

  return app;
};
