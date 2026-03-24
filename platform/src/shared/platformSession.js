const crypto = require("crypto");

const DEFAULT_PLATFORM_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashOpaqueToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function isPlatformAdminEmail(email) {
  return email === "admin@maxed.dev" || email === "admin@maxed.life";
}

function extractPlatformTokenFromRequest(req) {
  const cookieToken = parseCookieHeader(req.headers.cookie || "").maxed_session || null;

  return (
    req.headers["x-maxed-session"] ||
    req.headers["x-platform-session"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    cookieToken ||
    null
  );
}

function parseCookieHeader(value) {
  return String(value || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) return acc;
      const key = decodeURIComponent(part.slice(0, eqIndex).trim());
      const val = decodeURIComponent(part.slice(eqIndex + 1).trim());
      acc[key] = val;
      return acc;
    }, {});
}

function resolveCookieDomain(hostname) {
  const host = String(hostname || "").split(":")[0].toLowerCase();
  if (!host || host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return undefined;
  }
  if (host === "maxed.life" || host.endsWith(".maxed.life")) {
    return ".maxed.life";
  }
  return undefined;
}

function buildPlatformSessionCookie(token, options = {}) {
  const {
    maxAgeSeconds = 30 * 24 * 60 * 60,
    expiresAt = null,
    domain,
    secure = true,
    httpOnly = true,
    sameSite = "Lax",
  } = options;

  const parts = [
    `maxed_session=${encodeURIComponent(token || "")}`,
    "Path=/",
    httpOnly ? "HttpOnly" : "",
    secure ? "Secure" : "",
    `SameSite=${sameSite}`,
    typeof maxAgeSeconds === "number" ? `Max-Age=${maxAgeSeconds}` : "",
    domain ? `Domain=${domain}` : "",
    expiresAt ? `Expires=${new Date(expiresAt).toUTCString()}` : "",
  ].filter(Boolean);

  return parts.join("; ");
}

function buildClearedPlatformSessionCookie(options = {}) {
  return buildPlatformSessionCookie("", {
    ...options,
    maxAgeSeconds: 0,
    expiresAt: new Date(0),
  });
}

function createPlatformSessionHelpers({
  prisma,
  ttlMs = DEFAULT_PLATFORM_SESSION_TTL_MS,
}) {
  async function issuePlatformSession(member) {
    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashOpaqueToken(rawToken);
    const session = await prisma.platformSession.create({
      data: {
        tokenHash,
        teamMemberId: member.id,
        firmId: member.firmId,
        role: member.role,
        isPlatformAdmin: isPlatformAdminEmail(member.email),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return {
      rawToken,
      session,
    };
  }

  async function resolvePlatformSession(rawToken) {
    if (!rawToken) return null;
    const tokenHash = hashOpaqueToken(rawToken);
    const session = await prisma.platformSession.findUnique({
      where: { tokenHash },
      include: {
        teamMember: {
          include: { firm: true },
        },
      },
    });

    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) return null;

    await prisma.platformSession.update({
      where: { id: session.id },
      data: { lastSeenAt: new Date() },
    }).catch(() => {});

    return session;
  }

  async function resolvePlatformSessionFromRequest(req) {
    const headerToken = extractPlatformTokenFromRequest(req);
    if (!headerToken) return null;
    return resolvePlatformSession(headerToken);
  }

  return {
    issuePlatformSession,
    resolvePlatformSession,
    resolvePlatformSessionFromRequest,
  };
}

function createRequireAuth({
  apiKey = "",
  resolvePlatformSessionFromRequest,
}) {
  return async function requireAuth(req, res, next) {
    if (!apiKey) {
      const platformSession = await resolvePlatformSessionFromRequest(req);
      if (platformSession) {
        req.platformSession = platformSession;
      }
      return next();
    }

    const platformSession = await resolvePlatformSessionFromRequest(req);
    if (platformSession) {
      req.platformSession = platformSession;
      return next();
    }

    const key =
      req.headers["x-api-key"] ||
      req.headers["authorization"]?.replace("Bearer ", "");

    if (key !== apiKey) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.authContext = {
      isService: true,
      isPlatformAdmin: true,
      firmId: req.headers["x-firm-id"] || null,
      userId: null,
      role: "service",
    };

    return next();
  };
}

module.exports = {
  DEFAULT_PLATFORM_SESSION_TTL_MS,
  generateOpaqueToken,
  hashOpaqueToken,
  isPlatformAdminEmail,
  extractPlatformTokenFromRequest,
  parseCookieHeader,
  resolveCookieDomain,
  buildPlatformSessionCookie,
  buildClearedPlatformSessionCookie,
  createPlatformSessionHelpers,
  createRequireAuth,
};
