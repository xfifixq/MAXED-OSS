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

    // Try to get the client to find their email for matching submissions
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { name: true, email: true },
    });

    // Try fetching submissions from DocuSeal
    const headers = docusealAuth();
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
// Service auth — uses API tokens from environment variables
// Configure these in your .env file after creating accounts in each service
// ---------------------------------------------------------------------------
function getPaperlessToken() {
  return process.env.PAPERLESS_API_TOKEN || null;
}

function getDocuSealToken() {
  return process.env.DOCUSEAL_API_TOKEN || null;
}

function getInvoiceNinjaToken() {
  return process.env.INVOICE_NINJA_API_TOKEN || null;
}

function getN8nToken() {
  return process.env.N8N_API_KEY || null;
}

function getKimaiToken() {
  return process.env.KIMAI_API_TOKEN || null;
}

function getBigcapitalToken() {
  return process.env.BIGCAPITAL_API_TOKEN || null;
}

function getTwentyToken() {
  return process.env.TWENTY_API_KEY || null;
}

// ---------------------------------------------------------------------------
// Paperless-ngx proxy — Document management
// ---------------------------------------------------------------------------
const paperlessAuth = () => {
  const token = getPaperlessToken();
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
      { headers: paperlessAuth() }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Paperless unavailable", detail: err.message });
  }
});

app.get("/api/services/paperless/documents/:id/thumb", async (req, res) => {
  try {
    const url = `${SERVICES.paperless}/api/documents/${req.params.id}/thumb/`;
    const upstream = await fetch(url, { headers: paperlessAuth() });
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
      headers: paperlessAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Paperless unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// DocuSeal proxy — E-signatures and proposals
// ---------------------------------------------------------------------------
const docusealAuth = () => {
  const token = getDocuSealToken();
  return token ? { "X-Auth-Token": token } : {};
};

app.get("/api/services/docuseal/templates", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.docuseal, "/api/templates", {
      headers: docusealAuth(),
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
      { headers: docusealAuth() }
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
      headers: docusealAuth(),
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
const n8nAuth = () => {
  const token = getN8nToken();
  return token ? { "X-N8N-API-KEY": token } : {};
};

app.get("/api/services/n8n/workflows", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.n8n, "/api/v1/workflows", {
      headers: n8nAuth(),
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
      { headers: n8nAuth() }
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
        headers: n8nAuth(),
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
const kimaiAuth = () => {
  const token = getKimaiToken();
  if (!token) return {};
  return {
    "X-AUTH-USER": process.env.KIMAI_API_USER || "admin@maxed.dev",
    "X-AUTH-TOKEN": token,
  };
};

app.get("/api/services/kimai/timesheets", async (req, res) => {
  try {
    const { page = 1, size = 50 } = req.query;
    const result = await proxyFetch(
      SERVICES.kimai,
      `/api/timesheets?page=${page}&size=${size}&order=DESC&orderBy=begin`,
      { headers: kimaiAuth() }
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
      headers: kimaiAuth(),
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
      headers: kimaiAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

app.get("/api/services/kimai/activities", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.kimai, "/api/activities", {
      headers: kimaiAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Kimai unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Invoice Ninja proxy — Invoicing
// ---------------------------------------------------------------------------
const invoiceNinjaAuth = () => {
  const token = getInvoiceNinjaToken();
  return token ? { "X-API-TOKEN": token, "X-Requested-With": "XMLHttpRequest" } : { "X-Requested-With": "XMLHttpRequest" };
};

app.get("/api/services/invoiceninja/invoices", async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const result = await proxyFetch(
      SERVICES.invoiceninja,
      `/api/v1/invoices?page=${page}&per_page=50&sort=created_at|desc`,
      { headers: invoiceNinjaAuth() }
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
      { headers: invoiceNinjaAuth() }
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
const bigcapitalAuth = () => {
  const token = getBigcapitalToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (process.env.BIGCAPITAL_TENANT_ID) headers["x-tenant-id"] = process.env.BIGCAPITAL_TENANT_ID;
  return headers;
};

app.get("/api/services/bigcapital/accounts", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.bigcapital, "/api/accounts", {
      headers: bigcapitalAuth(),
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
      { headers: bigcapitalAuth() }
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
      { headers: bigcapitalAuth() }
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
      { headers: bigcapitalAuth() }
    );
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Bigcapital unavailable", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Twenty CRM proxy — Customer relationship management
// ---------------------------------------------------------------------------
const twentyAuth = () => {
  const token = getTwentyToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

app.get("/api/services/twenty/companies", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/companies", {
      headers: twentyAuth(),
    });
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(502).json({ error: "Twenty CRM unavailable", detail: err.message });
  }
});

app.get("/api/services/twenty/people", async (_req, res) => {
  try {
    const result = await proxyFetch(SERVICES.twenty, "/api/people", {
      headers: twentyAuth(),
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
      headers: twentyAuth(),
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
      headers: twentyAuth(),
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
// Metabase: login with configured credentials to get a session token
let metabaseSession = null;
let metabaseSessionExpires = 0;
async function getMetabaseSession() {
  if (metabaseSession && Date.now() < metabaseSessionExpires) return metabaseSession;
  const email = process.env.METABASE_EMAIL || process.env.SERVICE_ADMIN_EMAIL;
  const password = process.env.METABASE_PASSWORD || process.env.SERVICE_ADMIN_PASSWORD;
  if (!email || !password) return null;
  try {
    const r = await fetch(`${SERVICES.metabase}/api/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: email, password }),
    });
    if (r.ok) {
      const data = await r.json();
      metabaseSession = data.id;
      metabaseSessionExpires = Date.now() + 12 * 3600000; // 12 hour cache
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
// Mattermost: login with configured credentials to get a session token
let mattermostToken = null;
let mattermostTokenExpires = 0;
async function getMattermostToken() {
  if (mattermostToken && Date.now() < mattermostTokenExpires) return mattermostToken;
  const user = process.env.MATTERMOST_USER || process.env.MATTERMOST_ADMIN_USER;
  const pass = process.env.MATTERMOST_PASSWORD || process.env.SERVICE_ADMIN_PASSWORD;
  if (!user || !pass) return null;
  try {
    const r = await fetch(`${SERVICES.mattermost}/api/v4/users/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login_id: user, password: pass }),
    });
    if (r.ok) {
      mattermostToken = r.headers.get("token");
      mattermostTokenExpires = Date.now() + 12 * 3600000; // 12 hour cache
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

// Diagnostic: check which service API tokens are configured
app.get("/api/services/diagnose", async (_req, res) => {
  const envCheck = (name, val) => ({ configured: !!val, token: val ? val.substring(0, 8) + "..." : null });
  const diag = {
    paperless: envCheck("PAPERLESS_API_TOKEN", process.env.PAPERLESS_API_TOKEN),
    invoiceninja: envCheck("INVOICE_NINJA_API_TOKEN", process.env.INVOICE_NINJA_API_TOKEN),
    kimai: envCheck("KIMAI_API_TOKEN", process.env.KIMAI_API_TOKEN),
    n8n: envCheck("N8N_API_KEY", process.env.N8N_API_KEY),
    docuseal: envCheck("DOCUSEAL_API_TOKEN", process.env.DOCUSEAL_API_TOKEN),
    bigcapital: envCheck("BIGCAPITAL_API_TOKEN", process.env.BIGCAPITAL_API_TOKEN),
    twenty: envCheck("TWENTY_API_KEY", process.env.TWENTY_API_KEY),
    metabase: { configured: !!(process.env.METABASE_EMAIL && process.env.METABASE_PASSWORD), session: !!metabaseSession },
    mattermost: { configured: !!(process.env.MATTERMOST_USER || process.env.MATTERMOST_ADMIN_USER), session: !!mattermostToken },
  };
  res.json(diag);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Maxed platform API running on http://localhost:${PORT}`);
});
