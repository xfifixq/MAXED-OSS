function clearServiceRuntimeCaches(firmId, service, deps) {
  deps.credentialCache.delete(`${firmId}:${service}`);
  if (service === "metabase") deps.metabaseSessions.delete(firmId);
  if (service === "mattermost") deps.mattermostSessions.delete(firmId);
  if (service === "bigcapital") deps.bigcapitalSessions.delete(firmId);
  if (service === "invoiceninja") deps.invoiceNinjaSessions.delete(firmId);
}

function buildPublicServiceUrlsPayload(PUBLIC_SERVICES) {
  return PUBLIC_SERVICES;
}

function buildServiceCatalogPayload({
  SERVICE_CATALOG,
  PUBLIC_SERVICES,
  SERVICE_ACCESS_CAPABILITIES,
  SERVICE_PROVISIONING_ADAPTERS,
}) {
  return Object.values(SERVICE_CATALOG).map((service) => ({
    ...service,
    defaultUrl: PUBLIC_SERVICES[service.key] || null,
    accessCapability: SERVICE_ACCESS_CAPABILITIES[service.key] || null,
    provisioningAdapter: SERVICE_PROVISIONING_ADAPTERS[service.key] || null,
  }));
}

async function buildServiceStatusPayload(SERVICES) {
  const results = {};
  for (const [name, url] of Object.entries(SERVICES)) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${url}/`, { signal: controller.signal });
      clearTimeout(timeout);
      results[name] = { status: "connected", code: response.status };
    } catch {
      results[name] = { status: "unavailable" };
    }
  }
  return results;
}

async function buildServiceDiagnosePayload(req, getServiceCredential) {
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
  return diag;
}

module.exports = function registerControlPlaneRoutes(app, deps) {
  const {
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
  } = deps;

  app.get("/api/firms/:firmId/credentials", async (req, res) => {
    try {
      const creds = await prisma.serviceCredential.findMany({
        where: { firmId: req.params.firmId },
        select: { id: true, service: true, username: true, metadata: true, createdAt: true, token: true, password: true },
      });
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
      clearServiceRuntimeCaches(firmId, service, {
        credentialCache,
        metabaseSessions,
        mattermostSessions,
        bigcapitalSessions,
        invoiceNinjaSessions,
      });
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
      clearServiceRuntimeCaches(firmId, service, {
        credentialCache,
        metabaseSessions,
        mattermostSessions,
        bigcapitalSessions,
        invoiceNinjaSessions,
      });
      res.json({ ok: true });
    } catch (err) {
      if (err.code === "P2025") return res.json({ ok: true });
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/control-plane/urls", (_req, res) => {
    res.json(buildPublicServiceUrlsPayload(PUBLIC_SERVICES));
  });

  app.get("/api/control-plane/catalog", (_req, res) => {
    res.json(buildServiceCatalogPayload({
      SERVICE_CATALOG,
      PUBLIC_SERVICES,
      SERVICE_ACCESS_CAPABILITIES,
      SERVICE_PROVISIONING_ADAPTERS,
    }));
  });

  app.get("/api/services/urls", (_req, res) => {
    res.json(buildPublicServiceUrlsPayload(PUBLIC_SERVICES));
  });

  app.get("/api/services/catalog", (_req, res) => {
    res.json(buildServiceCatalogPayload({
      SERVICE_CATALOG,
      PUBLIC_SERVICES,
      SERVICE_ACCESS_CAPABILITIES,
      SERVICE_PROVISIONING_ADAPTERS,
    }));
  });

  app.get("/api/firms/:firmId/provisioning/overview", async (req, res) => {
    try {
      const { firmId } = req.params;
      const results = {};
      const planned = await ensureFirmServiceAccountPlan(firmId);

      for (const service of Object.values(SERVICE_CATALOG)) {
        const cred = await getServiceCredential(firmId, service.key);
        const plannedAccounts = planned?.plan?.filter((entry) => entry.service === service.key) || [];
        const firmUserAccount = plannedAccounts.find((entry) => entry.role === "firm_user") || null;
        const hasFirmCred = !!cred?.token || (!!cred?.username && !!cred?.password) || !!cred?.username;
        const isProvisioningVerified = firmUserAccount?.status === "verified";
        const isProvisioningPending = Boolean(firmUserAccount) && !isProvisioningVerified;
        const liveProbe = await probeServiceAccess(firmId, service.key);
        const healthState = liveProbe.ok
          ? "connected"
          : (hasFirmCred || isProvisioningPending)
            ? "degraded"
            : "disconnected";

        results[service.key] = {
          ...service,
          configured: hasFirmCred || isProvisioningPending || isProvisioningVerified,
          health: healthState,
          source: hasFirmCred ? "firm" : (isProvisioningPending || isProvisioningVerified ? "planned" : "none"),
          provisioningVerified: isProvisioningVerified && liveProbe.ok,
          provisioningStatus: firmUserAccount?.status || null,
          liveProbe,
          accessCapability: SERVICE_ACCESS_CAPABILITIES[service.key] || null,
          provisioningAdapter: SERVICE_PROVISIONING_ADAPTERS[service.key] || null,
          launch: {
            service: buildPublicServiceUrl(service.key),
            setup: buildPublicServiceUrl(service.key, service.setupPath || ""),
            admin: buildPublicServiceUrl(service.key, service.adminPath || ""),
          },
        };
      }

      res.json({
        firmId,
        services: results,
        summary: {
          connected: Object.values(results).filter((entry) => entry.health === "connected").length,
          configured: Object.values(results).filter((entry) => entry.configured).length,
          coreConnected: Object.values(results).filter((entry) => entry.core && entry.health === "connected").length,
          coreTotal: Object.values(results).filter((entry) => entry.core).length,
        },
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/identity-workspace", async (req, res) => {
    try {
      const { firmId } = req.params;
      const planned = await ensureFirmServiceAccountPlan(firmId);
      const firm = planned?.firm || null;

      if (!firm) return res.status(404).json({ error: "Firm not found" });

      const identity = planned.identity;
      const services = {};

      for (const service of Object.values(SERVICE_CATALOG)) {
        const cred = await getServiceCredential(firmId, service.key);
        const shape = getServiceIdentityShape(service.key);
        const plannedAccounts = planned.plan.filter((entry) => entry.service === service.key);
        services[service.key] = {
          key: service.key,
          name: service.name,
          accountType: shape.accountType,
          bootstrapRequired: shape.bootstrapRequired,
          summary: shape.summary,
          recommendedWorkspace: buildPublicServiceUrl(
            service.key,
            service.setupPath || service.adminPath || "",
          ),
          suggestedIdentifier:
            service.key === "n8n"
              ? "API key stored in Maxed"
              : identity.canonicalEmail,
          credentialsSaved: !!cred?.token || !!cred?.username || !!cred?.password,
          plannedAccounts: plannedAccounts.map((entry) => ({
            id: entry.id,
            role: entry.role,
            identifier: entry.identifier,
            status: entry.status,
            notes: entry.notes,
            teamMemberId: entry.teamMemberId,
          })),
        };
      }

      res.json({
        firm: {
          id: firm.id,
          name: firm.name,
          email: firm.email,
        },
        canonicalIdentity: identity,
        universalProcess: [
          "Use one bootstrap admin only when a service needs first-run setup.",
          "Create or confirm one canonical CPA user identity for the firm across services.",
          "Store that service login or API key in Maxed.",
          "Verify the service turns green before handoff.",
        ],
        services,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/service-accounts", async (req, res) => {
    try {
      const planned = await ensureFirmServiceAccountPlan(req.params.firmId);
      if (!planned?.firm) return res.status(404).json({ error: "Firm not found" });

      const accounts = supportsFirmServiceAccounts
        ? await prisma.firmServiceAccount.findMany({
            where: { firmId: req.params.firmId },
            include: {
              teamMember: {
                select: { id: true, name: true, email: true, role: true },
              },
            },
            orderBy: [{ service: "asc" }, { role: "asc" }],
          })
        : planned.plan;

      res.json(accounts);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/provisioning/runs", async (req, res) => {
    try {
      const runs = supportsProvisioningRuns
        ? await prisma.serviceProvisioningRun.findMany({
            where: { firmId: req.params.firmId },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : [];
      res.json(runs);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/provisioning/:service/execute", async (req, res) => {
    try {
      const platformSession = await resolvePlatformSessionFromRequest(req);
      const requestedById = platformSession?.teamMemberId || null;
      const result = await executeProvisioningRun({
        firmId: req.params.firmId,
        service: req.params.service,
        requestedById,
      });
      const liveProbe = await probeServiceAccess(req.params.firmId, req.params.service);
      res.json({
        ...result,
        liveProbe,
        verified: result.output?.provisioningVerified !== false && liveProbe.ok,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/provisioning/execute-all", async (req, res) => {
    try {
      const platformSession = await resolvePlatformSessionFromRequest(req);
      const requestedById = platformSession?.teamMemberId || null;
      const provisioning = await provisionFirmServices({
        firmId: req.params.firmId,
        requestedById,
      });

      res.json({
        firmId: req.params.firmId,
        summary: {
          total: provisioning.total,
          succeeded: provisioning.succeeded,
          failed: provisioning.failed,
        },
        results: provisioning.results,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/access-policy", async (req, res) => {
    try {
      const { firmId } = req.params;
      const planned = await ensureFirmServiceAccountPlan(firmId);
      if (!planned?.firm) return res.status(404).json({ error: "Firm not found" });

      const policy = {};
      for (const service of Object.values(SERVICE_CATALOG)) {
        const cred = await getServiceCredential(firmId, service.key);
        const configured = !!cred?.token || !!cred?.username || !!cred?.password;
        const liveProbe = await probeServiceAccess(firmId, service.key);
        const accessCapability = SERVICE_ACCESS_CAPABILITIES[service.key] || {
          browserSessionBroker: false,
          cpaMode: "maxed_native_only",
          adminMode: "setup_and_exception_handoff",
        };
        policy[service.key] = {
          key: service.key,
          name: service.name,
          workspacePath: SERVICE_WORKSPACE_PATHS[service.key] || "/dashboard",
          cpaAccessMode: accessCapability.cpaMode,
          upstreamAccessMode: accessCapability.adminMode,
          configured,
          liveProbe,
          bootstrapRequired: getServiceIdentityShape(service.key).bootstrapRequired,
          browserSessionBroker: accessCapability.browserSessionBroker,
          provisioningAdapter: SERVICE_PROVISIONING_ADAPTERS[service.key] || null,
        };
      }

      res.json({
        firmId,
        identityProvider: "maxed",
        model: "maxed_first_control_plane",
        cpaAccess: "maxed_native_workspaces",
        upstreamAccess: "platform_admin_setup_only",
        note: "CPAs should work from Maxed-native modules first. Raw upstream app access is reserved for bootstrap, provisioning, and exception handling.",
        services: policy,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/control-plane/services", async (req, res) => {
    try {
      const { firmId } = req.params;
      const planned = await ensureFirmServiceAccountPlan(firmId);
      if (!planned?.firm) return res.status(404).json({ error: "Firm not found" });

      const services = {};
      for (const service of Object.values(SERVICE_CATALOG)) {
        const credential = await getServiceCredential(firmId, service.key);
        const liveProbe = await probeServiceAccess(firmId, service.key);
        const configured = !!credential?.token || !!credential?.username || !!credential?.password;
        services[service.key] = {
          key: service.key,
          name: service.name,
          workspacePath: SERVICE_WORKSPACE_PATHS[service.key] || "/dashboard",
          configured,
          source: configured ? "firm" : "none",
          health: !configured ? "disconnected" : liveProbe.ok ? "connected" : "degraded",
          identityShape: getServiceIdentityShape(service.key),
          access: SERVICE_ACCESS_CAPABILITIES[service.key] || null,
          provisioning: SERVICE_PROVISIONING_ADAPTERS[service.key] || null,
          liveProbe,
        };
      }

      res.json({
        firm: {
          id: planned.firm.id,
          name: planned.firm.name,
          email: planned.firm.email,
        },
        model: "maxed_control_plane",
        note: "Service health is derived from live connector probes, not provisioning intent alone.",
        services,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/broker-sessions", async (req, res) => {
    try {
      const sessions = supportsBrokerSessions
        ? await prisma.serviceBrokerSession.findMany({
            where: { firmId: req.params.firmId },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : [];
      res.json(sessions);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/broker/:service/session", async (req, res) => {
    try {
      const { firmId, service } = req.params;
      const targetPath = normalizeBridgeTarget(req.body?.targetPath || req.body?.target || "");
      const accessCapability = SERVICE_ACCESS_CAPABILITIES[service];
      if (!accessCapability) return res.status(404).json({ error: "Service not supported" });

      const platformSession = await resolvePlatformSessionFromRequest(req);
      const brokerSession = supportsBrokerSessions
        ? await prisma.serviceBrokerSession.create({
            data: {
              firmId,
              service,
              mode: accessCapability.browserSessionBroker ? "browser_broker" : "maxed_workspace_redirect",
              platformSessionId: platformSession?.id || null,
              targetPath,
              state: accessCapability.browserSessionBroker ? "ready" : "fallback_required",
              payloadJson: JSON.stringify({
                workspaceUrl: getMaxedWorkspaceUrl(service),
                adminUrl: buildPublicServiceUrl(
                  service,
                  SERVICE_CATALOG[service]?.setupPath || SERVICE_CATALOG[service]?.adminPath || "",
                ),
                accessCapability,
              }),
              expiresAt: new Date(Date.now() + BROKER_SESSION_TTL_MS),
            },
          })
        : {
            id: `synthetic:${firmId}:${service}:${Date.now()}`,
            mode: accessCapability.browserSessionBroker ? "browser_broker" : "maxed_workspace_redirect",
            state: accessCapability.browserSessionBroker ? "ready" : "fallback_required",
          };

      res.json({
        id: brokerSession.id,
        service,
        mode: brokerSession.mode,
        state: brokerSession.state,
        workspaceUrl: getMaxedWorkspaceUrl(service),
        browserSessionBroker: accessCapability.browserSessionBroker,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put("/api/firms/:firmId/service-accounts/:service/:role", async (req, res) => {
    try {
      if (!supportsFirmServiceAccounts) {
        return res.status(503).json({ error: "Service account persistence is unavailable until Prisma client is regenerated on the server." });
      }

      const { firmId, service, role } = req.params;
      const { identifier, status, notes, teamMemberId } = req.body || {};

      const existing = await prisma.firmServiceAccount.findUnique({
        where: { firmId_service_role: { firmId, service, role } },
      });

      if (!existing) {
        return res.status(404).json({ error: "Service account plan not found" });
      }

      const updated = await prisma.firmServiceAccount.update({
        where: { firmId_service_role: { firmId, service, role } },
        data: {
          identifier: typeof identifier === "string" && identifier.trim() ? identifier.trim() : existing.identifier,
          status: typeof status === "string" && status.trim() ? status.trim() : existing.status,
          notes: typeof notes === "string" ? notes : existing.notes,
          teamMemberId: teamMemberId === null || teamMemberId === undefined ? existing.teamMemberId : teamMemberId,
        },
      });

      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/provisioning/prepare/:service", async (req, res) => {
    try {
      const { firmId, service } = req.params;
      const firm = await prisma.firm.findUnique({
        where: { id: firmId },
        include: {
          teamMembers: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, email: true, role: true, createdAt: true },
          },
        },
      });

      if (!firm) return res.status(404).json({ error: "Firm not found" });
      if (!SERVICE_CATALOG[service]) return res.status(404).json({ error: "Service not supported" });

      const identity = buildCanonicalIdentity(firm, firm.teamMembers || []);
      const defaults = buildSuggestedServiceCredential(firm, identity, service);

      res.json({
        firmId,
        service,
        canonicalIdentity: {
          email: identity.canonicalEmail,
          memberId: identity.primaryMember?.id || null,
          memberName: identity.primaryMember?.name || null,
          role: identity.cpaRoleLabel,
        },
        suggested: defaults,
        note: SERVICE_CATALOG[service].note,
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/control-plane/status", async (_req, res) => {
    res.json(await buildServiceStatusPayload(SERVICES));
  });

  app.get("/api/control-plane/diagnose", async (req, res) => {
    res.json(await buildServiceDiagnosePayload(req, getServiceCredential));
  });

  app.get("/api/services/status", async (_req, res) => {
    res.json(await buildServiceStatusPayload(SERVICES));
  });

  app.get("/api/services/diagnose", async (req, res) => {
    res.json(await buildServiceDiagnosePayload(req, getServiceCredential));
  });
};
