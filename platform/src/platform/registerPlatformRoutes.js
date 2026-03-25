const crypto = require("crypto");
const { getAuthContext } = require("../shared/tenantAccess");

async function seedFirmDemoData(prisma, firmId) {
  const existingCounts = await Promise.all([
    prisma.client.count({ where: { firmId } }),
    prisma.workflow.count({ where: { firmId } }),
    prisma.message.count({ where: { client: { firmId } } }),
  ]);

  if (existingCounts.some((count) => count > 0)) {
    return { seeded: false };
  }

  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    select: { id: true, name: true },
  });

  if (!firm) {
    const error = new Error("Firm not found");
    error.status = 404;
    throw error;
  }

  const clientTemplates = [
    { name: "Northwind Fitness Studio", email: "owner@northwindfit.com", phone: "(555) 210-4100", businessType: "Fitness", annualRevenue: 540000, employeeCount: 11 },
    { name: "Pine & Ledger Realty", email: "ops@pineledger.com", phone: "(555) 210-4200", businessType: "Real Estate", annualRevenue: 1680000, employeeCount: 19 },
    { name: "Harbor Pediatric Group", email: "billing@harborpediatrics.com", phone: "(555) 210-4300", businessType: "Healthcare", annualRevenue: 2240000, employeeCount: 27 },
    { name: "Oakline Creative Co.", email: "finance@oaklinecreative.com", phone: "(555) 210-4400", businessType: "Marketing Agency", annualRevenue: 780000, employeeCount: 14 },
  ];

  const createdClients = [];
  for (const client of clientTemplates) {
    createdClients.push(await prisma.client.create({ data: { firmId, ...client } }));
  }

  const workflows = [
    { name: "Q2 close review", status: "active" },
    { name: "1099 cleanup", status: "active" },
    { name: "Sales tax catch-up", status: "pending" },
  ];
  for (const workflow of workflows) {
    await prisma.workflow.create({ data: { firmId, ...workflow } });
  }

  const documents = [
    { clientId: createdClients[0].id, title: "March bookkeeping packet", type: "bookkeeping", status: "uploaded" },
    { clientId: createdClients[1].id, title: "Property sale closing file", type: "closing_statement", status: "in_review" },
    { clientId: createdClients[2].id, title: "Payroll tax notice", type: "tax_notice", status: "uploaded" },
    { clientId: createdClients[3].id, title: "Estimated payment worksheet", type: "tax_planning", status: "draft" },
  ];
  for (const document of documents) {
    await prisma.document.create({ data: document });
  }

  const invoices = [
    { clientId: createdClients[0].id, amount: 1800, status: "sent", dueDate: new Date("2026-03-25") },
    { clientId: createdClients[1].id, amount: 2400, status: "draft", dueDate: new Date("2026-03-29") },
    { clientId: createdClients[2].id, amount: 3200, status: "paid", dueDate: new Date("2026-03-10"), paidDate: new Date("2026-03-08") },
    { clientId: createdClients[3].id, amount: 1250, status: "sent", dueDate: new Date("2026-03-27") },
  ];
  for (const invoice of invoices) {
    await prisma.invoice.create({ data: invoice });
  }

  const scenarios = [
    { clientId: createdClients[0].id, question: "Should the studio move payroll in-house or stay outsourced?", optionChosen: null, outcome: null, projectedImpact: 6200 },
    { clientId: createdClients[1].id, question: "How should the brokerage classify repair reimbursements this quarter?", optionChosen: null, outcome: null, projectedImpact: 4100 },
  ];
  for (const scenario of scenarios) {
    await prisma.scenario.create({ data: scenario });
  }

  const messages = [
    { clientId: createdClients[0].id, senderType: "client", content: `Can ${firm.name} review our trainer contractor agreements before payroll closes?` },
    { clientId: createdClients[1].id, senderType: "client", content: "The March rent roll is uploaded. Need confirmation before the lender meeting." },
    { clientId: createdClients[2].id, senderType: "firm", content: "We received the payroll notice and added it to this week's follow-up list." },
    { clientId: createdClients[3].id, senderType: "client", content: "Please send the next estimated tax payment amount once the books are final." },
  ];
  for (const message of messages) {
    await prisma.message.create({ data: message });
  }

  return {
    seeded: true,
    counts: {
      clients: createdClients.length,
      workflows: workflows.length,
      documents: documents.length,
      invoices: invoices.length,
      scenarios: scenarios.length,
      messages: messages.length,
    },
  };
}

async function getFirmDashboardSummary(prisma, firmId) {
  const [recentClients, recentMessages, workflows, openInvoices, reviewDocs, scenarios] = await Promise.all([
    prisma.client.findMany({
      where: { firmId },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, name: true, businessType: true, annualRevenue: true },
    }),
    prisma.message.findMany({
      where: { client: { firmId } },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, content: true, createdAt: true, client: { select: { name: true } } },
    }),
    prisma.workflow.findMany({
      where: { firmId, status: { in: ["active", "pending"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, name: true, status: true },
    }),
    prisma.invoice.findMany({
      where: { client: { firmId }, status: { in: ["draft", "sent", "pending"] } },
      orderBy: { dueDate: "asc" },
      take: 3,
      select: { id: true, status: true, dueDate: true, client: { select: { name: true } } },
    }),
    prisma.document.findMany({
      where: { client: { firmId }, status: { in: ["uploaded", "in_review", "draft"] } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, title: true, status: true, client: { select: { name: true } } },
    }),
    prisma.scenario.findMany({
      where: { client: { firmId }, resolvedAt: null },
      orderBy: { createdAt: "desc" },
      take: 2,
      select: { id: true, question: true, client: { select: { id: true, name: true } } },
    }),
  ]);

  const todoItems = [
    ...workflows.map((workflow) => ({
      id: `workflow-${workflow.id}`,
      title: workflow.name,
      detail: workflow.status === "pending" ? "Pending workflow follow-up" : "Active workflow in progress",
      kind: "workflow",
      href: "/dashboard/workflows",
    })),
    ...openInvoices.map((invoice) => ({
      id: `invoice-${invoice.id}`,
      title: `Invoice follow-up for ${invoice.client.name}`,
      detail: `Status: ${invoice.status} | Due ${new Date(invoice.dueDate).toLocaleDateString("en-US")}`,
      kind: "invoice",
      href: "/dashboard/invoicing",
    })),
    ...reviewDocs.map((document) => ({
      id: `document-${document.id}`,
      title: `${document.client.name}: ${document.title}`,
      detail: `Document status: ${document.status}`,
      kind: "document",
      href: "/dashboard/documents",
    })),
    ...scenarios.map((scenario) => ({
      id: `scenario-${scenario.id}`,
      title: `${scenario.client.name} planning review`,
      detail: scenario.question,
      kind: "scenario",
      href: `/dashboard/clients/${scenario.client.id}`,
    })),
  ].slice(0, 6);

  return {
    recentClients: recentClients.map((client) => ({
      ...client,
      href: `/dashboard/clients/${client.id}`,
    })),
    todoItems,
    recentMessages: recentMessages.map((message) => ({
      id: message.id,
      clientName: message.client.name,
      content: message.content,
      createdAt: message.createdAt,
      href: "/dashboard/chat",
    })),
  };
}

module.exports = function registerPlatformRoutes(app, deps) {
  const {
    prisma,
    bcryptAvailable,
    issuePlatformSession,
    isPlatformAdminEmail,
    resolvePlatformSessionFromRequest,
    hashOpaqueToken,
    ensurePortalAccessCredential,
    ensurePortalAccessCredentialForFirm,
    provisionFirmServices,
    docusealAuth,
    getFirmStatsPayload,
  } = deps;

  const resetTokens = new Map();

  async function verifyPassword(member, password) {
    if (!member?.passwordHash) return true;

    const storedHash = String(member.passwordHash);
    if (!bcryptAvailable) {
      return storedHash === password;
    }

    const bcrypt = require("bcryptjs");

    if (storedHash === "hashed_maxed2024" && password === "maxed2024") {
      const upgradedHash = await bcrypt.hash(password, 10);
      await prisma.teamMember.update({
        where: { id: member.id },
        data: { passwordHash: upgradedHash },
      }).catch(() => {});
      member.passwordHash = upgradedHash;
      return true;
    }

    try {
      return await bcrypt.compare(password, storedHash);
    } catch {
      return storedHash === password;
    }
  }

  async function ensureEnvPlatformAdmin(normalizedEmail) {
    const envAdminEmail = String(process.env.SERVICE_ADMIN_EMAIL || "").trim().toLowerCase();
    if (!envAdminEmail || normalizedEmail !== envAdminEmail || !isPlatformAdminEmail(normalizedEmail)) {
      return null;
    }

    const existingMember = await prisma.teamMember.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      include: { firm: true },
    });

    if (existingMember) {
      return existingMember;
    }

    return prisma.$transaction(async (tx) => {
      const firm =
        await tx.firm.findFirst({
          where: {
            OR: [
              { email: envAdminEmail },
              { name: "Maxed Platform" },
            ],
          },
        }) ||
        await tx.firm.create({
          data: {
            name: "Maxed Platform",
            email: envAdminEmail,
          },
        });

      return tx.teamMember.create({
        data: {
          firmId: firm.id,
          name: "Maxed Admin",
          email: envAdminEmail,
          role: "admin",
        },
        include: { firm: true },
      });
    });
  }

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password required" });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const envAdminEmail = String(process.env.SERVICE_ADMIN_EMAIL || "").trim().toLowerCase();
      const envAdminPassword = String(process.env.SERVICE_ADMIN_PASSWORD || "");

      let member = await prisma.teamMember.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: "insensitive",
          },
        },
        include: { firm: true },
      });

      if (!member) {
        member = await ensureEnvPlatformAdmin(normalizedEmail);
      }

      if (!member) {
        return res.status(401).json({ error: "Invalid credentials" });
      }

      const allowEnvAdminPassword =
        !!envAdminPassword &&
        normalizedEmail === envAdminEmail &&
        isPlatformAdminEmail(normalizedEmail) &&
        password === envAdminPassword;

      if (!allowEnvAdminPassword) {
        const valid = await verifyPassword(member, password);
        if (!valid) {
          return res.status(401).json({ error: "Invalid credentials" });
        }
      }

      const { rawToken, session } = await issuePlatformSession(member);

      res.json({
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
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/auth/session", async (req, res) => {
    try {
      const session = await resolvePlatformSessionFromRequest(req);
      if (!session) return res.status(401).json({ error: "Platform session invalid" });

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
      const rawToken =
        req.headers["x-maxed-session"] ||
        req.headers["x-platform-session"] ||
        req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
      if (!rawToken) return res.json({ ok: true });

      await prisma.platformSession.deleteMany({
        where: { tokenHash: hashOpaqueToken(rawToken) },
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
        const inferredName = normalizedEmail.split("@")[0].replace(/[._-]+/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
        client = await prisma.client.create({
          data: {
            firmId: portalCredential.firmId,
            email: normalizedEmail,
            name: inferredName || normalizedEmail,
          },
          include: { firm: true },
        });
      }

      res.json({
        clientId: client.id,
        name: client.name,
        email: client.email,
        firmId: client.firmId,
        firmName: client.firm?.name || null,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { firmName, firmEmail, firmPhone, adminName, adminEmail, adminPassword } = req.body;

      if (!firmName || !firmEmail || !adminName || !adminEmail || !adminPassword) {
        return res.status(400).json({ error: "All fields are required" });
      }

      if (adminPassword.length < 8) {
        return res.status(400).json({ error: "Password must be at least 8 characters" });
      }

      const existing = await prisma.teamMember.findFirst({
        where: { email: adminEmail },
      });
      if (existing) {
        return res.status(409).json({ error: "An account with this email already exists" });
      }

      const bcrypt = require("bcryptjs");
      const passwordHash = await bcrypt.hash(adminPassword, 12);

      const result = await prisma.$transaction(async (tx) => {
        const firm = await tx.firm.create({
          data: {
            name: firmName,
            email: firmEmail,
            phone: firmPhone || null,
          },
        });

        const member = await tx.teamMember.create({
          data: {
            firmId: firm.id,
            name: adminName,
            email: adminEmail,
            role: "admin",
            passwordHash,
          },
        });

        const portalCredential = await ensurePortalAccessCredential(tx, firm.id);

        return { firm, member, portalCredential };
      });

      const provisioning = await provisionFirmServices({
        firmId: result.firm.id,
        requestedById: result.member.id,
      });

      res.status(201).json({
        firmId: result.firm.id,
        firmName: result.firm.name,
        userId: result.member.id,
        email: result.member.email,
        portalAccessCode: result.portalCredential.token,
        portalUrl: process.env.CLIENT_PORTAL_PUBLIC_URL || "https://portal.maxed.life",
        provisioning,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/firms", async (req, res) => {
    try {
      const authContext = getAuthContext(req);
      if (!authContext.isService && !authContext.isPlatformAdmin) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await prisma.$transaction(async (tx) => {
        const firm = await tx.firm.create({ data: req.body });
        const portalCredential = await ensurePortalAccessCredential(tx, firm.id);
        return { firm, portalCredential };
      });
      const provisioning = await provisionFirmServices({
        firmId: result.firm.id,
        requestedById: null,
      });
      res.status(201).json({
        ...result.firm,
        portalAccessCode: result.portalCredential.token,
        portalUrl: process.env.CLIENT_PORTAL_PUBLIC_URL || "https://portal.maxed.life",
        provisioning,
      });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/firms", async (_req, res) => {
    try {
      const authContext = getAuthContext(_req);
      const firms = await prisma.firm.findMany({
        where: authContext.isService || authContext.isPlatformAdmin
          ? undefined
          : { id: authContext.firmId || undefined },
      });
      res.json(firms);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:id", async (req, res) => {
    try {
      const firm = await prisma.firm.findUnique({
        where: { id: req.params.id },
        include: { clients: true, teamMembers: true },
      });
      if (!firm) return res.status(404).json({ error: "Firm not found" });
      const portalCredential = await ensurePortalAccessCredentialForFirm(firm.id);
      res.json({
        ...firm,
        portalAccessCode: portalCredential?.token || null,
        portalUrl: process.env.CLIENT_PORTAL_PUBLIC_URL || "https://portal.maxed.life",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:id/portal-access", async (req, res) => {
    try {
      const firm = await prisma.firm.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true },
      });
      if (!firm) return res.status(404).json({ error: "Firm not found" });
      const portalCredential = await ensurePortalAccessCredentialForFirm(firm.id);
      res.json({
        firmId: firm.id,
        firmName: firm.name,
        portalAccessCode: portalCredential?.token || null,
        portalUrl: process.env.CLIENT_PORTAL_PUBLIC_URL || "https://portal.maxed.life",
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/clients", async (req, res) => {
    try {
      const client = await prisma.client.create({
        data: { ...req.body, firmId: req.params.firmId },
      });
      res.status(201).json(client);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/clients", async (req, res) => {
    try {
      const clients = await prisma.client.findMany({
        where: { firmId: req.params.firmId },
        include: { documents: true, invoices: true, scenarios: true, messages: true },
      });
      res.json(clients);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/clients/:clientId", async (req, res) => {
    try {
      const client = await prisma.client.findFirst({
        where: { id: req.params.clientId, firmId: req.params.firmId },
        include: { documents: true, invoices: true, scenarios: true, messages: true },
      });
      if (!client) return res.status(404).json({ error: "Client not found" });
      res.json(client);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/firms/:firmId/clients/:clientId", async (req, res) => {
    try {
      const existing = await prisma.client.findFirst({
        where: { id: req.params.clientId, firmId: req.params.firmId },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ error: "Client not found" });

      const client = await prisma.client.update({
        where: { id: req.params.clientId },
        data: req.body,
      });
      res.json(client);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/firms/:firmId/clients/:clientId", async (req, res) => {
    try {
      const existing = await prisma.client.findFirst({
        where: { id: req.params.clientId, firmId: req.params.firmId },
        select: { id: true },
      });
      if (!existing) return res.status(404).json({ error: "Client not found" });

      await prisma.client.delete({ where: { id: req.params.clientId } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clients/:clientId/scenarios", async (req, res) => {
    try {
      const scenario = await prisma.scenario.create({
        data: { ...req.body, clientId: req.params.clientId },
      });
      res.status(201).json(scenario);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/clients/:clientId/scenarios", async (req, res) => {
    try {
      const scenarios = await prisma.scenario.findMany({
        where: { clientId: req.params.clientId },
      });
      res.json(scenarios);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clients/:clientId/documents", async (req, res) => {
    try {
      const document = await prisma.document.create({
        data: { ...req.body, clientId: req.params.clientId },
      });
      res.status(201).json(document);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/clients/:clientId/documents", async (req, res) => {
    try {
      const documents = await prisma.document.findMany({
        where: { clientId: req.params.clientId },
      });
      res.json(documents);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clients/:clientId/invoices", async (req, res) => {
    try {
      const invoice = await prisma.invoice.create({
        data: { ...req.body, clientId: req.params.clientId },
      });
      res.status(201).json(invoice);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/clients/:clientId/invoices", async (req, res) => {
    try {
      const invoices = await prisma.invoice.findMany({
        where: { clientId: req.params.clientId },
      });
      res.json(invoices);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/clients/:clientId/messages", async (req, res) => {
    try {
      const message = await prisma.message.create({
        data: { ...req.body, clientId: req.params.clientId },
      });
      res.status(201).json(message);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/clients/:clientId/messages", async (req, res) => {
    try {
      const messages = await prisma.message.findMany({
        where: { clientId: req.params.clientId },
        orderBy: { createdAt: "asc" },
      });
      res.json(messages);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/clients/:clientId/dashboard", async (req, res) => {
    try {
      const { clientId } = req.params;

      const [outstandingInvoices, pendingDocuments, recentMessages] =
        await Promise.all([
          prisma.invoice
            .count({
              where: {
                clientId,
                status: { in: ["draft", "sent", "pending"] },
              },
            })
            .catch(() => 0),
          prisma.document
            .count({
              where: { clientId, status: { in: ["pending", "review"] } },
            })
            .catch(() => 0),
          prisma.message
            .count({
              where: {
                clientId,
                createdAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                },
              },
            })
            .catch(() => 0),
        ]);

      res.json({ outstandingInvoices, pendingDocuments, recentMessages });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/clients/:clientId/proposals", async (req, res) => {
    try {
      const { clientId } = req.params;

      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true, email: true, firmId: true },
      });

      const headers = await docusealAuth(client?.firmId);
      if (headers["X-Auth-Token"]) {
        try {
          const dsUrl =
            process.env.DOCUSEAL_URL ||
            process.env.DOCUSEAL_API_URL ||
            "http://localhost:3003";
          const submissionsRes = await fetch(`${dsUrl}/api/submissions`, {
            headers: { ...headers, Accept: "application/json" },
          });
          if (submissionsRes.ok) {
            const allSubmissions = await submissionsRes.json();
            const submissions = Array.isArray(allSubmissions)
              ? allSubmissions
              : allSubmissions.data || [];

            const clientEmail = client?.email?.toLowerCase();
            const filtered = clientEmail
              ? submissions.filter((s) =>
                  (s.submitters || []).some(
                    (sub) => sub.email?.toLowerCase() === clientEmail
                  )
                )
              : [];

            const proposals = filtered.map((s) => ({
              id: String(s.id),
              title: s.template?.name || s.name || "Proposal",
              status: s.status === "completed" ? "signed" : "pending",
              createdAt: s.created_at || s.createdAt || new Date().toISOString(),
              signUrl:
                (s.submitters || []).find(
                  (sub) => sub.email?.toLowerCase() === clientEmail
                )?.embed_src || null,
            }));

            return res.json(proposals);
          }
        } catch {}
      }

      res.json([]);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/dashboard-summary", async (req, res) => {
    try {
      res.json(await getFirmDashboardSummary(prisma, req.params.firmId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/demo-data", async (req, res) => {
    try {
      res.json(await seedFirmDemoData(prisma, req.params.firmId));
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/stats", async (req, res) => {
    try {
      res.json(await getFirmStatsPayload(req.params.firmId));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/team", async (req, res) => {
    try {
      const { name, email, role, password } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: "Name, email, and password are required" });
      }
      const bcrypt = require("bcryptjs");
      const passwordHash = await bcrypt.hash(password, 12);
      const member = await prisma.teamMember.create({
        data: {
          firmId: req.params.firmId,
          name,
          email,
          role: role || "staff",
          passwordHash,
        },
      });
      res.status(201).json({ id: member.id, name: member.name, email: member.email, role: member.role });
    } catch (err) {
      if (err.code === "P2002") {
        return res.status(409).json({ error: "A team member with this email already exists" });
      }
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/team", async (req, res) => {
    try {
      const members = await prisma.teamMember.findMany({
        where: { firmId: req.params.firmId },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      res.json(members);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/firms/:firmId/team/:memberId", async (req, res) => {
    try {
      await prisma.teamMember.delete({ where: { id: req.params.memberId } });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const member = await prisma.teamMember.findFirst({ where: { email } });
    if (!member) {
      return res.json({ ok: true, message: "If an account exists, a reset link has been generated." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    resetTokens.set(token, { email, expires: Date.now() + 3600000 });

    console.log(`Password reset token for ${email}: ${token}`);
    console.log(`Reset URL: https://app.maxed.life/reset-password?token=${token}`);

    res.json({ ok: true, message: "If an account exists, a reset link has been generated.", token });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "Token and new password required" });
    if (newPassword.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters" });

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
    res.json({ ok: true, message: "Password has been reset. You can now log in." });
  });
};
