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
  if (req.path === "/auth/login" || req.path === "/auth/verify" || req.path === "/register") {
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
    });

    if (!client) {
      return res.status(401).json({ error: "Client not found" });
    }

    res.json({
      clientId: client.id,
      name: client.name,
      email: client.email,
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

    // Provision service accounts in background (don't block registration)
    provisionServiceAccounts(result.firm.id, adminEmail, adminPassword).catch((err) =>
      console.error("Service provisioning error:", err.message)
    );

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
  bigcapital: process.env.BIGCAPITAL_URL || "http://localhost:3001",
};

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

// ---------------------------------------------------------------------------
// Auto-login token cache — fetches tokens on first use, caches them
// ---------------------------------------------------------------------------
const tokenCache = {};

async function getPaperlessToken() {
  if (tokenCache.paperless) return tokenCache.paperless;
  // If a static token is configured, use it
  if (process.env.PAPERLESS_API_TOKEN) {
    tokenCache.paperless = process.env.PAPERLESS_API_TOKEN;
    return tokenCache.paperless;
  }
  // Otherwise, auto-login with admin credentials
  const user = process.env.PAPERLESS_ADMIN_USER || "admin";
  const pass = process.env.PAPERLESS_ADMIN_PASSWORD || process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.paperless}/api/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: user, password: pass }),
    });
    if (r.ok) {
      const data = await r.json();
      tokenCache.paperless = data.token;
      console.log("Paperless token acquired");
      return tokenCache.paperless;
    }
    console.error("Paperless login failed:", r.status);
  } catch (err) {
    console.error("Paperless login error:", err.message);
  }
  return null;
}

async function getDocuSealToken() {
  if (tokenCache.docuseal) return tokenCache.docuseal;
  if (process.env.DOCUSEAL_API_TOKEN) {
    tokenCache.docuseal = process.env.DOCUSEAL_API_TOKEN;
    return tokenCache.docuseal;
  }
  // DocuSeal: login via API to get auth token
  const email = process.env.SERVICE_ADMIN_EMAIL || "admin@maxed.life";
  const pass = process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.docuseal}/api/auth/sign_in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    if (r.ok) {
      const data = await r.json();
      tokenCache.docuseal = data.token || data.access_token;
      console.log("DocuSeal token acquired");
      return tokenCache.docuseal;
    }
    console.error("DocuSeal login failed:", r.status);
  } catch (err) {
    console.error("DocuSeal login error:", err.message);
  }
  return null;
}

async function getInvoiceNinjaToken() {
  if (tokenCache.invoiceninja) return tokenCache.invoiceninja;
  if (process.env.INVOICE_NINJA_API_TOKEN) {
    tokenCache.invoiceninja = process.env.INVOICE_NINJA_API_TOKEN;
    return tokenCache.invoiceninja;
  }
  const email = process.env.INVOICENINJA_ADMIN_EMAIL || process.env.SERVICE_ADMIN_EMAIL || "admin@maxed.life";
  const pass = process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.invoiceninja}/api/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
      body: JSON.stringify({ email, password: pass }),
    });
    if (r.ok) {
      const data = await r.json();
      if (data.data && data.data[0] && data.data[0].token) {
        tokenCache.invoiceninja = data.data[0].token.token;
        console.log("Invoice Ninja token acquired");
        return tokenCache.invoiceninja;
      }
    }
    console.error("Invoice Ninja login failed:", r.status);
  } catch (err) {
    console.error("Invoice Ninja login error:", err.message);
  }
  return null;
}

async function getN8nToken() {
  if (tokenCache.n8n) return tokenCache.n8n;
  if (process.env.N8N_API_KEY) {
    tokenCache.n8n = process.env.N8N_API_KEY;
    return tokenCache.n8n;
  }
  // n8n: login via REST API to get cookie-based session
  const email = process.env.SERVICE_ADMIN_EMAIL || "admin@maxed.life";
  const pass = process.env.N8N_BASIC_AUTH_PASSWORD || process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.n8n}/rest/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    if (r.ok) {
      // Extract cookie for subsequent requests
      const cookies = r.headers.get("set-cookie") || "";
      tokenCache.n8n_cookie = cookies;
      tokenCache.n8n = "cookie";
      console.log("n8n session acquired");
      return tokenCache.n8n;
    }
    console.error("n8n login failed:", r.status);
  } catch (err) {
    console.error("n8n login error:", err.message);
  }
  return null;
}

async function getKimaiToken() {
  if (tokenCache.kimai) return tokenCache.kimai;
  if (process.env.KIMAI_API_TOKEN) {
    tokenCache.kimai = process.env.KIMAI_API_TOKEN;
    return tokenCache.kimai;
  }
  // Kimai API supports password-based auth directly via X-AUTH-USER + X-AUTH-TOKEN
  // The token IS the password for API access
  tokenCache.kimai = process.env.KIMAI_ADMIN_PASSWORD || process.env.SERVICE_ADMIN_PASSWORD || "";
  console.log("Kimai auth configured (password-based)");
  return tokenCache.kimai;
}

async function getBigcapitalToken() {
  if (tokenCache.bigcapital) return tokenCache.bigcapital;
  if (process.env.BIGCAPITAL_API_TOKEN) {
    tokenCache.bigcapital = process.env.BIGCAPITAL_API_TOKEN;
    return tokenCache.bigcapital;
  }
  const email = process.env.SERVICE_ADMIN_EMAIL || "admin@maxed.life";
  const pass = process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.bigcapital}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    if (r.ok) {
      const data = await r.json();
      tokenCache.bigcapital = data.token;
      if (data.tenant) tokenCache.bigcapital_tenant = data.tenant.id;
      console.log("Bigcapital token acquired");
      return tokenCache.bigcapital;
    }
    console.error("Bigcapital login failed:", r.status);
  } catch (err) {
    console.error("Bigcapital login error:", err.message);
  }
  return null;
}

async function getTwentyToken() {
  if (tokenCache.twenty) return tokenCache.twenty;
  if (process.env.TWENTY_API_KEY) {
    tokenCache.twenty = process.env.TWENTY_API_KEY;
    return tokenCache.twenty;
  }
  const email = process.env.SERVICE_ADMIN_EMAIL || "admin@maxed.life";
  const pass = process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.twenty}/api/auth/sign-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    if (r.ok) {
      const data = await r.json();
      if (data.loginToken) {
        // Exchange loginToken for access token
        const r2 = await fetch(`${SERVICES.twenty}/api/auth/tokens/renew`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ loginToken: data.loginToken }),
        });
        if (r2.ok) {
          const d2 = await r2.json();
          tokenCache.twenty = d2.tokens?.accessToken?.token || d2.accessToken || data.loginToken;
          console.log("Twenty CRM token acquired");
          return tokenCache.twenty;
        }
      }
      tokenCache.twenty = data.token || data.loginToken;
      return tokenCache.twenty;
    }
    console.error("Twenty login failed:", r.status);
  } catch (err) {
    console.error("Twenty login error:", err.message);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Paperless-ngx proxy — Document management
// ---------------------------------------------------------------------------
const paperlessAuth = async () => {
  const token = await getPaperlessToken();
  return token ? { Authorization: `Token ${token}` } : {};
};

app.get("/api/services/paperless/documents", async (req, res) => {
  try {
    const { page = 1, search = "" } = req.query;
    const qs = new URLSearchParams({ page: String(page), ordering: "-created" });
    if (search) qs.set("query", String(search));
    const result = await proxyFetch(
      SERVICES.paperless,
      `/api/documents/?${qs}`,
      { headers: await paperlessAuth() }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Paperless unavailable", detail: err.message });
  }
});

app.get("/api/services/paperless/documents/:id/thumb", async (req, res) => {
  try {
    const url = `${SERVICES.paperless}/api/documents/${req.params.id}/thumb/`;
    const upstream = await fetch(url, { headers: await paperlessAuth() });
    res.set("Content-Type", upstream.headers.get("content-type") || "image/png");
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.send(buffer);
  } catch {
    res.status(502).json({ error: "Paperless unavailable" });
  }
});

app.get("/api/services/paperless/tags", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.paperless, "/api/tags/", {
      headers: await paperlessAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Paperless unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// DocuSeal proxy — E-signatures and proposals
// ---------------------------------------------------------------------------
const docusealAuth = async () => {
  const token = await getDocuSealToken();
  return token ? { "X-Auth-Token": token } : {};
};

app.get("/api/services/docuseal/templates", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.docuseal, "/api/templates", {
      headers: await docusealAuth(),
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
      { headers: await docusealAuth() }
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
      headers: await docusealAuth(),
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
const n8nAuth = async () => {
  const token = await getN8nToken();
  if (process.env.N8N_API_KEY) return { "X-N8N-API-KEY": process.env.N8N_API_KEY };
  // Cookie-based auth
  if (tokenCache.n8n_cookie) return { Cookie: tokenCache.n8n_cookie };
  return {};
};

app.get("/api/services/n8n/workflows", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.n8n, "/api/v1/workflows", {
      headers: await n8nAuth(),
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
      { headers: await n8nAuth() }
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
        headers: await n8nAuth(),
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
const kimaiAuth = async () => {
  const token = await getKimaiToken();
  return {
    "X-AUTH-USER": process.env.KIMAI_API_USER || "admin@maxed.dev",
    "X-AUTH-TOKEN": token || "",
  };
};

app.get("/api/services/kimai/timesheets", async (req, res) => {
  try {
    const { page = 1, size = 50 } = req.query;
    const result = await proxyFetch(
      SERVICES.kimai,
      `/api/timesheets?page=${page}&size=${size}&order=DESC&orderBy=begin`,
      { headers: await kimaiAuth() }
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
      headers: await kimaiAuth(),
      body: JSON.stringify(req.body),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

app.get("/api/services/kimai/projects", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.kimai, "/api/projects", {
      headers: await kimaiAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

app.get("/api/services/kimai/activities", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.kimai, "/api/activities", {
      headers: await kimaiAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Invoice Ninja proxy — Invoicing
// ---------------------------------------------------------------------------
const invoiceNinjaAuth = async () => {
  const token = await getInvoiceNinjaToken();
  return token ? { "X-API-TOKEN": token, "X-Requested-With": "XMLHttpRequest" } : { "X-Requested-With": "XMLHttpRequest" };
};

app.get("/api/services/invoiceninja/invoices", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const result = await proxyFetch(
      SERVICES.invoiceninja,
      `/api/v1/invoices?page=${page}&per_page=50&sort=created_at|desc`,
      { headers: await invoiceNinjaAuth() }
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
      { headers: await invoiceNinjaAuth() }
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
// Service Auto-Login — Seamless auth for embedded services
// ---------------------------------------------------------------------------

// Provision accounts on all services when a new firm registers
async function provisionServiceAccounts(firmId, adminEmail, adminPassword) {
  const services = [
    "bigcapital",
    "paperless",
    "invoiceninja",
    "twenty",
    "kimai",
    "mattermost",
    "n8n",
    "metabase",
    "docuseal",
  ];

  for (const service of services) {
    try {
      let token = null;
      let username = adminEmail;
      let password = adminPassword;
      let metadata = null;

      switch (service) {
        case "paperless": {
          // Paperless: create user via API and get token
          const paperlessAdmin = {
            username: process.env.PAPERLESS_ADMIN_USER || "admin",
            password: process.env.PAPERLESS_ADMIN_PASSWORD || "admin",
          };
          // Login as admin first
          const loginRes = await fetch(`${SERVICES.paperless}/api/token/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(paperlessAdmin),
          }).catch(() => null);
          if (loginRes?.ok) {
            const loginData = await loginRes.json();
            token = loginData.token;
          }
          break;
        }
        case "invoiceninja": {
          // Invoice Ninja: use the admin API token
          token = process.env.INVOICE_NINJA_API_TOKEN || "";
          break;
        }
        case "kimai": {
          // Kimai: use admin API credentials
          token = process.env.KIMAI_API_TOKEN || "";
          username = process.env.KIMAI_API_USER || adminEmail;
          break;
        }
        case "n8n": {
          // n8n: use basic auth credentials
          username = process.env.N8N_BASIC_AUTH_USER || "admin";
          password = process.env.N8N_BASIC_AUTH_PASSWORD || "";
          break;
        }
        case "mattermost": {
          // Mattermost: login via API
          const mmRes = await fetch(`${SERVICES.mattermost}/api/v4/users/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ login_id: adminEmail, password: adminPassword }),
          }).catch(() => null);
          if (mmRes?.ok) {
            token = mmRes.headers.get("token") || "";
          }
          break;
        }
        case "bigcapital": {
          // Bigcapital: use admin credentials
          username = adminEmail;
          password = adminPassword;
          break;
        }
        case "twenty": {
          // Twenty: use admin credentials
          username = adminEmail;
          password = adminPassword;
          break;
        }
        case "metabase": {
          // Metabase: login via API
          const mbRes = await fetch(`${SERVICES.metabase}/api/session`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: adminEmail, password: adminPassword }),
          }).catch(() => null);
          if (mbRes?.ok) {
            const mbData = await mbRes.json();
            token = mbData.id;
          }
          break;
        }
        case "docuseal": {
          // DocuSeal: use admin API token
          token = process.env.DOCUSEAL_API_TOKEN || "";
          break;
        }
      }

      await prisma.serviceCredential.upsert({
        where: { firmId_service: { firmId, service } },
        create: { firmId, service, token, username, password, metadata },
        update: { token, username, password, metadata },
      });
    } catch (err) {
      console.error(`Failed to provision ${service} for firm ${firmId}:`, err.message);
    }
  }
}

// Get service credentials for a firm
app.get("/api/firms/:firmId/service-credentials", async (req, res) => {
  try {
    const creds = await prisma.serviceCredential.findMany({
      where: { firmId: req.params.firmId },
      select: { service: true, token: true, username: true, metadata: true },
    });
    res.json(creds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auto-login endpoint: returns authenticated iframe URL for a service
app.get("/api/firms/:firmId/service-auth/:service", async (req, res) => {
  try {
    const { firmId, service } = req.params;
    const cred = await prisma.serviceCredential.findUnique({
      where: { firmId_service: { firmId, service } },
    });

    if (!cred) {
      return res.status(404).json({ error: `No credentials for ${service}` });
    }

    let authUrl = null;
    let authHeaders = {};

    switch (service) {
      case "paperless":
        // Paperless supports token auth via cookie or header
        authUrl = `${SERVICES.paperless}/`;
        authHeaders = { Authorization: `Token ${cred.token}` };
        break;
      case "invoiceninja":
        authUrl = `${SERVICES.invoiceninja}/`;
        authHeaders = { "X-API-TOKEN": cred.token };
        break;
      case "bigcapital":
        authUrl = `${SERVICES.bigcapital || "http://localhost:3001"}/`;
        break;
      case "twenty":
        authUrl = `${SERVICES.twenty}/`;
        break;
      case "kimai":
        authUrl = `${SERVICES.kimai}/`;
        authHeaders = {
          "X-AUTH-USER": cred.username,
          "X-AUTH-TOKEN": cred.token,
        };
        break;
      case "n8n":
        authUrl = `${SERVICES.n8n}/`;
        break;
      case "metabase":
        authUrl = `${SERVICES.metabase}/`;
        break;
      case "mattermost":
        authUrl = `${SERVICES.mattermost}/`;
        break;
      case "docuseal":
        authUrl = `${SERVICES.docuseal || "http://localhost:3003"}/`;
        break;
    }

    res.json({ url: authUrl, headers: authHeaders, service });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Auto-Login Bridge — serves HTML that auto-logs into each service
// Nginx proxies https://<service>.maxed.life/maxed-auth → here
// Since the page is same-origin with the service, cookies/localStorage work
// ---------------------------------------------------------------------------
const BRIDGE_EMAIL = process.env.SERVICE_ADMIN_EMAIL || "admin@maxed.life";
const BRIDGE_PASSWORD = process.env.SERVICE_ADMIN_PASSWORD || "";
const BRIDGE_MM_USER = process.env.MATTERMOST_ADMIN_USER || "maxed-admin";

function bridgeHtml(title, script) {
  return `<!DOCTYPE html><html><head><title>${title}</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#f9fafb;color:#6b7280;}
.loader{width:24px;height:24px;border:3px solid #e5e7eb;border-top-color:#3b82f6;border-radius:50%;animation:spin .6s linear infinite;margin-right:12px;}
@keyframes spin{to{transform:rotate(360deg)}}</style></head>
<body><div class="loader"></div>Connecting to ${title}...</body>
<script>${script}</script></html>`;
}

app.get("/bridge/:service", (req, res) => {
  const { service } = req.params;
  const e = BRIDGE_EMAIL;
  const p = BRIDGE_PASSWORD;
  let html;

  switch (service) {
    case "kimai":
      // Symfony form login — fetch login page for CSRF token, then submit form
      html = bridgeHtml("Time Tracking", `
        fetch('/en/login').then(r=>r.text()).then(h=>{
          const m=h.match(/name="_csrf_token"\\s+value="([^"]+)"/);
          const f=document.createElement('form');f.method='POST';f.action='/en/login_check';
          f.innerHTML='<input name="_username" value="${e}"><input name="_password" value="${p}"><input name="_csrf_token" value="'+(m?m[1]:'')+'">';
          document.body.appendChild(f);f.submit();
        }).catch(()=>location.href='/');
      `);
      break;

    case "mattermost":
      // API login — sets MMAUTHTOKEN cookie
      html = bridgeHtml("Team Chat", `
        fetch('/api/v4/users/login',{method:'POST',headers:{'Content-Type':'application/json'},
          credentials:'include',body:JSON.stringify({login_id:'${BRIDGE_MM_USER}',password:'${p}'})
        }).then(()=>location.href='/').catch(()=>location.href='/');
      `);
      break;

    case "metabase":
      // API login — returns session ID, set as cookie
      html = bridgeHtml("Reporting", `
        fetch('/api/session',{method:'POST',headers:{'Content-Type':'application/json'},
          credentials:'include',body:JSON.stringify({username:'${e}',password:'${p}'})
        }).then(r=>r.json()).then(d=>{
          if(d.id)document.cookie='metabase.SESSION='+d.id+';path=/;SameSite=Lax';
          location.href='/';
        }).catch(()=>location.href='/');
      `);
      break;

    case "twenty":
      // API login — sets cookie
      html = bridgeHtml("CRM", `
        fetch('/api/auth/sign-in',{method:'POST',headers:{'Content-Type':'application/json'},
          credentials:'include',body:JSON.stringify({email:'${e}',password:'${p}'})
        }).then(r=>r.json()).then(d=>{
          if(d.loginToken){
            fetch('/api/auth/tokens/renew',{method:'POST',headers:{'Content-Type':'application/json'},
              credentials:'include',body:JSON.stringify({loginToken:d.loginToken})
            }).then(()=>location.href='/').catch(()=>location.href='/');
          } else location.href='/';
        }).catch(()=>location.href='/');
      `);
      break;

    case "bigcapital":
      // API login — returns JWT, store in localStorage
      html = bridgeHtml("Bookkeeping", `
        fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({email:'${e}',password:'${p}'})
        }).then(r=>r.json()).then(d=>{
          if(d.token)localStorage.setItem('token',d.token);
          if(d.tenant)localStorage.setItem('tenant_id',d.tenant.id);
          location.href='/';
        }).catch(()=>location.href='/');
      `);
      break;

    case "invoiceninja":
      // API login — specific IN5 flow
      html = bridgeHtml("Invoicing", `
        fetch('/api/v1/login',{method:'POST',headers:{'Content-Type':'application/json',
          'X-Requested-With':'XMLHttpRequest'},
          body:JSON.stringify({email:'${e}',password:'${p}'})
        }).then(r=>r.json()).then(d=>{
          if(d.data&&d.data[0]&&d.data[0].token)
            localStorage.setItem('X-NINJA-TOKEN',d.data[0].token.token);
          location.href='/';
        }).catch(()=>location.href='/');
      `);
      break;

    case "docuseal":
      // Rails form login
      html = bridgeHtml("Proposals", `
        fetch('/sign_in',{method:'GET',credentials:'include'}).then(r=>r.text()).then(h=>{
          const m=h.match(/name="authenticity_token"\\s+value="([^"]+)"/)||h.match(/csrf-token.*?content="([^"]+)"/);
          const f=document.createElement('form');f.method='POST';f.action='/sign_in';
          f.innerHTML='<input name="user[email]" value="${e}"><input name="user[password]" value="${p}"><input name="authenticity_token" value="'+(m?m[1]:'')+'">';
          document.body.appendChild(f);f.submit();
        }).catch(()=>location.href='/');
      `);
      break;

    case "n8n":
      // n8n owner login
      html = bridgeHtml("Workflows", `
        fetch('/rest/login',{method:'POST',headers:{'Content-Type':'application/json'},
          credentials:'include',body:JSON.stringify({email:'${e}',password:'${p}'})
        }).then(()=>location.href='/').catch(()=>location.href='/');
      `);
      break;

    case "paperless":
      // Already auto-logins via PAPERLESS_AUTO_LOGIN_USERNAME
      html = bridgeHtml("Documents", `location.href='/';`);
      break;

    default:
      return res.status(404).send("Unknown service");
  }

  res.type("html").send(html);
});

// ---------------------------------------------------------------------------
// Bigcapital proxy — Accounting & bookkeeping
// ---------------------------------------------------------------------------
const bigcapitalAuth = async () => {
  const token = await getBigcapitalToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tokenCache.bigcapital_tenant) headers["x-tenant-id"] = String(tokenCache.bigcapital_tenant);
  return headers;
};

app.get("/api/services/bigcapital/accounts", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.bigcapital, "/api/accounts", {
      headers: await bigcapitalAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

app.get("/api/services/bigcapital/transactions", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const result = await proxyFetch(
      SERVICES.bigcapital,
      `/api/transactions?page=${page}&page_size=50`,
      { headers: await bigcapitalAuth() }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

app.get("/api/services/bigcapital/balance-sheet", async (_req, res) => {
  try {
    const result = await proxyFetch(
      SERVICES.bigcapital,
      "/api/financial-statements/balance-sheet",
      { headers: await bigcapitalAuth() }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

app.get("/api/services/bigcapital/profit-loss", async (_req, res) => {
  try {
    const result = await proxyFetch(
      SERVICES.bigcapital,
      "/api/financial-statements/profit-loss-sheet",
      { headers: await bigcapitalAuth() }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Twenty CRM proxy — Customer relationship management
// ---------------------------------------------------------------------------
const twentyAuth = async () => {
  const token = await getTwentyToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

app.get("/api/services/twenty/companies", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/companies", {
      headers: await twentyAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Twenty CRM unavailable", detail: err.message });
  }
});

app.get("/api/services/twenty/people", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/people", {
      headers: await twentyAuth(),
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
      headers: await twentyAuth(),
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
      headers: await twentyAuth(),
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
let metabaseSession = null;
async function getMetabaseSession() {
  if (metabaseSession) return metabaseSession;
  const email = process.env.SERVICE_ADMIN_EMAIL || "admin@maxed.life";
  const password = process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.metabase}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });
    if (r.ok) {
      const data = await r.json();
      metabaseSession = data.id;
      return metabaseSession;
    }
  } catch {}
  return null;
}

app.get("/api/services/metabase/dashboards", async (_req, res) => {
  try {
    const session = await getMetabaseSession();
    if (!session) return res.status(401).json({ error: "Metabase session unavailable" });
    const result = await proxyFetch(SERVICES.metabase, "/api/dashboard", {
      headers: { "X-Metabase-Session": session },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Metabase unavailable", detail: err.message });
  }
});

app.get("/api/services/metabase/questions", async (_req, res) => {
  try {
    const session = await getMetabaseSession();
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
    const session = await getMetabaseSession();
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
let mattermostToken = null;
async function getMattermostToken() {
  if (mattermostToken) return mattermostToken;
  const user = process.env.MATTERMOST_ADMIN_USER || "maxed-admin";
  const pass = process.env.SERVICE_ADMIN_PASSWORD || "";
  try {
    const r = await fetch(`${SERVICES.mattermost}/api/v4/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: user, password: pass }),
    });
    if (r.ok) {
      mattermostToken = r.headers.get("token");
      return mattermostToken;
    }
  } catch {}
  return null;
}

app.get("/api/services/mattermost/channels", async (_req, res) => {
  try {
    const token = await getMattermostToken();
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
    const token = await getMattermostToken();
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
    const token = await getMattermostToken();
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

app.get("/api/services/mattermost/teams", async (_req, res) => {
  try {
    const token = await getMattermostToken();
    if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
    const result = await proxyFetch(SERVICES.mattermost, "/api/v4/teams", {
      headers: { Authorization: "Bearer " + token },
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
  }
});

app.get("/api/services/mattermost/users", async (_req, res) => {
  try {
    const token = await getMattermostToken();
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

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Maxed platform API running on http://localhost:${PORT}`);
});
