const crypto = require("crypto");
const { hashOpaqueToken, extractPlatformTokenFromRequest } = require("../shared/platformSession");
const emitRuntimeEvent = require("../shared/emitRuntimeEvent");

module.exports = function registerAuthRoutes(app, deps) {
  const {
    prisma,
    bcryptAvailable,
    issuePlatformSession,
    isPlatformAdminEmail,
    resolvePlatformSessionFromRequest,
  } = deps;

  const resetTokens = new Map();

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const member = await prisma.teamMember.findFirst({
        where: { email },
        include: { firm: true },
      });

      if (!member) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (bcryptAvailable && member.passwordHash) {
        const bcrypt = require("bcryptjs");
        const valid = await bcrypt.compare(password, member.passwordHash);
        if (!valid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      const { rawToken, session } = await issuePlatformSession(member);

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
    resetTokens.set(token, { email, expires: Date.now() + 3600000 });

    console.log(`Password reset token for ${email}: ${token}`);
    console.log(`Reset URL: https://app.maxed.life/reset-password?token=${token}`);

    emitRuntimeEvent({
      type: "auth.password_reset_requested",
      source: "maxed-auth",
      firmId: member.firmId,
      actorId: member.id,
      detail: { email: member.email },
    });

    return res.json({
      ok: true,
      message: "If an account exists, a reset link has been generated.",
      token,
    });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ error: "Token and new password required" });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const entry = resetTokens.get(token);
    if (!entry || entry.expires < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.teamMember.updateMany({
      where: { email: entry.email },
      data: { passwordHash },
    });

    resetTokens.delete(token);

    emitRuntimeEvent({
      type: "auth.password_reset_completed",
      source: "maxed-auth",
      actorId: null,
      detail: { email: entry.email },
    });

    return res.json({
      ok: true,
      message: "Password has been reset. You can now log in.",
    });
  });
};
