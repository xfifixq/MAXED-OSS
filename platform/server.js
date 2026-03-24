require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const registerOpenFrameRoutes = require("./src/openframe/registerOpenFrameRoutes");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;
const PLATFORM_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BROKER_SESSION_TTL_MS = 15 * 60 * 1000;
const LOCAL_STORAGE_ROOT = path.resolve(process.env.LOCAL_STORAGE_ROOT || path.join(__dirname, "storage"));

// ---------------------------------------------------------------------------
// Production Security
// ---------------------------------------------------------------------------
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
    : ["https://app.maxed.life", "https://portal.maxed.life", "http://localhost:3005", "http://localhost:3006"],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// Rate limiting: 200 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later" },
});
app.use("/api", limiter);

// ---------------------------------------------------------------------------
// Supabase client (optional — used when SUPABASE_URL is configured)
// ---------------------------------------------------------------------------
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  console.log("Supabase client initialized");
}

// Expose supabase status on health check
app.get("/api/supabase/status", (_req, res) => {
  res.json({ connected: !!supabase });
});

// ---------------------------------------------------------------------------
// API Key Authentication Middleware
// ---------------------------------------------------------------------------
const API_KEY = process.env.MAXED_API_KEY || "";

async function requireAuth(req, res, next) {
  // Skip auth in development if no key is configured
  if (!API_KEY) return next();

  const platformSession = await resolvePlatformSessionFromRequest(req);
  if (platformSession) {
    req.platformSession = platformSession;
    return next();
  }

  const key =
    req.headers["x-api-key"] ||
    req.headers["authorization"]?.replace("Bearer ", "");

  if (key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Apply auth to all /api routes except health and auth endpoints
app.use("/api", (req, res, next) => {
  if (req.path === "/auth/login" || req.path === "/auth/verify" || req.path === "/register" || req.path === "/auth/forgot-password" || req.path === "/auth/reset-password") {
    return next();
  }
  return requireAuth(req, res, next);
});

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", platform: "Maxed OpenCPA", version: "0.1.0" });
});

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------
const bcryptAvailable = (() => {
  try { require("bcryptjs"); return true; } catch { return false; }
})();

function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("hex");
}

function hashOpaqueToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function isPlatformAdminEmail(email) {
  return email === "admin@maxed.dev" || email === "admin@maxed.life";
}

function resolveCookieDomain(host) {
  const hostname = String(host || "").split(":")[0].toLowerCase();
  if (!hostname || hostname === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) {
    return undefined;
  }
  if (hostname === "maxed.life" || hostname.endsWith(".maxed.life")) {
    return ".maxed.life";
  }
  return undefined;
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || "";
  for (const part of cookieHeader.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) {
      return decodeURIComponent(rest.join("="));
    }
  }
  return "";
}

function isSecureRequest(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "").toLowerCase();
  return forwardedProto.includes("https") || process.env.NODE_ENV === "production";
}

function setPlatformSessionCookie(req, res, token) {
  const secure = isSecureRequest(req);
  res.cookie("maxed_session", token, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    domain: resolveCookieDomain(req.headers.host),
    maxAge: PLATFORM_SESSION_TTL_MS,
  });
}

function clearPlatformSessionCookie(req, res) {
  const secure = isSecureRequest(req);
  res.cookie("maxed_session", "", {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/",
    domain: resolveCookieDomain(req.headers.host),
    expires: new Date(0),
    maxAge: 0,
  });
}

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
      expiresAt: new Date(Date.now() + PLATFORM_SESSION_TTL_MS),
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
  const headerToken =
    req.headers["x-maxed-session"] ||
    req.headers["x-platform-session"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  const cookieToken = readCookie(req, "maxed_session");

  if (!headerToken && !cookieToken) return null;
  return resolvePlatformSession(headerToken || cookieToken);
}

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

    // Check password hash if bcryptjs is available
    if (bcryptAvailable && member.passwordHash) {
      const bcrypt = require("bcryptjs");
      const valid = await bcrypt.compare(password, member.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
    }

    const { rawToken, session } = await issuePlatformSession(member);
    setPlatformSessionCookie(req, res, rawToken);

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
      req.headers["authorization"]?.replace(/^Bearer\s+/i, "") ||
      readCookie(req, "maxed_session");

    clearPlatformSessionCookie(req, res);
    if (!rawToken) return res.json({ ok: true });

    await prisma.platformSession.deleteMany({
      where: { tokenHash: hashOpaqueToken(rawToken) },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Client portal login
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

// ---------------------------------------------------------------------------
// Registration — Create firm + admin user in one step
// ---------------------------------------------------------------------------
app.post("/api/register", async (req, res) => {
  try {
    const { firmName, firmEmail, firmPhone, adminName, adminEmail, adminPassword } = req.body;

    if (!firmName || !firmEmail || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (adminPassword.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    // Check if email already exists
    const existing = await prisma.teamMember.findFirst({
      where: { email: adminEmail },
    });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const bcrypt = require("bcryptjs");
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Create firm + admin in a transaction
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

// ---------------------------------------------------------------------------
// Firms
// ---------------------------------------------------------------------------
app.post("/api/firms", async (req, res) => {
  try {
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
    const firms = await prisma.firm.findMany();
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

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Client Portal – Dashboard Summary
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Client Portal – Proposals (DocuSeal submissions for client)
// ---------------------------------------------------------------------------
app.get("/api/clients/:clientId/proposals", async (req, res) => {
  try {
    const { clientId } = req.params;

    // Try to get the client to find their email and firmId for matching submissions
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true, email: true, firmId: true },
    });

    // Try fetching submissions from DocuSeal
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

          // Filter by client email if available
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
      } catch {
        // DocuSeal unavailable, fall through
      }
    }

    // Fallback: return empty array
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

async function seedFirmDemoData(firmId) {
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

async function getFirmDashboardSummary(firmId) {
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

// ---------------------------------------------------------------------------
// Firm Stats
// ---------------------------------------------------------------------------
app.get("/api/firms/:firmId/dashboard-summary", async (req, res) => {
  try {
    res.json(await getFirmDashboardSummary(req.params.firmId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/firms/:firmId/demo-data", async (req, res) => {
  try {
    res.json(await seedFirmDemoData(req.params.firmId));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

async function getFirmStatsPayload(firmId) {
  const clients = await prisma.client.findMany({
    where: { firmId },
    select: { id: true, annualRevenue: true },
  });

  const clientIds = clients.map((c) => c.id);

  const [docCount, invoiceCount, scenarioCount, workflowCount] = await Promise.all([
    prisma.document.count({ where: { clientId: { in: clientIds } } }),
    prisma.invoice.count({ where: { clientId: { in: clientIds } } }),
    prisma.scenario.count({ where: { clientId: { in: clientIds } } }),
    prisma.workflow.count({ where: { firmId, status: { in: ["active", "pending"] } } }),
  ]);

  const pendingInvoices = await prisma.invoice.count({
    where: { clientId: { in: clientIds }, status: { in: ["draft", "sent", "pending"] } },
  });

  const totalRevenue = clients.reduce(
    (sum, c) => sum + (c.annualRevenue || 0),
    0
  );

  return {
    totalClients: clients.length,
    activeWorkflows: workflowCount,
    pendingInvoices,
    upcomingDeadlines: scenarioCount,
    clientCount: clients.length,
    docCount,
    invoiceCount,
    scenarioCount,
    totalRevenue,
  };
}

app.get("/api/firms/:firmId/stats", async (req, res) => {
  try {
    res.json(await getFirmStatsPayload(req.params.firmId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Service proxy configuration
// ---------------------------------------------------------------------------
const SERVICES = {
  paperless: process.env.PAPERLESS_URL || "http://localhost:8000",
  docuseal: process.env.DOCUSEAL_URL || "http://localhost:3003",
  invoiceninja: process.env.INVOICE_NINJA_URL || "http://localhost:8080",
  n8n: process.env.N8N_URL || "http://localhost:5678",
  kimai: process.env.KIMAI_URL || "http://localhost:8001",
  mattermost: process.env.MATTERMOST_URL || "http://localhost:8065",
  metabase: process.env.METABASE_URL || "http://localhost:3002",
  twenty: process.env.TWENTY_URL || "http://localhost:3004",
  bigcapital: process.env.BIGCAPITAL_URL || "http://localhost:3000",
};

const PUBLIC_SERVICES = {
  paperless: process.env.PAPERLESS_PUBLIC_URL || "https://docs.maxed.life",
  docuseal: process.env.DOCUSEAL_PUBLIC_URL || "https://sign.maxed.life",
  invoiceninja: process.env.INVOICE_NINJA_PUBLIC_URL || "https://billing.maxed.life",
  n8n: process.env.N8N_PUBLIC_URL || "https://flow.maxed.life",
  kimai: process.env.KIMAI_PUBLIC_URL || "https://time.maxed.life",
  bigcapital: process.env.BIGCAPITAL_PUBLIC_URL || "https://books.maxed.life",
  twenty: process.env.TWENTY_PUBLIC_URL || "https://crm.maxed.life",
  metabase: process.env.METABASE_PUBLIC_URL || "https://reports.maxed.life",
  mattermost: process.env.MATTERMOST_PUBLIC_URL || "https://chat.maxed.life",
};

const SERVICE_CATALOG = {
  paperless: {
    key: "paperless",
    name: "Paperless",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "firm_credentials",
    isolationNote: "Separate firm credentials exist, but this still runs inside a shared Paperless instance.",
    preferredAction: "signin_or_admin",
    setupPath: "",
    adminPath: "",
    note: "Paperless can stay embedded once firm credentials exist.",
  },
  docuseal: {
    key: "docuseal",
    name: "DocuSeal",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "firm_credentials",
    isolationNote: "Separate firm credentials and tokens exist, but DocuSeal still sits behind one shared Maxed deployment.",
    preferredAction: "signin_or_admin",
    setupPath: "",
    adminPath: "",
    note: "DocuSeal remains embedded when the workspace is already initialized.",
  },
  invoiceninja: {
    key: "invoiceninja",
    name: "Invoice Ninja",
    provisioningMode: "bootstrap_then_admin",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "shared_instance_admin_managed",
    isolationNote: "CPA staff users can be separate, but Invoice Ninja still needs strong company-level admin discipline inside one shared instance.",
    preferredAction: "setup_then_user_management",
    setupPath: "/setup",
    adminPath: "/#/settings/user_management",
    note: "Invoice Ninja needs first-run setup before CPA staff users can be created from User Management.",
  },
  n8n: {
    key: "n8n",
    name: "n8n",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: false,
    isolationTier: "admin_backend_only",
    isolationNote: "n8n should stay a Maxed backend automation surface, not a CPA-facing shared workspace.",
    preferredAction: "setup_owner_then_api_key",
    setupPath: "/setup",
    adminPath: "",
    note: "n8n exposes an owner setup flow on fresh instances and can stay embedded for that workflow.",
  },
  kimai: {
    key: "kimai",
    name: "Kimai",
    provisioningMode: "bootstrap_then_admin",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "shared_instance_admin_managed",
    isolationNote: "Kimai users can be separate per firm, but it still operates inside one shared instance and needs admin oversight.",
    preferredAction: "first_admin_then_users",
    setupPath: "",
    adminPath: "/en/admin/user/",
    note: "Kimai may require a first super-admin from bootstrap or CLI before normal user provisioning works.",
  },
  mattermost: {
    key: "mattermost",
    name: "Mattermost",
    provisioningMode: "config_or_signup",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "shared_instance_team_scoped",
    isolationNote: "Mattermost should be treated as team-scoped inside one shared server, not as a fully isolated per-firm tenant.",
    preferredAction: "enable_signup_or_admin_create",
    setupPath: "/signup_email",
    adminPath: "/admin_console/user_management/users",
    note: "Mattermost public signup depends on server-wide account creation settings.",
  },
  metabase: {
    key: "metabase",
    name: "Metabase",
    provisioningMode: "bootstrap_then_admin",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "admin_backend_only",
    isolationNote: "Metabase should stay a reporting backend and admin surface. Do not treat the upstream UI as a CPA tenant boundary.",
    preferredAction: "setup_then_invite",
    setupPath: "/setup",
    adminPath: "/admin/people",
    note: "Metabase requires the first admin during setup, and only after that can firm users be invited.",
  },
  twenty: {
    key: "twenty",
    name: "Twenty CRM",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: false,
    isolationTier: "workspace_scoped",
    isolationNote: "Twenty is closer to a real workspace boundary, but Maxed should still own the CPA-facing experience.",
    preferredAction: "signup",
    setupPath: "/sign-up",
    adminPath: "",
    note: "Twenty remains embedded because its signup flow already behaves correctly in Maxed.",
  },
  bigcapital: {
    key: "bigcapital",
    name: "Bigcapital",
    provisioningMode: "embedded",
    controlPlaneManaged: true,
    core: true,
    isolationTier: "workspace_scoped",
    isolationNote: "Bigcapital is closer to a firm workspace boundary, but should still be treated as infrastructure behind Maxed.",
    preferredAction: "signup_or_admin",
    setupPath: "/auth/register",
    adminPath: "/admin/users",
    note: "Bigcapital keeps a direct signup flow through Maxed's embedded path.",
  },
};

const SERVICE_WORKSPACE_PATHS = {
  paperless: "/dashboard/documents",
  docuseal: "/dashboard/proposals",
  invoiceninja: "/dashboard/invoicing",
  n8n: "/dashboard/workflows",
  kimai: "/dashboard/time-tracking",
  bigcapital: "/dashboard/bookkeeping",
  twenty: "/dashboard/crm",
  metabase: "/dashboard/reporting",
  mattermost: "/dashboard/chat",
};

const SERVICE_ACCESS_CAPABILITIES = {
  paperless: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  docuseal: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  invoiceninja: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  n8n: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_owner_handoff",
  },
  kimai: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  bigcapital: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  twenty: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  metabase: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
  mattermost: {
    browserSessionBroker: false,
    cpaMode: "maxed_native_only",
    adminMode: "setup_and_exception_handoff",
  },
};

const SERVICE_PROVISIONING_ADAPTERS = {
  paperless: {
    key: "paperless",
    automatic: true,
    strategy: "maxed_managed_identity_seed",
    canBrokerBrowserSession: false,
  },
  docuseal: {
    key: "docuseal",
    automatic: true,
    strategy: "maxed_managed_identity_seed",
    canBrokerBrowserSession: false,
  },
  invoiceninja: {
    key: "invoiceninja",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
  n8n: {
    key: "n8n",
    automatic: true,
    strategy: "owner_then_api_key_seed",
    canBrokerBrowserSession: false,
  },
  kimai: {
    key: "kimai",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
  bigcapital: {
    key: "bigcapital",
    automatic: true,
    strategy: "workspace_identity_seed",
    canBrokerBrowserSession: false,
  },
  twenty: {
    key: "twenty",
    automatic: true,
    strategy: "workspace_identity_seed",
    canBrokerBrowserSession: false,
  },
  metabase: {
    key: "metabase",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
  mattermost: {
    key: "mattermost",
    automatic: true,
    strategy: "bootstrap_then_maxed_identity_seed",
    canBrokerBrowserSession: false,
  },
};

const SERVICE_DEFAULT_TOKENS = {
  paperless: "PAPERLESS_API_TOKEN",
  docuseal: "DOCUSEAL_API_TOKEN",
  n8n: "N8N_API_KEY",
  bigcapital: "BIGCAPITAL_API_TOKEN",
  twenty: "TWENTY_API_KEY",
};

function getPublicServiceUrl(service) {
  return PUBLIC_SERVICES[service] || null;
}

function buildPublicServiceUrl(service, path = "") {
  const baseUrl = getPublicServiceUrl(service);
  if (!baseUrl) return null;
  if (!path) return baseUrl;
  return `${String(baseUrl).replace(/\/$/, "")}${path}`;
}

function getMaxedWorkspaceUrl(service) {
  const workspacePath = SERVICE_WORKSPACE_PATHS[service] || "/dashboard";
  return `https://app.maxed.life${workspacePath}`;
}

function getServiceIdentityShape(serviceKey) {
  switch (serviceKey) {
    case "invoiceninja":
    case "kimai":
    case "metabase":
      return {
        accountType: "bootstrap_admin_then_cpa_user",
        bootstrapRequired: true,
        summary: "Shared admin bootstraps the workspace, then creates a dedicated CPA user.",
      };
    case "mattermost":
    case "bigcapital":
    case "twenty":
      return {
        accountType: "direct_cpa_user_or_admin_create",
        bootstrapRequired: false,
        summary: "CPA user can usually sign up directly, or be created by an admin using the same email identity.",
      };
    case "n8n":
      return {
        accountType: "workspace_owner_plus_api_key",
        bootstrapRequired: true,
        summary: "Owner bootstraps the workspace, then Maxed stores the API key used for automation.",
      };
    default:
      return {
        accountType: "admin_managed_cpa_user",
        bootstrapRequired: false,
        summary: "Admin creates or confirms the CPA user, then Maxed stores the resulting credentials.",
      };
  }
}

function buildCanonicalIdentity(firm, teamMembers = []) {
  const sortedMembers = [...teamMembers].sort((a, b) => {
    if (a.role === "admin" && b.role !== "admin") return -1;
    if (a.role !== "admin" && b.role === "admin") return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
  const primaryMember = sortedMembers.find((member) => member.role !== "admin") || sortedMembers[0] || null;
  const fallbackEmail = String(firm.email || "").trim().toLowerCase();
  const primaryEmail = primaryMember?.email || fallbackEmail || `${slugifyName(firm.name)}@maxed.local`;

  return {
    primaryMember: primaryMember
      ? {
          id: primaryMember.id,
          name: primaryMember.name,
          email: primaryMember.email,
          role: primaryMember.role,
        }
      : null,
    canonicalEmail: primaryEmail,
    canonicalUsername: primaryEmail.split("@")[0] || slugifyName(firm.name) || "firm",
    bootstrapRoleLabel: "Platform bootstrap admin",
    cpaRoleLabel: primaryMember?.role === "admin" ? "Firm admin user" : "Primary CPA user",
  };
}

function buildSuggestedServiceCredential(firm, identity, service) {
  const baseEmail = String(identity.canonicalEmail || firm.email || "").trim().toLowerCase();
  const emailParts = baseEmail.includes("@") ? baseEmail.split("@") : [slugifyName(firm.name), "maxed.local"];
  const localPart = emailParts[0] || slugifyName(firm.name) || "firm";
  const domainPart = emailParts[1] || "maxed.local";
  const slug = slugifyName(firm.name) || "firm";

  const defaults = {
    username: baseEmail || `${localPart}@${domainPart}`,
    password: generateStrongPassword(),
    token: "",
    metadata: "",
  };

  if (service === "mattermost") defaults.metadata = baseEmail || "";
  if (service === "bigcapital") defaults.metadata = slug;
  if (service === "n8n") defaults.username = baseEmail || `${slug}@${domainPart}`;

  return defaults;
}

async function ensureFirmServiceAccountPlan(firmId) {
  const firm = await prisma.firm.findUnique({
    where: { id: firmId },
    include: {
      teamMembers: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      },
    },
  });

  if (!firm) return null;

  const identity = buildCanonicalIdentity(firm, firm.teamMembers || []);
  const primaryMemberId = identity.primaryMember?.id || null;
  const plan = [];

  if (!supportsFirmServiceAccounts) {
    for (const service of Object.values(SERVICE_CATALOG)) {
      const shape = getServiceIdentityShape(service.key);
      const roles = shape.bootstrapRequired
        ? [
            {
              id: `synthetic:${firmId}:${service.key}:bootstrap_admin`,
              firmId,
              service: service.key,
              role: "bootstrap_admin",
              identifier: `bootstrap:${service.key}`,
              teamMemberId: null,
              status: "bootstrap_pending",
              notes: "Used only for first-run setup or user provisioning.",
            },
            {
              id: `synthetic:${firmId}:${service.key}:firm_user`,
              firmId,
              service: service.key,
              role: "firm_user",
              identifier: service.key === "n8n" ? "stored-api-key" : identity.canonicalEmail,
              teamMemberId: primaryMemberId,
              status: "planned",
              notes: "Canonical CPA-facing identity stored by Maxed.",
            },
          ]
        : [
            {
              id: `synthetic:${firmId}:${service.key}:firm_user`,
              firmId,
              service: service.key,
              role: "firm_user",
              identifier: service.key === "n8n" ? "stored-api-key" : identity.canonicalEmail,
              teamMemberId: primaryMemberId,
              status: "planned",
              notes: "Canonical CPA-facing identity stored by Maxed.",
            },
          ];
      plan.push(...roles);
    }

    return { firm, identity, plan };
  }

  for (const service of Object.values(SERVICE_CATALOG)) {
    const shape = getServiceIdentityShape(service.key);
    const roles = shape.bootstrapRequired
      ? [
          {
            role: "bootstrap_admin",
            identifier: `bootstrap:${service.key}`,
            teamMemberId: null,
            notes: "Used only for first-run setup or user provisioning.",
          },
          {
            role: "firm_user",
            identifier: service.key === "n8n" ? "stored-api-key" : identity.canonicalEmail,
            teamMemberId: primaryMemberId,
            notes: "Canonical CPA-facing identity stored by Maxed.",
          },
        ]
      : [
          {
            role: "firm_user",
            identifier: service.key === "n8n" ? "stored-api-key" : identity.canonicalEmail,
            teamMemberId: primaryMemberId,
            notes: "Canonical CPA-facing identity stored by Maxed.",
          },
        ];

    for (const entry of roles) {
      if (!supportsFirmServiceAccounts) {
        plan.push({
          id: `synthetic:${firmId}:${service.key}:${entry.role}`,
          firmId,
          service: service.key,
          role: entry.role,
          identifier: entry.identifier,
          teamMemberId: entry.teamMemberId,
          status: "planned",
          notes: entry.notes,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        continue;
      }

      const account = await prisma.firmServiceAccount.upsert({
        where: {
          firmId_service_role: {
            firmId,
            service: service.key,
            role: entry.role,
          },
        },
        update: {
          identifier: entry.identifier,
          teamMemberId: entry.teamMemberId,
          notes: entry.notes,
        },
        create: {
          firmId,
          service: service.key,
          role: entry.role,
          identifier: entry.identifier,
          teamMemberId: entry.teamMemberId,
          notes: entry.notes,
        },
      });
      plan.push(account);
    }
  }

  return { firm, identity, plan };
}

async function executeProvisioningRun({ firmId, service, requestedById = null }) {
  const planned = await ensureFirmServiceAccountPlan(firmId);
  if (!planned?.firm) {
    const error = new Error("Firm not found");
    error.status = 404;
    throw error;
  }
  if (!SERVICE_CATALOG[service]) {
    const error = new Error("Service not supported");
    error.status = 404;
    throw error;
  }

  const adapter = SERVICE_PROVISIONING_ADAPTERS[service] || {
    automatic: false,
    strategy: "manual",
    canBrokerBrowserSession: false,
  };
  const suggestion = buildSuggestedServiceCredential(planned.firm, planned.identity, service);
  const accounts = planned.plan.filter((entry) => entry.service === service);

  const run = supportsProvisioningRuns
    ? await prisma.serviceProvisioningRun.create({
        data: {
          firmId,
          service,
          mode: adapter.strategy,
          status: "running",
          requestedById,
          summary: `Preparing ${service} for Maxed-managed access.`,
        },
      })
    : {
        id: `synthetic:${firmId}:${service}:${Date.now()}`,
        firmId,
        service,
        mode: adapter.strategy,
        status: "running",
      };

  try {
    let credential;
    let output;

    if (service === "mattermost") {
      const provisioned = await provisionMattermostUser({
        firmId,
        firm: planned.firm,
        identity: planned.identity,
        suggestion,
      });
      credential = provisioned.credential;
      output = {
        adapter,
        credentialSeeded: {
          username: credential.username,
          metadata: credential.metadata,
          tokenPresent: !!credential.token,
        },
        upstreamProvisioning: provisioned.output,
        serviceAccounts: accounts.map((account) => ({
          role: account.role,
          status: account.role === "bootstrap_admin" ? "bootstrap_pending" : "verified",
        })),
      };
    } else if (service === "invoiceninja") {
      const provisioned = await provisionInvoiceNinjaUser({
        firmId,
        firm: planned.firm,
        identity: planned.identity,
        suggestion,
      });
      credential = provisioned.credential;
      output = {
        adapter,
        credentialSeeded: {
          username: credential.username,
          metadata: credential.metadata,
          tokenPresent: !!credential.token,
        },
        upstreamProvisioning: provisioned.output,
        serviceAccounts: accounts.map((account) => ({
          role: account.role,
          status: account.role === "bootstrap_admin" ? "bootstrap_pending" : "verified",
        })),
      };
    } else if (service === "metabase") {
      const provisioned = await provisionMetabaseUser({
        firmId,
        firm: planned.firm,
        identity: planned.identity,
        suggestion,
      });
      credential = provisioned.credential;
      output = {
        adapter,
        credentialSeeded: {
          username: credential.username,
          metadata: credential.metadata,
          tokenPresent: !!credential.token,
        },
        upstreamProvisioning: provisioned.output,
        serviceAccounts: accounts.map((account) => ({
          role: account.role,
          status: account.role === "bootstrap_admin" ? "bootstrap_pending" : "verified",
        })),
      };
    } else if (service === "kimai") {
      const provisioned = await provisionKimaiUser({
        firmId,
        firm: planned.firm,
        identity: planned.identity,
        suggestion,
      });
      credential = provisioned.credential;
      output = {
        adapter,
        credentialSeeded: {
          username: credential.username,
          metadata: credential.metadata,
          tokenPresent: !!credential.token,
        },
        upstreamProvisioning: provisioned.output,
        serviceAccounts: accounts.map((account) => ({
          role: account.role,
          status: account.role === "bootstrap_admin" ? "bootstrap_pending" : "verified",
        })),
      };
    } else {
      const provisioned = await provisionWorkspaceManagedService({
        firmId,
        service,
        identity: planned.identity,
        suggestion,
        accounts,
      });
      credential = provisioned.credential;
      output = {
        adapter,
        credentialSeeded: {
          username: credential.username,
          metadata: credential.metadata,
          tokenPresent: !!credential.token,
        },
        upstreamProvisioning: provisioned.output,
        serviceAccounts: accounts.map((account) => ({
          role: account.role,
          status: account.role === "bootstrap_admin" ? "bootstrap_pending" : "verified",
        })),
      };
    }

    const completed = supportsProvisioningRuns
      ? await prisma.serviceProvisioningRun.update({
          where: { id: run.id },
          data: {
            status: "completed",
            summary: `Maxed seeded service access for ${service}.`,
            outputJson: JSON.stringify(output),
          },
        })
      : {
          ...run,
          status: "completed",
          summary: `Maxed seeded service access for ${service}.`,
          outputJson: JSON.stringify(output),
        };

    return { run: completed, output };
  } catch (err) {
    if (supportsProvisioningRuns) {
      await prisma.serviceProvisioningRun.update({
        where: { id: run.id },
        data: {
          status: "failed",
          errorMessage: err.message || "Provisioning failed",
        },
      }).catch(() => {});
    }
    throw err;
  }
}

async function provisionFirmServices({ firmId, requestedById = null }) {
  const results = {};

  for (const service of Object.keys(SERVICE_CATALOG)) {
    try {
      const result = await executeProvisioningRun({
        firmId,
        service,
        requestedById,
      });
      const liveProbe = await probeServiceAccess(firmId, service);
      const verified = result.output?.provisioningVerified !== false && liveProbe.ok;
      results[service] = {
        ok: verified,
        runId: result.run.id,
        status: verified ? result.run.status : "partial",
        output: result.output,
        liveProbe,
      };
    } catch (err) {
      results[service] = {
        ok: false,
        status: err.status || 500,
        error: err.message,
      };
    }
  }

  return {
    total: Object.keys(results).length,
    succeeded: Object.values(results).filter((entry) => entry.ok).length,
    failed: Object.values(results).filter((entry) => !entry.ok).length,
    results,
  };
}

async function provisionWorkspaceManagedService({ firmId, service, identity, suggestion, accounts }) {
  const existing = await prisma.serviceCredential.findUnique({
    where: { firmId_service: { firmId, service } },
  });
  const tokenEnv = SERVICE_DEFAULT_TOKENS[service];
  const seededToken = tokenEnv ? process.env[tokenEnv] || "" : "";
  const metadata =
    service === "bigcapital"
      ? (process.env.BIGCAPITAL_TENANT_ID || suggestion.metadata || existing?.metadata || null)
      : (suggestion.metadata || existing?.metadata || null);

  const merged = mergeCredentialUpdate(existing, {
    username: suggestion.username,
    password: suggestion.password,
    token: existing?.token || seededToken,
    metadata,
  });

  const credential = await prisma.serviceCredential.upsert({
    where: { firmId_service: { firmId, service } },
    create: { firmId, service, ...merged },
    update: merged,
  });

  credentialCache.delete(`${firmId}:${service}`);

  if (supportsFirmServiceAccounts) {
    await Promise.all(accounts.map((account) =>
      prisma.firmServiceAccount.update({
        where: {
          firmId_service_role: {
            firmId,
            service,
            role: account.role,
          },
        },
        data: {
          identifier: account.role === "firm_user" ? suggestion.username || identity.canonicalEmail || account.identifier : account.identifier,
          status: account.role === "bootstrap_admin" ? "bootstrap_pending" : "verified",
          notes: account.role === "firm_user"
            ? "Provisioned by Maxed using workspace-managed credentials."
            : account.notes,
        },
      })
    ));
  }

  return {
    credential,
    output: {
      mode: "workspace_managed_seed",
      tokenSeeded: !!credential.token,
      brokerReady: false,
      canonicalIdentifier: suggestion.username || identity.canonicalEmail || null,
      provisioningVerified: true,
    },
  };
}

async function provisionMattermostUser({ firmId, firm, identity, suggestion }) {
  const adminToken = await getMattermostToken(null);
  if (!adminToken) {
    const error = new Error("Mattermost admin auth unavailable");
    error.status = 502;
    throw error;
  }

  const email = String(suggestion.username || identity.canonicalEmail || firm.email || "").trim().toLowerCase();
  if (!email) {
    const error = new Error("Mattermost provisioning requires a canonical email");
    error.status = 400;
    throw error;
  }

  let userId = null;
  try {
    const existing = await fetch(`${SERVICES.mattermost}/api/v4/users/email/${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (existing.ok) {
      const user = await existing.json();
      userId = user?.id || null;
    }
  } catch {}

  if (!userId) {
    const nameParts = String(identity.primaryMember?.name || firm.name || "CPA User").trim().split(/\s+/);
    const firstName = nameParts[0] || "CPA";
    const lastName = nameParts.slice(1).join(" ") || "User";
    const usernameBase = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 22) || `firm_${firmId.slice(0, 8)}`;

    const created = await fetch(`${SERVICES.mattermost}/api/v4/users`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        username: usernameBase,
        first_name: firstName,
        last_name: lastName,
        password: suggestion.password,
      }),
    });

    const createdData = await created.json().catch(() => null);
    if (!created.ok) {
      const error = new Error(
        createdData?.message || createdData?.error || "Mattermost user creation failed",
      );
      error.status = created.status;
      throw error;
    }
    userId = createdData?.id || null;
  }

  let teamId = null;
  try {
    const teamsRes = await fetch(`${SERVICES.mattermost}/api/v4/teams`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const teams = await teamsRes.json().catch(() => []);
    if (teamsRes.ok && Array.isArray(teams) && teams.length) {
      teamId = teams[0]?.id || null;
    }
  } catch {}

  if (teamId && userId) {
    await fetch(`${SERVICES.mattermost}/api/v4/teams/${teamId}/members`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        team_id: teamId,
        user_id: userId,
      }),
    }).catch(() => {});
  }

  const credential = await prisma.serviceCredential.upsert({
    where: { firmId_service: { firmId, service: "mattermost" } },
    create: {
      firmId,
      service: "mattermost",
      username: email,
      password: suggestion.password,
      metadata: teamId || null,
    },
    update: {
      username: email,
      password: suggestion.password,
      metadata: teamId || null,
    },
  });
  credentialCache.delete(`${firmId}:mattermost`);
  mattermostSessions.delete(firmId);

  if (supportsFirmServiceAccounts) {
    await prisma.firmServiceAccount.updateMany({
      where: { firmId, service: "mattermost", role: "firm_user" },
      data: {
        identifier: email,
        status: "verified",
        notes: teamId ? `Provisioned in team ${teamId}` : "Provisioned by Maxed via Mattermost API",
      },
    });
  }

  return {
    credential,
    output: {
      userId,
      email,
      teamId,
      brokerReady: false,
      provisioningVerified: Boolean(userId),
    },
  };
}

async function provisionMetabaseUser({ firmId, firm, identity, suggestion }) {
  const session = await getMetabaseSession(null);
  if (!session) {
    const error = new Error("Metabase admin session unavailable");
    error.status = 502;
    throw error;
  }

  const email = String(suggestion.username || identity.canonicalEmail || firm.email || "").trim().toLowerCase();
  if (!email) {
    const error = new Error("Metabase provisioning requires a canonical email");
    error.status = 400;
    throw error;
  }

  let userId = null;
  try {
    const existingRes = await fetch(`${SERVICES.metabase}/api/user/current`, {
      headers: { "X-Metabase-Session": session },
    });
    if (existingRes.status === 200) {
      // session valid, continue
    }
  } catch {}

  try {
    const usersRes = await fetch(`${SERVICES.metabase}/api/user`, {
      headers: { "X-Metabase-Session": session },
    });
    const users = await usersRes.json().catch(() => []);
    if (usersRes.ok && Array.isArray(users)) {
      const existing = users.find((user) => String(user?.email || "").toLowerCase() === email);
      if (existing) userId = existing.id || null;
    }
  } catch {}

  if (!userId) {
    const nameParts = String(identity.primaryMember?.name || firm.name || "CPA User").trim().split(/\s+/);
    const firstName = nameParts[0] || "CPA";
    const lastName = nameParts.slice(1).join(" ") || "User";

    const createRes = await fetch(`${SERVICES.metabase}/api/user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Metabase-Session": session,
      },
      body: JSON.stringify({
        first_name: firstName,
        last_name: lastName,
        email,
        password: suggestion.password,
        group_ids: [],
        login_attributes: {
          email,
        },
      }),
    });

    const createdData = await createRes.json().catch(() => null);
    if (!createRes.ok) {
      const message = String(
        createdData?.message || createdData?.errors?.email || "Metabase user creation failed",
      );

      if (/already in use/i.test(message)) {
        try {
          const usersRes = await fetch(`${SERVICES.metabase}/api/user`, {
            headers: { "X-Metabase-Session": session },
          });
          const users = await usersRes.json().catch(() => []);
          if (usersRes.ok && Array.isArray(users)) {
            const existing = users.find((user) => String(user?.email || "").toLowerCase() === email);
            if (existing?.id) {
              userId = existing.id;
            }
          }
        } catch {}
      }

      if (!userId) {
        const error = new Error(message);
        error.status = createRes.status;
        throw error;
      }
    }
    userId = userId || createdData?.id || null;
  }

  const credential = await prisma.serviceCredential.upsert({
    where: { firmId_service: { firmId, service: "metabase" } },
    create: {
      firmId,
      service: "metabase",
      username: email,
      password: suggestion.password,
    },
    update: {
      username: email,
      password: suggestion.password,
    },
  });
  credentialCache.delete(`${firmId}:metabase`);
  metabaseSessions.delete(firmId);

  if (supportsFirmServiceAccounts) {
    await prisma.firmServiceAccount.updateMany({
      where: { firmId, service: "metabase", role: "firm_user" },
      data: {
        identifier: email,
        status: "verified",
        notes: "Provisioned by Maxed via Metabase API",
      },
    });
  }

  return {
    credential,
    output: {
      userId,
      email,
      brokerReady: false,
      provisioningVerified: Boolean(userId),
    },
  };
}

async function provisionInvoiceNinjaUser({ firmId, firm, identity, suggestion }) {
  const adminHeaders = await invoiceNinjaAuth(null);
  if (!adminHeaders["X-API-TOKEN"]) {
    const error = new Error("Invoice Ninja admin API token unavailable");
    error.status = 502;
    throw error;
  }

  const email = String(suggestion.username || identity.canonicalEmail || firm.email || "").trim().toLowerCase();
  if (!email) {
    const error = new Error("Invoice Ninja provisioning requires a canonical email");
    error.status = 400;
    throw error;
  }

  const fullName = String(identity.primaryMember?.name || firm.name || "CPA User").trim();
  const [firstName, ...lastParts] = fullName.split(/\s+/).filter(Boolean);
  const lastName = lastParts.join(" ");

  let companyUserId = null;
  let userId = null;

  try {
    const usersRes = await fetch(`${SERVICES.invoiceninja}/api/v1/users?per_page=100`, {
      headers: adminHeaders,
    });
    const usersPayload = await usersRes.json().catch(() => null);
    const users = Array.isArray(usersPayload?.data) ? usersPayload.data : [];
    if (usersRes.ok) {
      const existing = users.find((user) => {
        const candidateEmail = String(user?.email || user?.user?.email || "").trim().toLowerCase();
        return candidateEmail === email;
      });
      if (existing) {
        companyUserId = existing?.id || null;
        userId = existing?.user?.id || existing?.user_id || existing?.id || null;
      }
    }
  } catch {}

  if (!companyUserId) {
    const createRes = await fetch(`${SERVICES.invoiceninja}/api/v1/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...adminHeaders,
      },
      body: JSON.stringify({
        first_name: firstName || "CPA",
        last_name: lastName || "User",
        email,
        password: suggestion.password,
      }),
    });

    const createdData = await createRes.json().catch(() => null);
    if (!createRes.ok) {
      const error = new Error(
        createdData?.message || createdData?.error || "Invoice Ninja user creation failed",
      );
      error.status = createRes.status;
      throw error;
    }

    const created = createdData?.data || createdData || {};
    companyUserId = created?.id || null;
    userId = created?.user?.id || created?.user_id || created?.id || null;
  }

  const credential = await prisma.serviceCredential.upsert({
    where: { firmId_service: { firmId, service: "invoiceninja" } },
    create: {
      firmId,
      service: "invoiceninja",
      username: email,
      password: suggestion.password,
    },
    update: {
      username: email,
      password: suggestion.password,
    },
  });
  credentialCache.delete(`${firmId}:invoiceninja`);
  invoiceNinjaSessions.delete(firmId);

  if (supportsFirmServiceAccounts) {
    await prisma.firmServiceAccount.updateMany({
      where: { firmId, service: "invoiceninja", role: "firm_user" },
      data: {
        identifier: email,
        status: "verified",
        notes: "Provisioned by Maxed via Invoice Ninja users API.",
      },
    });
  }

  return {
    credential,
    output: {
      companyUserId,
      userId,
      email,
      brokerReady: false,
      inviteAvailable: true,
      tokenMode: "password_only_with_admin_api_fallback",
      provisioningVerified: Boolean(companyUserId || userId),
    },
  };
}

async function provisionKimaiUser({ firmId, firm, identity, suggestion }) {
  const adminHeaders = await kimaiAuth(null);
  if (!adminHeaders["X-AUTH-TOKEN"] && !adminHeaders.Authorization) {
    const error = new Error("Kimai admin API auth unavailable");
    error.status = 502;
    throw error;
  }

  const email = String(suggestion.username || identity.canonicalEmail || firm.email || "").trim().toLowerCase();
  if (!email) {
    const error = new Error("Kimai provisioning requires a canonical email");
    error.status = 400;
    throw error;
  }

  const alias = String(identity.primaryMember?.name || firm.name || "CPA User").trim();
  const username = email.split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 32) || `firm_${firmId.slice(0, 8)}`;

  let userId = null;
  try {
    const usersRes = await fetch(`${SERVICES.kimai}/api/users`, {
      headers: adminHeaders,
    });
    const users = await usersRes.json().catch(() => []);
    if (usersRes.ok && Array.isArray(users)) {
      const existing = users.find((user) =>
        String(user?.email || "").toLowerCase() === email ||
        String(user?.username || "").toLowerCase() === username.toLowerCase(),
      );
      if (existing) userId = existing.id || null;
    }
  } catch {}

  if (!userId) {
    const createRes = await fetch(`${SERVICES.kimai}/api/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...adminHeaders,
      },
      body: JSON.stringify({
        username,
        email,
        alias,
        enabled: true,
        roles: ["ROLE_USER"],
        password: suggestion.password,
      }),
    });

    const createdData = await createRes.json().catch(() => null);
    if (!createRes.ok) {
      const error = new Error(
        createdData?.message || createdData?.error || "Kimai user creation failed",
      );
      error.status = createRes.status;
      throw error;
    }
    userId = createdData?.id || null;
  }

  const credential = await prisma.serviceCredential.upsert({
    where: { firmId_service: { firmId, service: "kimai" } },
    create: {
      firmId,
      service: "kimai",
      username: email,
      password: suggestion.password,
      token: null,
    },
    update: {
      username: email,
      password: suggestion.password,
      token: null,
    },
  });
  credentialCache.delete(`${firmId}:kimai`);

  if (supportsFirmServiceAccounts) {
    await prisma.firmServiceAccount.updateMany({
      where: { firmId, service: "kimai", role: "firm_user" },
      data: {
        identifier: email,
        status: "verified",
        notes: "Provisioned by Maxed via Kimai API; token may still require per-user generation.",
      },
    });
  }

  return {
    credential,
    output: {
      userId,
      email,
      username,
      brokerReady: false,
      tokenMode: credential.token ? "user_api_token" : "password_only_requires_user_token_or_admin_fallback",
      provisioningVerified: Boolean(userId),
    },
  };
}

function normalizeBridgeTarget(target) {
  if (typeof target !== "string" || !target.trim()) return "/";
  if (/^https?:\/\//i.test(target)) return "/";
  return target.startsWith("/") ? target : `/${target}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function bridgePage({ title, message, redirectUrl, autoRedirect = true }) {
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeRedirectUrl = escapeHtml(redirectUrl);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
    <style>
      body { margin: 0; font-family: Inter, Arial, sans-serif; background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%); color: #0f172a; }
      .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      .card { width: 100%; max-width: 520px; background: rgba(255,255,255,0.92); border: 1px solid rgba(148,163,184,0.2); border-radius: 28px; padding: 32px; box-shadow: 0 20px 50px rgba(15,23,42,0.08); }
      .eyebrow { font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: #64748b; margin-bottom: 12px; }
      h1 { margin: 0 0 12px; font-size: 26px; line-height: 1.1; }
      p { margin: 0 0 22px; color: #475569; line-height: 1.55; }
      a { display: inline-flex; align-items: center; justify-content: center; background: #0f172a; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 14px; font-weight: 600; }
      .spinner { width: 30px; height: 30px; border-radius: 999px; border: 3px solid #cbd5e1; border-top-color: #0f172a; animation: spin 1s linear infinite; margin-bottom: 18px; }
      @keyframes spin { to { transform: rotate(360deg); } }
    </style>
    ${autoRedirect ? `<meta http-equiv="refresh" content="1;url=${safeRedirectUrl}" />` : ""}
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="spinner"></div>
        <div class="eyebrow">Maxed Workspace</div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        <a href="${safeRedirectUrl}">Open Workspace</a>
      </div>
    </div>
    ${autoRedirect ? `<script>window.setTimeout(function(){ window.location.replace(${JSON.stringify(redirectUrl)}); }, 900);</script>` : ""}
  </body>
</html>`;
}

// Helper to proxy requests to external services
async function proxyFetch(serviceUrl, path, options = {}) {
  const url = `${serviceUrl}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

async function proxyFetchWithFallbacks(serviceUrl, paths, options = {}) {
  let lastResult = null;
  for (const path of paths) {
    const result = await proxyFetch(serviceUrl, path, options);
    lastResult = result;
    if (result.status !== 404) return result;
  }
  return lastResult || { status: 404, data: { error: "Not found" } };
}

function statusOk(status) {
  return typeof status === "number" && status >= 200 && status < 300;
}

// ---------------------------------------------------------------------------
// Per-firm service credential lookup (DB-first, env-var fallback)
// ---------------------------------------------------------------------------
const credentialCache = new Map();

function generatePortalAccessCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
}

function generateStrongPassword(length = 20) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i += 1) {
    password += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return password;
}

function slugifyName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

function normalizeCredentialField(value) {
  if (typeof value !== "string") return value ?? undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}

function mergeCredentialUpdate(existing, incoming) {
  return {
    token: incoming.token !== undefined ? incoming.token : existing?.token ?? null,
    username: incoming.username !== undefined ? incoming.username : existing?.username ?? null,
    password: incoming.password !== undefined ? incoming.password : existing?.password ?? null,
    metadata: incoming.metadata !== undefined ? incoming.metadata : existing?.metadata ?? null,
  };
}

async function getServiceCredential(firmId, service) {
  if (!firmId) return null;
  const cacheKey = `${firmId}:${service}`;
  const cached = credentialCache.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.cred;
  try {
    const cred = await prisma.serviceCredential.findUnique({
      where: { firmId_service: { firmId, service } },
    });
    credentialCache.set(cacheKey, { cred, expires: Date.now() + 300000 });
    return cred;
  } catch {
    return null;
  }
}

async function ensurePortalAccessCredential(tx, firmId) {
  const existing = await tx.serviceCredential.findUnique({
    where: { firmId_service: { firmId, service: "clientportal" } },
  });
  if (existing?.token) return existing;
  const credential = await tx.serviceCredential.upsert({
    where: { firmId_service: { firmId, service: "clientportal" } },
    create: {
      firmId,
      service: "clientportal",
      token: generatePortalAccessCode(),
    },
    update: {
      token: existing?.token || generatePortalAccessCode(),
    },
  });
  credentialCache.delete(`${firmId}:clientportal`);
  return credential;
}

async function ensurePortalAccessCredentialForFirm(firmId) {
  const existing = await getServiceCredential(firmId, "clientportal");
  if (existing?.token) return existing;
  const credential = await prisma.serviceCredential.upsert({
    where: { firmId_service: { firmId, service: "clientportal" } },
    create: {
      firmId,
      service: "clientportal",
      token: generatePortalAccessCode(),
    },
    update: {
      token: existing?.token || generatePortalAccessCode(),
    },
  });
  credentialCache.delete(`${firmId}:clientportal`);
  return credential;
}

// Extract firmId from X-Firm-Id header on all service proxy routes
app.use("/api/services", (req, _res, next) => {
  req.firmId = req.headers["x-firm-id"] || null;
  if (!req.firmId && req.path !== "/urls" && req.path !== "/catalog" && req.path !== "/status" && req.path !== "/diagnose") {
    console.warn(`[service-proxy] Request to ${req.path} without X-Firm-Id header`);
  }
  next();
});

// ---------------------------------------------------------------------------
// Service auth — looks up per-firm credentials, falls back to env vars
// ---------------------------------------------------------------------------
async function paperlessAuth(firmId) {
  const cred = await getServiceCredential(firmId, "paperless");
  if (cred?.token) return { Authorization: `Token ${cred.token}` };
  const token = process.env.PAPERLESS_API_TOKEN || null;
  return token ? { Authorization: `Token ${token}` } : {};
}

async function docusealAuth(firmId) {
  const cred = await getServiceCredential(firmId, "docuseal");
  if (cred?.token) return { "X-Auth-Token": cred.token, Authorization: `Bearer ${cred.token}` };
  const token = process.env.DOCUSEAL_API_TOKEN || null;
  return token ? { "X-Auth-Token": token, Authorization: `Bearer ${token}` } : {};
}

async function n8nAuth(firmId) {
  const cred = await getServiceCredential(firmId, "n8n");
  if (cred?.token) return { "X-N8N-API-KEY": cred.token };
  const token = process.env.N8N_API_KEY || null;
  return token ? { "X-N8N-API-KEY": token } : {};
}

async function kimaiAuth(firmId) {
  const cred = await getServiceCredential(firmId, "kimai");
  if (cred?.token) {
    return {
      Authorization: `Bearer ${cred.token}`,
      "X-AUTH-USER": cred.username || "admin@maxed.dev",
      "X-AUTH-TOKEN": cred.token,
    };
  }
  const token = process.env.KIMAI_API_TOKEN || null;
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
    "X-AUTH-USER": process.env.KIMAI_API_USER || process.env.KIMAI_ADMIN_EMAIL || "admin@maxed.dev",
    "X-AUTH-TOKEN": token,
  };
}

async function invoiceNinjaAuth(firmId) {
  const cred = await getServiceCredential(firmId, "invoiceninja");
  if (cred?.token) return { "X-API-TOKEN": cred.token, "X-Requested-With": "XMLHttpRequest" };

  if (cred?.username && cred?.password) {
    const token = await getInvoiceNinjaLoginToken(firmId, cred);
    if (token) {
      return { "X-API-TOKEN": token, "X-Requested-With": "XMLHttpRequest" };
    }
  }

  const token = process.env.INVOICE_NINJA_API_TOKEN || null;
  return token
    ? { "X-API-TOKEN": token, "X-Requested-With": "XMLHttpRequest" }
    : { "X-Requested-With": "XMLHttpRequest" };
}

function invoiceNinjaResourceId(payload) {
  return String(
    payload?.data?.id ||
    payload?.data?.client?.id ||
    payload?.data?.invoice?.id ||
    payload?.id ||
    ""
  );
}

async function ensureInvoiceNinjaClient(firmId, clientId) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
  });

  if (!client || client.firmId !== firmId) {
    const err = new Error("Client not found");
    err.status = 404;
    throw err;
  }

  if (client.invoiceNinjaId) {
    return { client, remoteClientId: client.invoiceNinjaId };
  }

  const [firstName, ...rest] = client.name.split(" ");
  const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/clients", {
    method: "POST",
    headers: await invoiceNinjaAuth(firmId),
    body: JSON.stringify({
      name: client.name,
      contacts: [
        {
          first_name: firstName || client.name,
          last_name: rest.join(" "),
          email: client.email,
          phone: client.phone || undefined,
          is_primary: true,
        },
      ],
    }),
  });

  if (result.status >= 400) {
    const err = new Error(result.data?.message || result.data?.error || "Invoice Ninja client sync failed");
    err.status = result.status;
    throw err;
  }

  const remoteClientId = invoiceNinjaResourceId(result.data);
  if (!remoteClientId) {
    const err = new Error("Invoice Ninja returned no client id");
    err.status = 502;
    throw err;
  }

  await prisma.client.update({
    where: { id: client.id },
    data: { invoiceNinjaId: remoteClientId },
  });

  return { client, remoteClientId };
}

async function bigcapitalAuth(firmId) {
  const cred = await getServiceCredential(firmId, "bigcapital");
  if (cred?.token) {
    const h = { Authorization: `Bearer ${cred.token}` };
    if (cred.metadata) {
      h["x-tenant-id"] = cred.metadata;
      h["organization-id"] = cred.metadata;
    }
    return h;
  }

  if (cred?.username && cred?.password) {
    const session = await getBigcapitalSession(firmId, cred);
    if (session?.token) {
      const headers = { Authorization: `Bearer ${session.token}` };
      const organizationId = session.organizationId || cred.metadata || null;
      if (organizationId) {
        headers["x-tenant-id"] = organizationId;
        headers["organization-id"] = organizationId;
      }
      return headers;
    }
  }

  const token = process.env.BIGCAPITAL_API_TOKEN || null;
  if (!token) {
    return {};
  }

  const headers = { Authorization: `Bearer ${token}` };
  const organizationId = process.env.BIGCAPITAL_ORGANIZATION_ID || process.env.BIGCAPITAL_TENANT_ID || null;
  if (organizationId) {
    headers["x-tenant-id"] = organizationId;
    headers["organization-id"] = organizationId;
  }
  return headers;
}

async function twentyAuth(firmId) {
  const cred = await getServiceCredential(firmId, "twenty");
  if (cred?.token) return { Authorization: `Bearer ${cred.token}` };
  const token = process.env.TWENTY_API_KEY || null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// Metabase & Mattermost: per-firm session caching
const metabaseSessions = new Map();
async function getMetabaseSession(firmId) {
  const cacheKey = firmId || "_global";
  const cached = metabaseSessions.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.session;

  const cred = await getServiceCredential(firmId, "metabase");
  const email = cred?.username || process.env.METABASE_EMAIL || process.env.SERVICE_ADMIN_EMAIL;
  const password = cred?.password || process.env.METABASE_PASSWORD || process.env.SERVICE_ADMIN_PASSWORD;
  if (!email || !password) return null;
  try {
    const r = await fetch(`${SERVICES.metabase}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });
    if (r.ok) {
      const data = await r.json();
      metabaseSessions.set(cacheKey, { session: data.id, expires: Date.now() + 12 * 3600000 });
      return data.id;
    }
  } catch {}
  return null;
}

const mattermostSessions = new Map();
const bigcapitalSessions = new Map();
const invoiceNinjaSessions = new Map();
const supportsFirmServiceAccounts = Boolean(prisma.firmServiceAccount);
const supportsProvisioningRuns = Boolean(prisma.serviceProvisioningRun);
const supportsBrokerSessions = Boolean(prisma.serviceBrokerSession);

function extractInvoiceNinjaToken(payload) {
  if (!payload || typeof payload !== "object") return null;

  return String(
    payload.token ||
    payload.api_token ||
    payload.data?.token ||
    payload.data?.api_token ||
    payload.data?.company_token?.token ||
    payload.data?.company_token?.name ||
    payload.data?.companyToken?.token ||
    payload.company_token?.token ||
    payload.companyToken?.token ||
    payload.user?.company_token?.token ||
    ""
  ).trim() || null;
}

async function getInvoiceNinjaLoginToken(firmId, credOverride = null) {
  const cacheKey = firmId || "_global";
  const cached = invoiceNinjaSessions.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.token;

  const cred = credOverride || await getServiceCredential(firmId, "invoiceninja");
  const email = cred?.username || null;
  const password = cred?.password || null;
  if (!email || !password) return null;

  const attempts = [
    { path: "/api/v1/login?include=token,company,user", body: { email, password } },
    { path: "/api/v1/login?include=token,company,user", body: { username: email, password } },
    { path: "/api/v1/login?include=token", body: { email, password } },
    { path: "/api/v1/login?include=token", body: { username: email, password } },
  ];

  for (const attempt of attempts) {
    try {
      const response = await fetch(`${SERVICES.invoiceninja}${attempt.path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify(attempt.body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) continue;

      const token = extractInvoiceNinjaToken(payload);
      if (!token) continue;

      invoiceNinjaSessions.set(cacheKey, {
        token,
        expires: Date.now() + 12 * 60 * 60 * 1000,
      });
      return token;
    } catch {}
  }

  return null;
}

function extractBigcapitalToken(payload) {
  if (!payload || typeof payload !== "object") return null;

  return String(
    payload.token ||
    payload.accessToken ||
    payload.access_token ||
    payload.jwt ||
    payload.data?.token ||
    payload.data?.accessToken ||
    payload.data?.access_token ||
    payload.data?.jwt ||
    payload.result?.token ||
    payload.result?.accessToken ||
    payload.result?.access_token ||
    payload.result?.jwt ||
    ""
  ).trim() || null;
}

function extractBigcapitalOrganizationId(payload) {
  if (!payload || typeof payload !== "object") return null;

  return String(
    payload.organizationId ||
    payload.organization_id ||
    payload.tenantId ||
    payload.tenant_id ||
    payload.data?.organizationId ||
    payload.data?.organization_id ||
    payload.data?.tenantId ||
    payload.data?.tenant_id ||
    payload.organization?.organizationId ||
    payload.organization?.organization_id ||
    payload.organization?.tenantId ||
    payload.organization?.tenant_id ||
    payload.data?.organization?.organizationId ||
    payload.data?.organization?.organization_id ||
    payload.data?.organization?.tenantId ||
    payload.data?.organization?.tenant_id ||
    ""
  ).trim() || null;
}

async function getBigcapitalSession(firmId, credOverride = null) {
  const cacheKey = firmId || "_global";
  const cached = bigcapitalSessions.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached;

  const cred = credOverride || await getServiceCredential(firmId, "bigcapital");
  const email = cred?.username || null;
  const password = cred?.password || null;
  if (!email || !password) return null;

  const loginAttempts = [
    { path: "/api/auth/login", body: { email, password } },
    { path: "/api/auth/login", body: { username: email, password } },
    { path: "/api/auth/signin", body: { email, password } },
    { path: "/api/auth/signin", body: { username: email, password } },
    { path: "/auth/login", body: { email, password } },
    { path: "/auth/login", body: { username: email, password } },
  ];

  for (const attempt of loginAttempts) {
    try {
      const response = await fetch(`${SERVICES.bigcapital}${attempt.path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attempt.body),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) continue;

      const token = extractBigcapitalToken(payload);
      if (!token) continue;

      let organizationId =
        extractBigcapitalOrganizationId(payload) ||
        cred?.metadata ||
        process.env.BIGCAPITAL_ORGANIZATION_ID ||
        process.env.BIGCAPITAL_TENANT_ID ||
        null;

      if (!organizationId) {
        try {
          const orgResponse = await fetch(`${SERVICES.bigcapital}/api/organization/current`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const orgPayload = await orgResponse.json().catch(() => null);
          if (orgResponse.ok) {
            organizationId = extractBigcapitalOrganizationId(orgPayload);
          }
        } catch {}
      }

      const session = {
        token,
        organizationId,
        expires: Date.now() + 12 * 60 * 60 * 1000,
      };
      bigcapitalSessions.set(cacheKey, session);
      return session;
    } catch {}
  }

  return null;
}

async function getMattermostToken(firmId) {
  const cacheKey = firmId || "_global";
  const cached = mattermostSessions.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.token;

  const cred = await getServiceCredential(firmId, "mattermost");
  const user = cred?.username || process.env.MATTERMOST_USER || process.env.MATTERMOST_ADMIN_USER;
  const pass = cred?.password || process.env.MATTERMOST_PASSWORD || process.env.SERVICE_ADMIN_PASSWORD;
  if (!user || !pass) return null;
  try {
    const r = await fetch(`${SERVICES.mattermost}/api/v4/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: user, password: pass }),
    });
    if (r.ok) {
      const tok = r.headers.get("token");
      mattermostSessions.set(cacheKey, { token: tok, expires: Date.now() + 12 * 3600000 });
      return tok;
    }
  } catch {}
  return null;
}

async function probeServiceAccess(firmId, service) {
  try {
    switch (service) {
      case "paperless": {
        const headers = await paperlessAuth(firmId);
        if (!headers.Authorization) return { ok: false, status: 401, reason: "credentials_missing" };
        const result = await proxyFetch(SERVICES.paperless, "/api/documents/?page=1&page_size=1", { headers });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "docuseal": {
        const headers = await docusealAuth(firmId);
        if (!headers.Authorization && !headers["X-Auth-Token"]) return { ok: false, status: 401, reason: "credentials_missing" };
        const result = await proxyFetch(SERVICES.docuseal, "/api/templates", { headers });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "invoiceninja": {
        const headers = await invoiceNinjaAuth(firmId);
        if (!headers["X-API-TOKEN"]) return { ok: false, status: 401, reason: "credentials_missing" };
        const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/clients?per_page=1", { headers });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "n8n": {
        const headers = await n8nAuth(firmId);
        if (!headers["X-N8N-API-KEY"]) return { ok: false, status: 401, reason: "credentials_missing" };
        const result = await proxyFetch(SERVICES.n8n, "/api/v1/workflows?limit=1", { headers });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "kimai": {
        const headers = await kimaiAuth(firmId);
        if (!headers["X-AUTH-TOKEN"] && !headers.Authorization) {
          return { ok: false, status: 401, reason: "credentials_missing" };
        }
        const result = await proxyFetch(SERVICES.kimai, "/api/customers", { headers });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "mattermost": {
        const token = await getMattermostToken(firmId);
        if (!token) return { ok: false, status: 401, reason: "credentials_missing" };
        const result = await proxyFetch(SERVICES.mattermost, "/api/v4/users/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "metabase": {
        const session = await getMetabaseSession(firmId);
        if (!session) return { ok: false, status: 401, reason: "credentials_missing" };
        const result = await proxyFetch(SERVICES.metabase, "/api/dashboard", {
          headers: { "X-Metabase-Session": session },
        });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "twenty": {
        const headers = await twentyAuth(firmId);
        if (!headers.Authorization) return { ok: false, status: 401, reason: "credentials_missing" };
        const result = await proxyFetch(SERVICES.twenty, "/api/companies", { headers });
        return {
          ok: statusOk(result.status),
          status: result.status,
          reason: statusOk(result.status) ? "connected" : "upstream_rejected",
        };
      }
      case "bigcapital": {
        const headers = await bigcapitalAuth(firmId);
        if (!headers.Authorization) return { ok: false, status: 401, reason: "credentials_missing" };

        const accounts = await proxyFetchWithFallbacks(SERVICES.bigcapital, ["/api/accounts", "/api/v1/accounts"], { headers });
        const balanceSheet = await proxyFetchWithFallbacks(
          SERVICES.bigcapital,
          [
            "/api/reports/balance-sheet",
            "/api/financial-statements/balance-sheet",
            "/api/v1/financial-statements/balance-sheet",
          ],
          { headers }
        );

        const ok = statusOk(accounts.status) && statusOk(balanceSheet.status);
        return {
          ok,
          status: ok ? 200 : (accounts.status >= 400 ? accounts.status : balanceSheet.status),
          reason: ok ? "connected" : "upstream_rejected",
          detail: {
            accounts: accounts.status,
            balanceSheet: balanceSheet.status,
          },
        };
      }
      default:
        return { ok: false, status: 404, reason: "service_not_supported" };
    }
  } catch (err) {
    return {
      ok: false,
      status: err.status || 502,
      reason: "probe_failed",
      detail: err.message,
    };
  }
}

function stringifyConnectorDetail(detail) {
  if (detail == null) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail === "number" || typeof detail === "boolean") return String(detail);
  if (typeof detail === "object") {
    return Object.entries(detail)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join(" · ");
  }
  return "";
}

function workspaceIssueFromResult(service, operation, result) {
  return {
    service,
    operation,
    status: result?.status || 500,
    reason:
      result?.data?.error ||
      result?.data?.message ||
      (result?.status === 404 ? "route_not_found" : "upstream_rejected"),
    detail: stringifyConnectorDetail(result?.data?.detail || result?.data),
  };
}

function workspaceIssueFromError(service, operation, err) {
  return {
    service,
    operation,
    status: err?.status || 502,
    reason: err?.message || "connector_failed",
    detail: stringifyConnectorDetail(err?.detail),
  };
}

async function buildServiceControlPlaneSnapshot(firmId, serviceKey) {
  const credential = await getServiceCredential(firmId, serviceKey);
  const configured = !!credential?.token || !!credential?.username || !!credential?.password;
  const liveProbe = await probeServiceAccess(firmId, serviceKey);

  return {
    key: serviceKey,
    name: SERVICE_CATALOG[serviceKey]?.name || serviceKey,
    workspacePath: SERVICE_WORKSPACE_PATHS[serviceKey] || "/dashboard",
    configured,
    source: configured ? "firm" : "none",
    health: !configured ? "disconnected" : liveProbe.ok ? "connected" : "degraded",
    liveProbe,
    access: SERVICE_ACCESS_CAPABILITIES[serviceKey] || null,
    provisioning: SERVICE_PROVISIONING_ADAPTERS[serviceKey] || null,
    identityShape: getServiceIdentityShape(serviceKey),
  };
}

async function getFirmClientsWorkspaceData(firmId) {
  return prisma.client.findMany({
    where: { firmId },
    include: { documents: true, invoices: true, scenarios: true, messages: true },
  });
}

async function loadBookkeepingWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "bigcapital");
  const [clients, headers] = await Promise.all([
    getFirmClientsWorkspaceData(firmId),
    bigcapitalAuth(firmId),
  ]);
  const issues = [];
  let accounts = null;
  let transactions = null;
  let balanceSheet = null;
  let profitLoss = null;

  if (workspace.configured && headers.Authorization) {
    try {
      const result = await proxyFetchWithFallbacks(SERVICES.bigcapital, ["/api/accounts", "/api/v1/accounts"], { headers });
      if (statusOk(result.status)) accounts = result.data;
      else issues.push(workspaceIssueFromResult("bigcapital", "accounts", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("bigcapital", "accounts", err));
    }

    try {
      const result = await proxyFetchWithFallbacks(
        SERVICES.bigcapital,
        ["/api/transactions?page=1&page_size=50", "/api/v1/transactions?page=1&page_size=50"],
        { headers },
      );
      if (statusOk(result.status)) transactions = result.data;
      else issues.push(workspaceIssueFromResult("bigcapital", "transactions", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("bigcapital", "transactions", err));
    }

    try {
      const result = await proxyFetchWithFallbacks(
        SERVICES.bigcapital,
        ["/api/reports/balance-sheet", "/api/financial-statements/balance-sheet", "/api/v1/financial-statements/balance-sheet"],
        { headers },
      );
      if (statusOk(result.status)) balanceSheet = result.data;
      else issues.push(workspaceIssueFromResult("bigcapital", "balance_sheet", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("bigcapital", "balance_sheet", err));
    }

    try {
      const result = await proxyFetchWithFallbacks(
        SERVICES.bigcapital,
        ["/api/reports/profit-loss-sheet", "/api/financial-statements/profit-loss-sheet", "/api/v1/financial-statements/profit-loss-sheet"],
        { headers },
      );
      if (statusOk(result.status)) profitLoss = result.data;
      else issues.push(workspaceIssueFromResult("bigcapital", "profit_loss", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("bigcapital", "profit_loss", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "bookkeeping",
      title: "Maxed Ledger",
      actions: {
        read: true,
        review: true,
      },
    },
    issues,
    data: {
      clients,
      accounts,
      transactions,
      balanceSheet,
      profitLoss,
    },
  };
}

async function loadTimeTrackingWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "kimai");
  const headers = await kimaiAuth(firmId);
  const issues = [];
  let timesheets = null;
  let projects = null;
  let activities = null;
  let customers = null;

  if (workspace.configured && (headers["X-AUTH-TOKEN"] || headers.Authorization)) {
    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/timesheets?page=1&size=50&order=DESC&orderBy=begin", { headers });
      if (statusOk(result.status)) timesheets = result.data;
      else issues.push(workspaceIssueFromResult("kimai", "timesheets", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("kimai", "timesheets", err));
    }

    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/projects", { headers });
      if (statusOk(result.status)) projects = result.data;
      else issues.push(workspaceIssueFromResult("kimai", "projects", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("kimai", "projects", err));
    }

    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/activities", { headers });
      if (statusOk(result.status)) activities = result.data;
      else issues.push(workspaceIssueFromResult("kimai", "activities", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("kimai", "activities", err));
    }

    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/customers", { headers });
      if (statusOk(result.status)) customers = result.data;
      else issues.push(workspaceIssueFromResult("kimai", "customers", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("kimai", "customers", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "time_tracking",
      title: "Maxed Time",
      actions: {
        read: true,
        createTimesheet: workspace.configured,
        createSetupRecords: workspace.configured,
      },
    },
    issues,
    data: {
      timesheets,
      projects,
      activities,
      customers,
    },
  };
}

async function loadInvoicingWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "invoiceninja");
  const [clients, headers] = await Promise.all([
    getFirmClientsWorkspaceData(firmId),
    invoiceNinjaAuth(firmId),
  ]);
  const issues = [];
  let remoteClients = null;
  let invoices = null;
  let payments = null;

  if (workspace.configured && headers["X-API-TOKEN"]) {
    try {
      const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/clients?per_page=100", { headers });
      if (statusOk(result.status)) remoteClients = result.data;
      else issues.push(workspaceIssueFromResult("invoiceninja", "clients", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("invoiceninja", "clients", err));
    }

    try {
      const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/invoices?page=1&per_page=50&sort=created_at|desc", { headers });
      if (statusOk(result.status)) invoices = result.data;
      else issues.push(workspaceIssueFromResult("invoiceninja", "invoices", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("invoiceninja", "invoices", err));
    }

    try {
      const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/payments?page=1&per_page=50&sort=created_at|desc", { headers });
      if (statusOk(result.status)) payments = result.data;
      else issues.push(workspaceIssueFromResult("invoiceninja", "payments", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("invoiceninja", "payments", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "invoicing",
      title: "Maxed Billing",
      actions: {
        read: true,
        createInvoice: workspace.configured,
        recordPayment: workspace.configured,
      },
    },
    issues,
    data: {
      clients,
      remoteClients,
      invoices,
      payments,
    },
  };
}

async function loadDocumentsWorkspace(firmId, filters = {}) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "paperless");
  const clients = await getFirmClientsWorkspaceData(firmId);
  const headers = await paperlessAuth(firmId);
  const issues = [];
  let documents = null;
  let tags = null;
  let correspondents = null;
  let documentTypes = null;

  if (workspace.configured && headers.Authorization) {
    const qs = new URLSearchParams({ page: "1", ordering: "-created" });
    if (filters.search) qs.set("query", String(filters.search));
    if (filters.tag) qs.set("tags__id", String(filters.tag));
    if (filters.correspondent) qs.set("correspondent__id", String(filters.correspondent));
    if (filters.documentType) qs.set("document_type__id", String(filters.documentType));

    try {
      const result = await proxyFetch(SERVICES.paperless, `/api/documents/?${qs}`, { headers });
      if (statusOk(result.status)) documents = result.data;
      else issues.push(workspaceIssueFromResult("paperless", "documents", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("paperless", "documents", err));
    }

    try {
      const result = await proxyFetch(SERVICES.paperless, "/api/tags/", { headers });
      if (statusOk(result.status)) tags = result.data;
      else issues.push(workspaceIssueFromResult("paperless", "tags", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("paperless", "tags", err));
    }

    try {
      const result = await proxyFetch(SERVICES.paperless, "/api/correspondents/", { headers });
      if (statusOk(result.status)) correspondents = result.data;
      else issues.push(workspaceIssueFromResult("paperless", "correspondents", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("paperless", "correspondents", err));
    }

    try {
      const result = await proxyFetch(SERVICES.paperless, "/api/document_types/", { headers });
      if (statusOk(result.status)) documentTypes = result.data;
      else issues.push(workspaceIssueFromResult("paperless", "document_types", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("paperless", "document_types", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "documents",
      title: "Maxed Docs",
      actions: {
        read: true,
        upload: true,
        updateMetadata: true,
        download: true,
      },
    },
    issues,
    data: {
      clients,
      documents,
      tags,
      correspondents,
      documentTypes,
    },
  };
}

async function loadProposalsWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "docuseal");
  const [clients, headers] = await Promise.all([
    getFirmClientsWorkspaceData(firmId),
    docusealAuth(firmId),
  ]);
  const issues = [];
  let templates = null;
  let submissions = null;

  if (workspace.configured && (headers.Authorization || headers["X-Auth-Token"])) {
    try {
      const result = await proxyFetch(SERVICES.docuseal, "/api/templates", { headers });
      if (statusOk(result.status)) templates = result.data;
      else issues.push(workspaceIssueFromResult("docuseal", "templates", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("docuseal", "templates", err));
    }

    try {
      const result = await proxyFetch(SERVICES.docuseal, "/api/submissions?page=1", { headers });
      if (statusOk(result.status)) submissions = result.data;
      else issues.push(workspaceIssueFromResult("docuseal", "submissions", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("docuseal", "submissions", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "proposals",
      title: "Maxed Sign",
      actions: {
        read: true,
        createSubmission: true,
      },
    },
    issues,
    data: {
      clients,
      templates,
      submissions,
    },
  };
}

async function loadWorkflowsWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "n8n");
  const headers = await n8nAuth(firmId);
  const issues = [];
  let workflows = null;
  let executions = null;

  if (workspace.configured && headers["X-N8N-API-KEY"]) {
    try {
      const result = await proxyFetch(SERVICES.n8n, "/api/v1/workflows", { headers });
      if (statusOk(result.status)) workflows = result.data;
      else issues.push(workspaceIssueFromResult("n8n", "workflows", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("n8n", "workflows", err));
    }

    try {
      const result = await proxyFetch(SERVICES.n8n, "/api/v1/executions?limit=30", { headers });
      if (statusOk(result.status)) executions = result.data;
      else issues.push(workspaceIssueFromResult("n8n", "executions", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("n8n", "executions", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "workflows",
      title: "Maxed Automations",
      actions: {
        read: true,
        toggleWorkflow: true,
      },
    },
    issues,
    data: {
      workflows,
      executions,
    },
  };
}

async function loadChatWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "mattermost");
  const token = await getMattermostToken(firmId);
  const issues = [];
  let me = null;
  let teams = null;

  if (workspace.configured && token) {
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const result = await proxyFetch(SERVICES.mattermost, "/api/v4/users/me", { headers });
      if (statusOk(result.status)) me = result.data;
      else issues.push(workspaceIssueFromResult("mattermost", "me", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("mattermost", "me", err));
    }

    try {
      const result = await proxyFetch(SERVICES.mattermost, "/api/v4/users/me/teams", { headers });
      if (statusOk(result.status)) teams = result.data;
      else issues.push(workspaceIssueFromResult("mattermost", "teams", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("mattermost", "teams", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "chat",
      title: "Maxed Team Chat",
      actions: {
        read: true,
        post: true,
        createChannel: true,
      },
    },
    issues,
    data: {
      me,
      teams,
    },
  };
}

async function loadChatChannelsWorkspace(firmId, teamId) {
  const token = await getMattermostToken(firmId);
  if (!token) {
    return { issues: [{ service: "mattermost", operation: "channels", status: 401, reason: "auth_unavailable", detail: "" }], data: { channels: null } };
  }

  const result = await proxyFetch(SERVICES.mattermost, `/api/v4/users/me/teams/${teamId}/channels`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    issues: statusOk(result.status) ? [] : [workspaceIssueFromResult("mattermost", "channels", result)],
    data: {
      channels: statusOk(result.status) ? result.data : null,
    },
  };
}

async function loadChatPostsWorkspace(firmId, channelId) {
  const token = await getMattermostToken(firmId);
  if (!token) {
    return { issues: [{ service: "mattermost", operation: "posts", status: 401, reason: "auth_unavailable", detail: "" }], data: { posts: null } };
  }

  const result = await proxyFetch(SERVICES.mattermost, `/api/v4/channels/${channelId}/posts`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    issues: statusOk(result.status) ? [] : [workspaceIssueFromResult("mattermost", "posts", result)],
    data: {
      posts: statusOk(result.status) ? result.data : null,
    },
  };
}

async function loadCrmWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "twenty");
  const [clients, headers] = await Promise.all([
    getFirmClientsWorkspaceData(firmId),
    twentyAuth(firmId),
  ]);
  const issues = [];
  let companies = null;
  let people = null;

  if (workspace.configured && headers.Authorization) {
    try {
      const result = await proxyFetch(SERVICES.twenty, "/api/companies", { headers });
      if (statusOk(result.status)) companies = result.data;
      else issues.push(workspaceIssueFromResult("twenty", "companies", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("twenty", "companies", err));
    }

    try {
      const result = await proxyFetch(SERVICES.twenty, "/api/people", { headers });
      if (statusOk(result.status)) people = result.data;
      else issues.push(workspaceIssueFromResult("twenty", "people", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("twenty", "people", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "crm",
      title: "Maxed CRM",
      actions: {
        read: true,
        createCompany: true,
        createPerson: true,
      },
    },
    issues,
    data: {
      clients,
      companies,
      people,
    },
  };
}

async function loadReportingWorkspace(firmId) {
  const workspace = await buildServiceControlPlaneSnapshot(firmId, "metabase");
  const [stats, metabaseSession, bookkeepingWorkspace] = await Promise.all([
    getFirmStatsPayload(firmId),
    getMetabaseSession(firmId),
    loadBookkeepingWorkspace(firmId),
  ]);
  const issues = [...(bookkeepingWorkspace.issues || [])];
  let dashboards = null;
  let questions = null;

  if (workspace.configured && metabaseSession) {
    const headers = { "X-Metabase-Session": metabaseSession };

    try {
      const result = await proxyFetch(SERVICES.metabase, "/api/dashboard", { headers });
      if (statusOk(result.status)) dashboards = result.data;
      else issues.push(workspaceIssueFromResult("metabase", "dashboards", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("metabase", "dashboards", err));
    }

    try {
      const result = await proxyFetch(SERVICES.metabase, "/api/card", { headers });
      if (statusOk(result.status)) questions = result.data;
      else issues.push(workspaceIssueFromResult("metabase", "questions", result));
    } catch (err) {
      issues.push(workspaceIssueFromError("metabase", "questions", err));
    }
  }

  return {
    workspace: {
      ...workspace,
      module: "reporting",
      title: "Maxed Analytics",
      actions: {
        read: true,
      },
    },
    issues,
    data: {
      stats,
      dashboards,
      questions,
      balanceSheet: bookkeepingWorkspace.data?.balanceSheet || null,
      profitLoss: bookkeepingWorkspace.data?.profitLoss || null,
    },
  };
}

app.get("/bridge/:service", async (req, res) => {
  try {
    const service = req.params.service;
    const serviceUrl = getPublicServiceUrl(service);
    const accessCapability = SERVICE_ACCESS_CAPABILITIES[service] || {
      browserSessionBroker: false,
      cpaMode: "maxed_native_only",
      adminMode: "setup_and_exception_handoff",
    };
    const maxedWorkspaceUrl = getMaxedWorkspaceUrl(service);
    if (!serviceUrl) {
      return res.status(404).send(bridgePage({
        title: "Workspace Unavailable",
        message: "This workspace is not configured in Maxed yet.",
        redirectUrl: "https://app.maxed.life/dashboard",
        autoRedirect: false,
      }));
    }

    const firmId = typeof req.query.firmId === "string" ? req.query.firmId : null;
    const credential = firmId ? await getServiceCredential(firmId, service) : null;
    const hasSavedAccess =
      !!credential?.token || (!!credential?.username && !!credential?.password);

    if (!firmId) {
      return res.status(400).send(bridgePage({
        title: "Firm Session Missing",
        message: "Maxed could not determine which firm workspace to open. Return to the dashboard and try again.",
        redirectUrl: maxedWorkspaceUrl,
        autoRedirect: false,
      }));
    }

    if (!hasSavedAccess) {
      return res.status(401).send(bridgePage({
        title: "Workspace Credentials Required",
        message: "This workspace does not have saved credentials yet. Add the firm login and any API token in Maxed admin before opening it.",
        redirectUrl: maxedWorkspaceUrl,
        autoRedirect: false,
      }));
    }

    if (!accessCapability.browserSessionBroker) {
      return res.status(200).send(bridgePage({
        title: "Open In Maxed",
        message: "This workspace is Maxed-managed. CPA access stays in Maxed, and upstream access remains an admin exception path.",
        redirectUrl: maxedWorkspaceUrl,
        autoRedirect: true,
      }));
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(bridgePage({
      title: "Opening Workspace",
      message: "Maxed is handing off to the live workspace for this firm.",
      redirectUrl: serviceUrl,
      autoRedirect: true,
    }));
  } catch (err) {
    return res.status(500).send(bridgePage({
      title: "Workspace Error",
      message: err.message || "Maxed could not open this workspace.",
      redirectUrl: "https://app.maxed.life/dashboard",
      autoRedirect: false,
    }));
  }
});

// ---------------------------------------------------------------------------
// Storage proxy — Supabase when configured, local Maxed storage otherwise
// ---------------------------------------------------------------------------
function resolveStorageTarget(bucket, relativePath) {
  const safeBucket = String(bucket || "documents").replace(/[^a-zA-Z0-9._-]/g, "") || "documents";
  const normalizedPath = String(relativePath || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const absolutePath = path.resolve(LOCAL_STORAGE_ROOT, safeBucket, normalizedPath);
  const bucketRoot = path.resolve(LOCAL_STORAGE_ROOT, safeBucket);

  if (!normalizedPath || !absolutePath.startsWith(`${bucketRoot}${path.sep}`) && absolutePath !== bucketRoot) {
    const error = new Error("Invalid storage path");
    error.status = 400;
    throw error;
  }

  return {
    bucket: safeBucket,
    relativePath: normalizedPath,
    absolutePath,
  };
}

function buildPublicApiBase(req) {
  if (process.env.PUBLIC_API_URL) {
    return String(process.env.PUBLIC_API_URL).replace(/\/$/, "");
  }

  const forwardedProto = String(req.headers["x-forwarded-proto"] || req.protocol || "http");
  const forwardedHost = String(req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`);
  return `${forwardedProto}://${forwardedHost}`;
}

async function writeManagedStorageObject({ bucket = "documents", relativePath, buffer, contentType }) {
  if (supabase) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(relativePath, buffer, { contentType: contentType || "application/octet-stream", upsert: true });
    if (error) {
      const err = new Error(error.message);
      err.status = 400;
      throw err;
    }
    return {
      provider: "supabase",
      bucket,
      path: relativePath,
      ...data,
    };
  }

  const target = resolveStorageTarget(bucket, relativePath);
  await fs.mkdir(path.dirname(target.absolutePath), { recursive: true });
  await fs.writeFile(target.absolutePath, buffer);

  return {
    provider: "local",
    bucket: target.bucket,
    path: target.relativePath,
    size: buffer.length,
    localPath: target.absolutePath,
  };
}

// ---------------------------------------------------------------------------
// Admin — Manage team members (admin creates accounts for users)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Password Reset — request + confirm flow
// ---------------------------------------------------------------------------
const resetTokens = new Map(); // In-memory store: token -> { email, expires }

app.post("/api/auth/forgot-password", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email required" });

  const member = await prisma.teamMember.findFirst({ where: { email } });
  if (!member) {
    // Don't reveal whether the email exists
    return res.json({ ok: true, message: "If an account exists, a reset link has been generated." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  resetTokens.set(token, { email, expires: Date.now() + 3600000 }); // 1 hour

  // In production, you'd send an email. For now, log and return the token.
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

registerOpenFrameRoutes(app, {
  fs,
  supabase,
  prisma,
  SERVICES,
  PUBLIC_SERVICES,
  SERVICE_CATALOG,
  SERVICE_WORKSPACE_PATHS,
  SERVICE_ACCESS_CAPABILITIES,
  SERVICE_PROVISIONING_ADAPTERS,
  BROKER_SESSION_TTL_MS,
  supportsFirmServiceAccounts,
  supportsProvisioningRuns,
  supportsBrokerSessions,
  credentialCache,
  metabaseSessions,
  mattermostSessions,
  bigcapitalSessions,
  invoiceNinjaSessions,
  normalizeCredentialField,
  mergeCredentialUpdate,
  ensureFirmServiceAccountPlan,
  getServiceCredential,
  probeServiceAccess,
  buildPublicServiceUrl,
  getServiceIdentityShape,
  resolvePlatformSessionFromRequest,
  executeProvisioningRun,
  provisionFirmServices,
  normalizeBridgeTarget,
  getMaxedWorkspaceUrl,
  buildCanonicalIdentity,
  buildSuggestedServiceCredential,
  proxyFetch,
  proxyFetchWithFallbacks,
  paperlessAuth,
  docusealAuth,
  n8nAuth,
  kimaiAuth,
  invoiceNinjaAuth,
  bigcapitalAuth,
  twentyAuth,
  getMetabaseSession,
  getMattermostToken,
  ensureInvoiceNinjaClient,
  invoiceNinjaResourceId,
  resolveStorageTarget,
  buildPublicApiBase,
  writeManagedStorageObject,
  stringifyConnectorDetail,
  workspaceIssueFromError,
  workspaceIssueFromResult,
  statusOk,
  loadBookkeepingWorkspace,
  loadDocumentsWorkspace,
  loadTimeTrackingWorkspace,
  loadProposalsWorkspace,
  loadWorkflowsWorkspace,
  loadChatWorkspace,
  loadChatChannelsWorkspace,
  loadChatPostsWorkspace,
  loadCrmWorkspace,
  loadInvoicingWorkspace,
  loadReportingWorkspace,
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Maxed platform API running on http://localhost:${PORT}`);
});
