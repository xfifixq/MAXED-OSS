require("dotenv").config();
const createPlatformApp = require("./src/runtime/createPlatformApp");
const registerPlatformRoutes = require("./src/platform/registerPlatformRoutes");
const registerOpenFrameRoutes = require("./src/openframe/registerOpenFrameRoutes");
const {
  SERVICES,
  PUBLIC_SERVICES,
  SERVICE_CATALOG,
  SERVICE_WORKSPACE_PATHS,
  SERVICE_ACCESS_CAPABILITIES,
  SERVICE_PROVISIONING_ADAPTERS,
  SERVICE_DEFAULT_TOKENS,
  slugifyName,
  generateStrongPassword,
  getPublicServiceUrl,
  buildPublicServiceUrl,
  getMaxedWorkspaceUrl,
  getServiceIdentityShape,
  buildCanonicalIdentity,
  buildSuggestedServiceCredential,
} = require("./src/openframe/serviceRegistry");
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");

const prisma = new PrismaClient();
const PORT = process.env.PORT || 4000;
const PLATFORM_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BROKER_SESSION_TTL_MS = 15 * 60 * 1000;
const LOCAL_STORAGE_ROOT = path.resolve(process.env.LOCAL_STORAGE_ROOT || path.join(__dirname, "storage"));

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

const app = createPlatformApp({
  requireAuth,
  supabaseConnected: !!supabase,
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

  if (!headerToken) return null;
  return resolvePlatformSession(headerToken);
}

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

registerPlatformRoutes(app, {
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
