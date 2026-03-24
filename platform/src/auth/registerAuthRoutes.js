const crypto = require("crypto");
const {
  hashOpaqueToken,
  extractPlatformTokenFromRequest,
  resolveCookieDomain,
  buildPlatformSessionCookie,
  buildClearedPlatformSessionCookie,
} = require("../shared/platformSession");
const emitRuntimeEvent = require("../shared/emitRuntimeEvent");

function applySessionCookie(req, res, token, expiresAt) {
  const domain = resolveCookieDomain(req.headers.host);
  const secure =
    String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https" ||
    process.env.NODE_ENV === "production";

  res.setHeader("Set-Cookie", buildPlatformSessionCookie(token, {
    expiresAt,
    domain,
    secure,
    sameSite: secure ? "None" : "Lax",
  }));
}

function clearSessionCookie(req, res) {
  const domain = resolveCookieDomain(req.headers.host);
  const secure =
    String(req.headers["x-forwarded-proto"] || "").toLowerCase() === "https" ||
    process.env.NODE_ENV === "production";

  res.setHeader("Set-Cookie", buildClearedPlatformSessionCookie({
    domain,
    secure,
    sameSite: secure ? "None" : "Lax",
  }));
}

module.exports = function registerAuthRoutes(app, deps) {
  const {
    prisma,
    bcryptAvailable,
    issuePlatformSession,
    isPlatformAdminEmail,
    resolvePlatformSessionFromRequest,
  } = deps;

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const envAdminEmail = String(process.env.SERVICE_ADMIN_EMAIL || "").trim().toLowerCase();
      const envAdminPassword = String(process.env.SERVICE_ADMIN_PASSWORD || "");

      const member = await prisma.teamMember.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
        include: { firm: true },
      });

      if (!member) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const allowEnvAdminPassword =
        !!envAdminPassword &&
        normalizedEmail === envAdminEmail &&
        isPlatformAdminEmail(normalizedEmail) &&
        password === envAdminPassword;

      if (!allowEnvAdminPassword && bcryptAvailable && member.passwordHash) {
        const bcrypt = require("bcryptjs");
        const valid = await bcrypt.compare(password, member.passwordHash);
        if (!valid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      const { rawToken, session } = await issuePlatformSession(member);
      applySessionCookie(req, res, rawToken, session.expiresAt);

      emitRuntimeEvent({
        type: "auth.login",
        source: "maxed-auth",
        firmId: member.firmId,
        actorId: member.id,
        detail: { email: member.email },
      });

      return res.json({
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
        firmId: member.firmId,
        firmName: member.firm.name,
        isPlatformAdmin: isPlatformAdminEmail(member.email),
        platformSessionToken: rawToken,
        platformSessionExpiresAt: session.expiresAt,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const session = await resolvePlatformSessionFromRequest(req);
      if (!session) {
        return res.status(401).json({ error: "Platform session invalid" });
      }

      return res.json({
        sessionId: session.id,
        firmId: session.firmId,
        teamMemberId: session.teamMemberId,
        role: session.role,
        isPlatformAdmin: session.isPlatformAdmin,
        expiresAt: session.expiresAt,
        user: {
          id: session.teamMember.id,
          name: session.teamMember.name,
          email: session.teamMember.email,
          role: session.teamMember.role,
        },
        firm: {
          id: session.teamMember.firm.id,
          name: session.teamMember.firm.name,
          email: session.teamMember.firm.email,
        },
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const rawToken = extractPlatformTokenFromRequest(req);
      if (!rawToken) {
        clearSessionCookie(req, res);
        return res.json({ ok: true });
      }

      await prisma.platformSession.deleteMany({
        where: { tokenHash: hashOpaqueToken(rawToken) },
      });

      emitRuntimeEvent({
        type: "auth.logout",
        source: "maxed-auth",
        firmId: req.platformSession?.firmId || null,
        actorId: req.platformSession?.teamMemberId || null,
      });

      clearSessionCookie(req, res);
      return res.json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clients/login", async (req, res) => {
    try {
      const { email, accessCode } = req.body;
      if (!email || !accessCode) {
        return res.status(400).json({ error: "Email and access code required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const normalizedCode = String(accessCode).trim().toUpperCase();
      const portalCredential = await prisma.serviceCredential.findFirst({
        where: {
          service: "clientportal",
          token: normalizedCode,
        },
        include: { firm: true },
      });

      if (!portalCredential?.firm) {
        return res.status(401).json({ error: "Invalid email or access code" });
      }

      let client = await prisma.client.findFirst({
        where: {
          firmId: portalCredential.firmId,
          email: normalizedEmail,
        },
        include: { firm: true },
      });

      if (!client) {
        const inferredName = normalizedEmail
          .split("@")[0]
          .replace(/[._-]+/g, " ")
          .replace(/\b\w/g, (match) => match.toUpperCase());

        client = await prisma.client.create({
          data: {
            firmId: portalCredential.firmId,
            email: normalizedEmail,
            name: inferredName || normalizedEmail,
          },
          include: { firm: true },
        });
      }

      return res.json({
        clientId: client.id,
        name: client.name,
        email: client.email,
        firmId: client.firmId,
        firmName: client.firm?.name || null,
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const member = await prisma.teamMember.findFirst({ where: { email } });
    if (!member) {
      return res.json({ ok: true, message: "If an account exists, a reset link has been generated." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashOpaqueToken(token);
    const expiresAt = new Date(Date.now() + 3600000);

    await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { teamMemberId: member.id },
          { expiresAt: { lt: new Date() } },
        ],
      },
    });

    await prisma.passwordResetToken.create({
      data: {
        tokenHash,
        teamMemberId: member.id,
        expiresAt,
      },
    });

    if (process.env.EXPOSE_PASSWORD_RESET_TOKENS === "true" || process.env.NODE_ENV !== "production") {
      console.log(`Password reset token for ${email}: ${token}`);
      console.log(`Reset URL: https://app.maxed.life/reset-password?token=${token}`);
    } else {
      console.log(`Password reset requested for ${email}`);
    }

    emitRuntimeEvent({
      type: "auth.password_reset_requested",
      source: "maxed-auth",
      firmId: member.firmId,
      actorId: member.id,
      detail: { email: member.email },
    });

    const payload = {
      ok: true,
      message: "If an account exists, a reset link has been generated.",
    };

    if (process.env.EXPOSE_PASSWORD_RESET_TOKENS === "true" || process.env.NODE_ENV !== "production") {
      payload.token = token;
    }

    return res.json(payload);
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const tokenHash = hashOpaqueToken(token);
    const entry = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { teamMember: true },
    });

    if (!entry || entry.consumedAt || entry.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.$transaction([
      prisma.teamMember.update({
        where: { id: entry.teamMemberId },
        data: { passwordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: entry.id },
        data: { consumedAt: new Date() },
      }),
      prisma.passwordResetToken.deleteMany({
        where: {
          teamMemberId: entry.teamMemberId,
          id: { not: entry.id },
        },
      }),
    ]);

    emitRuntimeEvent({
      type: "auth.password_reset_completed",
      source: "maxed-auth",
      actorId: entry.teamMemberId,
      detail: { email: entry.teamMember.email },
    });

    return res.json({
      ok: true,
      message: "Password has been reset. You can now log in.",
    });
  });
};
