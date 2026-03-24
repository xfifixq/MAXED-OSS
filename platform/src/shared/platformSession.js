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
  return (
    req.headers["x-maxed-session"] ||
    req.headers["x-platform-session"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
    null
  );
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

    return next();
  };
}

module.exports = {
  DEFAULT_PLATFORM_SESSION_TTL_MS,
  generateOpaqueToken,
  hashOpaqueToken,
  isPlatformAdminEmail,
  extractPlatformTokenFromRequest,
  createPlatformSessionHelpers,
  createRequireAuth,
};
