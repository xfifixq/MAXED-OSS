require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 4000;

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

function requireAuth(req, res, next) {
  // Skip auth in development if no key is configured
  if (!API_KEY) return next();

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

    res.json({
      id: member.id,
      email: member.email,
      name: member.name,
      role: member.role,
      firmId: member.firmId,
      firmName: member.firm.name,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Client portal login
app.post("/api/clients/login", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const client = await prisma.client.findFirst({
      where: { email },
      include: { firm: true },
    });

    if (!client) {
      return res.status(401).json({ error: "Client not found" });
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

      return { firm, member };
    });

    res.status(201).json({
      firmId: result.firm.id,
      firmName: result.firm.name,
      userId: result.member.id,
      email: result.member.email,
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
    const firm = await prisma.firm.create({ data: req.body });
    res.status(201).json(firm);
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
    res.json(firm);
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
      include: { documents: true, invoices: true, scenarios: true },
    });
    res.json(clients);
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

// ---------------------------------------------------------------------------
// Firm Stats
// ---------------------------------------------------------------------------
app.get("/api/firms/:firmId/stats", async (req, res) => {
  try {
    const { firmId } = req.params;

    const clients = await prisma.client.findMany({
      where: { firmId },
      select: { id: true, annualRevenue: true },
    });

    const clientIds = clients.map((c) => c.id);

    const [docCount, invoiceCount, scenarioCount] = await Promise.all([
      prisma.document.count({ where: { clientId: { in: clientIds } } }),
      prisma.invoice.count({ where: { clientId: { in: clientIds } } }),
      prisma.scenario.count({ where: { clientId: { in: clientIds } } }),
    ]);

    const pendingInvoices = await prisma.invoice.count({
      where: { clientId: { in: clientIds }, status: { in: ["draft", "sent", "pending"] } },
    });

    const totalRevenue = clients.reduce(
      (sum, c) => sum + (c.annualRevenue || 0),
      0
    );

    res.json({
      // Dashboard-expected fields
      totalClients: clients.length,
      activeWorkflows: 0, // Populated when n8n API is connected
      pendingInvoices,
      upcomingDeadlines: scenarioCount, // Scenarios as proxy for deadlines
      // Extended stats
      clientCount: clients.length,
      docCount,
      invoiceCount,
      scenarioCount,
      totalRevenue,
    });
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

function getPublicServiceUrl(service) {
  return PUBLIC_SERVICES[service] || null;
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

// ---------------------------------------------------------------------------
// Per-firm service credential lookup (DB-first, env-var fallback)
// ---------------------------------------------------------------------------
const credentialCache = new Map();

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

// Extract firmId from X-Firm-Id header on all service proxy routes
app.use("/api/services", (req, _res, next) => {
  req.firmId = req.headers["x-firm-id"] || null;
  if (!req.firmId && req.path !== "/urls" && req.path !== "/status" && req.path !== "/diagnose") {
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
      "X-AUTH-USER": cred.username || "admin@maxed.dev",
      "X-AUTH-TOKEN": cred.token,
    };
  }
  const token = process.env.KIMAI_API_TOKEN || null;
  if (!token) return {};
  return {
    "X-AUTH-USER": process.env.KIMAI_API_USER || "admin@maxed.dev",
    "X-AUTH-TOKEN": token,
  };
}

async function invoiceNinjaAuth(firmId) {
  const cred = await getServiceCredential(firmId, "invoiceninja");
  if (cred?.token) return { "X-API-TOKEN": cred.token, "X-Requested-With": "XMLHttpRequest" };
  const token = process.env.INVOICE_NINJA_API_TOKEN || null;
  return token
    ? { "X-API-TOKEN": token, "X-Requested-With": "XMLHttpRequest" }
    : { "X-Requested-With": "XMLHttpRequest" };
}

async function bigcapitalAuth(firmId) {
  const cred = await getServiceCredential(firmId, "bigcapital");
  if (cred?.token) {
    const h = { Authorization: `Bearer ${cred.token}` };
    if (cred.metadata) h["x-tenant-id"] = cred.metadata;
    return h;
  }
  const token = process.env.BIGCAPITAL_API_TOKEN || null;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (process.env.BIGCAPITAL_TENANT_ID) headers["x-tenant-id"] = process.env.BIGCAPITAL_TENANT_ID;
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

app.get("/bridge/:service", async (req, res) => {
  try {
    const service = req.params.service;
    const serviceUrl = getPublicServiceUrl(service);
    if (!serviceUrl) {
      return res.status(404).send(bridgePage({
        title: "Workspace Unavailable",
        message: "This workspace is not configured in Maxed yet.",
        redirectUrl: "https://app.maxed.life/dashboard",
        autoRedirect: false,
      }));
    }

    const firmId = typeof req.query.firmId === "string" ? req.query.firmId : null;
    const target = normalizeBridgeTarget(req.query.target);
    const targetUrl = `${serviceUrl.replace(/\/$/, "")}${target}`;
    const credential = firmId ? await getServiceCredential(firmId, service) : null;
    const hasSavedAccess =
      !!credential?.token || (!!credential?.username && !!credential?.password);

    if (!firmId) {
      return res.status(400).send(bridgePage({
        title: "Firm Session Missing",
        message: "Maxed could not determine which firm workspace to open. Return to the dashboard and try again.",
        redirectUrl: targetUrl,
        autoRedirect: false,
      }));
    }

    if (!hasSavedAccess) {
      return res.status(401).send(bridgePage({
        title: "Workspace Credentials Required",
        message: "This workspace does not have saved credentials yet. Add the firm login and any API token in Maxed admin before opening it.",
        redirectUrl: targetUrl,
        autoRedirect: false,
      }));
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(bridgePage({
      title: "Opening Workspace",
      message: "Maxed is handing off to the live workspace for this firm.",
      redirectUrl: targetUrl,
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
// Paperless-ngx proxy — Document management
// ---------------------------------------------------------------------------

app.get("/api/services/paperless/documents", async (req, res) => {
  try {
    const { page = 1, search = "" } = req.query;
    const qs = new URLSearchParams({ page: String(page), ordering: "-created" });
    if (search) qs.set("query", String(search));
    const result = await proxyFetch(
      SERVICES.paperless,
      `/api/documents/?${qs}`,
      { headers: await paperlessAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Paperless unavailable", detail: err.message });
  }
});

app.get("/api/services/paperless/documents/:id/thumb", async (req, res) => {
  try {
    const url = `${SERVICES.paperless}/api/documents/${req.params.id}/thumb/`;
    const upstream = await fetch(url, { headers: await paperlessAuth(req.firmId) });
    res.set("Content-Type", upstream.headers.get("content-type") || "image/png");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).json({ error: "Paperless unavailable" });
  }
});

app.get("/api/services/paperless/tags", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.paperless, "/api/tags/", {
      headers: await paperlessAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Paperless unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// DocuSeal proxy — E-signatures and proposals
// ---------------------------------------------------------------------------
app.get("/api/services/docuseal/templates", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.docuseal, "/api/templates", {
      headers: await docusealAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "DocuSeal unavailable", detail: err.message });
  }
});

app.get("/api/services/docuseal/submissions", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const result = await proxyFetch(
      SERVICES.docuseal,
      `/api/submissions?page=${page}`,
      { headers: await docusealAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "DocuSeal unavailable", detail: err.message });
  }
});

app.post("/api/services/docuseal/submissions", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.docuseal, "/api/submissions", {
      method: "POST",
      headers: await docusealAuth(req.firmId),
      body: JSON.stringify(req.body),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "DocuSeal unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// n8n proxy — Workflow automation
// ---------------------------------------------------------------------------
app.get("/api/services/n8n/workflows", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.n8n, "/api/v1/workflows", {
      headers: await n8nAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "n8n unavailable", detail: err.message });
  }
});

app.get("/api/services/n8n/executions", async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const result = await proxyFetch(
      SERVICES.n8n,
      `/api/v1/executions?limit=${limit}`,
      { headers: await n8nAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "n8n unavailable", detail: err.message });
  }
});

app.post("/api/services/n8n/workflows/:id/activate", async (req, res) => {
  try {
    const result = await proxyFetch(
      SERVICES.n8n,
      `/api/v1/workflows/${req.params.id}`,
      {
        method: "PATCH",
        headers: await n8nAuth(req.firmId),
        body: JSON.stringify({ active: true }),
      }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "n8n unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Kimai proxy — Time tracking
// ---------------------------------------------------------------------------
app.get("/api/services/kimai/timesheets", async (req, res) => {
  try {
    const { page = 1, size = 50 } = req.query;
    const result = await proxyFetch(
      SERVICES.kimai,
      `/api/timesheets?page=${page}&size=${size}&order=DESC&orderBy=begin`,
      { headers: await kimaiAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

app.post("/api/services/kimai/timesheets", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.kimai, "/api/timesheets", {
      method: "POST",
      headers: await kimaiAuth(req.firmId),
      body: JSON.stringify(req.body),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

app.get("/api/services/kimai/projects", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.kimai, "/api/projects", {
      headers: await kimaiAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

app.get("/api/services/kimai/activities", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.kimai, "/api/activities", {
      headers: await kimaiAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Invoice Ninja proxy — Invoicing
// ---------------------------------------------------------------------------
app.get("/api/services/invoiceninja/invoices", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const result = await proxyFetch(
      SERVICES.invoiceninja,
      `/api/v1/invoices?page=${page}&per_page=50&sort=created_at|desc`,
      { headers: await invoiceNinjaAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Invoice Ninja unavailable", detail: err.message });
  }
});

app.get("/api/services/invoiceninja/clients", async (req, res) => {
  try {
    const result = await proxyFetch(
      SERVICES.invoiceninja,
      "/api/v1/clients?per_page=100",
      { headers: await invoiceNinjaAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Invoice Ninja unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Supabase Storage proxy — File uploads/downloads via Supabase Storage
// ---------------------------------------------------------------------------
if (supabase) {
  app.post("/api/storage/upload", async (req, res) => {
    try {
      const { bucket = "documents", path, base64Data, contentType } = req.body;
      if (!path || !base64Data) {
        return res.status(400).json({ error: "path and base64Data required" });
      }
      const buffer = Buffer.from(base64Data, "base64");
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, buffer, { contentType: contentType || "application/octet-stream", upsert: true });
      if (error) return res.status(400).json({ error: error.message });
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/storage/url", async (req, res) => {
    try {
      const { bucket = "documents", path } = req.query;
      if (!path) return res.status(400).json({ error: "path required" });
      const { data } = supabase.storage.from(String(bucket)).getPublicUrl(String(path));
      res.json({ url: data.publicUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
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
const crypto = require("crypto");
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

// ---------------------------------------------------------------------------
// Bigcapital proxy — Accounting & bookkeeping
// ---------------------------------------------------------------------------
app.get("/api/services/bigcapital/accounts", async (req, res) => {
  try {
    const result = await proxyFetchWithFallbacks(SERVICES.bigcapital, ["/api/accounts", "/api/v1/accounts"], {
      headers: await bigcapitalAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

app.get("/api/services/bigcapital/transactions", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const result = await proxyFetchWithFallbacks(
      SERVICES.bigcapital,
      [
        `/api/transactions?page=${page}&page_size=50`,
        `/api/v1/transactions?page=${page}&page_size=50`,
      ],
      { headers: await bigcapitalAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

app.get("/api/services/bigcapital/balance-sheet", async (req, res) => {
  try {
    const result = await proxyFetchWithFallbacks(
      SERVICES.bigcapital,
      [
        "/api/financial-statements/balance-sheet",
        "/api/v1/financial-statements/balance-sheet",
      ],
      { headers: await bigcapitalAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

app.get("/api/services/bigcapital/profit-loss", async (req, res) => {
  try {
    const result = await proxyFetchWithFallbacks(
      SERVICES.bigcapital,
      [
        "/api/financial-statements/profit-loss-sheet",
        "/api/v1/financial-statements/profit-loss-sheet",
      ],
      { headers: await bigcapitalAuth(req.firmId) }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Twenty CRM proxy — Customer relationship management
// ---------------------------------------------------------------------------
app.get("/api/services/twenty/companies", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/companies", {
      headers: await twentyAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Twenty CRM unavailable", detail: err.message });
  }
});

app.get("/api/services/twenty/people", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/people", {
      headers: await twentyAuth(req.firmId),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Twenty CRM unavailable", detail: err.message });
  }
});

app.post("/api/services/twenty/companies", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/companies", {
      method: "POST",
      headers: await twentyAuth(req.firmId),
      body: JSON.stringify(req.body),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Twenty CRM unavailable", detail: err.message });
  }
});

app.post("/api/services/twenty/people", async (req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/people", {
      method: "POST",
      headers: await twentyAuth(req.firmId),
      body: JSON.stringify(req.body),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Twenty CRM unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Metabase proxy — Reporting & analytics
// ---------------------------------------------------------------------------
app.get("/api/services/metabase/dashboards", async (req, res) => {
  try {
    const session = await getMetabaseSession(req.firmId);
    if (!session) return res.status(401).json({ error: "Metabase session unavailable" });
    const result = await proxyFetch(SERVICES.metabase, "/api/dashboard", {
      headers: { "X-Metabase-Session": session },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Metabase unavailable", detail: err.message });
  }
});

app.get("/api/services/metabase/questions", async (req, res) => {
  try {
    const session = await getMetabaseSession(req.firmId);
    if (!session) return res.status(401).json({ error: "Metabase session unavailable" });
    const result = await proxyFetch(SERVICES.metabase, "/api/card", {
      headers: { "X-Metabase-Session": session },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Metabase unavailable", detail: err.message });
  }
});

app.get("/api/services/metabase/dashboard/:id", async (req, res) => {
  try {
    const session = await getMetabaseSession(req.firmId);
    if (!session) return res.status(401).json({ error: "Metabase session unavailable" });
    const result = await proxyFetch(SERVICES.metabase, `/api/dashboard/${req.params.id}`, {
      headers: { "X-Metabase-Session": session },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Metabase unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Mattermost proxy — Team chat & communication
// ---------------------------------------------------------------------------
app.get("/api/services/mattermost/channels", async (req, res) => {
  try {
    const token = await getMattermostToken(req.firmId);
    if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
    const result = await proxyFetch(SERVICES.mattermost, "/api/v4/channels", {
      headers: { Authorization: "Bearer " + token },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
  }
});

app.get("/api/services/mattermost/channels/:id/posts", async (req, res) => {
  try {
    const token = await getMattermostToken(req.firmId);
    if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
    const result = await proxyFetch(
      SERVICES.mattermost,
      `/api/v4/channels/${req.params.id}/posts?per_page=50`,
      { headers: { Authorization: "Bearer " + token } }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
  }
});

app.post("/api/services/mattermost/channels/:id/posts", async (req, res) => {
  try {
    const token = await getMattermostToken(req.firmId);
    if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
    const result = await proxyFetch(SERVICES.mattermost, "/api/v4/posts", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
      body: JSON.stringify(req.body),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
  }
});

app.get("/api/services/mattermost/teams", async (req, res) => {
  try {
    const token = await getMattermostToken(req.firmId);
    if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
    const result = await proxyFetch(SERVICES.mattermost, "/api/v4/teams", {
      headers: { Authorization: "Bearer " + token },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
  }
});

app.get("/api/services/mattermost/users", async (req, res) => {
  try {
    const token = await getMattermostToken(req.firmId);
    if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
    const result = await proxyFetch(SERVICES.mattermost, "/api/v4/users?per_page=100", {
      headers: { Authorization: "Bearer " + token },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Service Credentials CRUD — admin manages per-firm service credentials
// ---------------------------------------------------------------------------
app.get("/api/firms/:firmId/credentials", async (req, res) => {
  try {
    const creds = await prisma.serviceCredential.findMany({
      where: { firmId: req.params.firmId },
      select: { id: true, service: true, username: true, metadata: true, createdAt: true,
        // Don't expose raw tokens/passwords — just indicate if set
        token: true, password: true },
    });
    // Mask sensitive fields
    const masked = creds.map((c) => ({
      ...c,
      token: c.token ? "***configured***" : null,
      password: c.password ? "***configured***" : null,
    }));
    res.json(masked);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/api/firms/:firmId/credentials/:service", async (req, res) => {
  try {
    const { firmId, service } = req.params;
    const incoming = {
      token: normalizeCredentialField(req.body?.token),
      username: normalizeCredentialField(req.body?.username),
      password: normalizeCredentialField(req.body?.password),
      metadata: normalizeCredentialField(req.body?.metadata),
    };
    const existing = await prisma.serviceCredential.findUnique({
      where: { firmId_service: { firmId, service } },
    });
    const data = mergeCredentialUpdate(existing, incoming);
    const cred = await prisma.serviceCredential.upsert({
      where: { firmId_service: { firmId, service } },
      create: { firmId, service, ...data },
      update: data,
    });
    // Clear cache for this firm+service
    credentialCache.delete(`${firmId}:${service}`);
    // Clear session caches for session-based services
    if (service === "metabase") metabaseSessions.delete(firmId);
    if (service === "mattermost") mattermostSessions.delete(firmId);
    res.json({ ok: true, service: cred.service });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/firms/:firmId/credentials/:service", async (req, res) => {
  try {
    const { firmId, service } = req.params;
    await prisma.serviceCredential.delete({
      where: { firmId_service: { firmId, service } },
    });
    credentialCache.delete(`${firmId}:${service}`);
    if (service === "metabase") metabaseSessions.delete(firmId);
    if (service === "mattermost") mattermostSessions.delete(firmId);
    res.json({ ok: true });
  } catch (err) {
    if (err.code === "P2025") return res.json({ ok: true }); // Already deleted
    res.status(500).json({ error: err.message });
  }
});

// Return public-facing service URLs for admin iframe page
app.get("/api/services/urls", (_req, res) => {
  res.json(PUBLIC_SERVICES);
});

// ---------------------------------------------------------------------------
// Service health check — check all integrated services
// ---------------------------------------------------------------------------
app.get("/api/services/status", async (_req, res) => {
  const results = {};
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const r = await fetch(`${url}/`, { signal: controller.signal });
      clearTimeout(timeout);
      results[name] = { status: "connected", code: r.status };
    } catch {
      results[name] = { status: "unavailable" };
    }
  }
  res.json(results);
});

// Diagnostic: check which service API tokens are configured (per-firm or env)
app.get("/api/services/diagnose", async (req, res) => {
  const firmId = req.headers["x-firm-id"] || null;
  const services = ["paperless", "docuseal", "invoiceninja", "n8n", "kimai", "bigcapital", "twenty", "metabase", "mattermost"];
  const envMap = {
    paperless: "PAPERLESS_API_TOKEN",
    docuseal: "DOCUSEAL_API_TOKEN",
    invoiceninja: "INVOICE_NINJA_API_TOKEN",
    n8n: "N8N_API_KEY",
    kimai: "KIMAI_API_TOKEN",
    bigcapital: "BIGCAPITAL_API_TOKEN",
    twenty: "TWENTY_API_KEY",
    metabase: "METABASE_EMAIL",
    mattermost: "MATTERMOST_USER",
  };
  const diag = { firmId };
  for (const svc of services) {
    const cred = firmId ? await getServiceCredential(firmId, svc) : null;
    const hasFirmCred = !!cred?.token || (!!cred?.username && !!cred?.password) || !!cred?.username;
    const hasEnvVar = !!process.env[envMap[svc]];
    diag[svc] = {
      configured: hasFirmCred || hasEnvVar,
      source: hasFirmCred ? "firm" : hasEnvVar ? "env" : "none",
    };
  }
  res.json(diag);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Maxed platform API running on http://localhost:${PORT}`);
});
