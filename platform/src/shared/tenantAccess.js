function getAuthContext(req) {
  return req.authContext || {
    firmId: req.headers["x-maxed-firm-id"] || req.platformSession?.firmId || null,
    userId: req.headers["x-maxed-user-id"] || req.platformSession?.teamMemberId || null,
    role: req.headers["x-maxed-role"] || req.platformSession?.role || null,
    isPlatformAdmin:
      req.headers["x-maxed-platform-admin"] === "true" ||
      Boolean(req.platformSession?.isPlatformAdmin),
    isService: false,
  };
}

function attachAuthContext(req, _res, next) {
  req.authContext = getAuthContext(req);
  next();
}

function canAccessFirm(req, firmId) {
  const authContext = getAuthContext(req);
  if (authContext.isService || authContext.isPlatformAdmin) return true;
  return Boolean(authContext.firmId && firmId && authContext.firmId === firmId);
}

function requireFirmScope(targetFirmIdResolver) {
  return function enforceFirmScope(req, res, next) {
    const firmId = typeof targetFirmIdResolver === "function"
      ? targetFirmIdResolver(req)
      : req.params?.[targetFirmIdResolver];

    if (!firmId || canAccessFirm(req, firmId)) {
      return next();
    }

    return res.status(403).json({ error: "Forbidden" });
  };
}

function requirePlatformAdmin(req, res, next) {
  const authContext = getAuthContext(req);
  if (authContext.isService || authContext.isPlatformAdmin) {
    return next();
  }
  return res.status(403).json({ error: "Forbidden" });
}

function requireClientScope(prisma) {
  return async function enforceClientScope(req, res, next) {
    const clientId = req.params?.clientId;
    if (!clientId) return next();

    const authContext = getAuthContext(req);
    if (authContext.isService || authContext.isPlatformAdmin) {
      return next();
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { firmId: true },
    });

    if (!client) {
      return res.status(404).json({ error: "Client not found" });
    }

    if (client.firmId !== authContext.firmId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
}

module.exports = {
  getAuthContext,
  attachAuthContext,
  canAccessFirm,
  requireFirmScope,
  requirePlatformAdmin,
  requireClientScope,
};
