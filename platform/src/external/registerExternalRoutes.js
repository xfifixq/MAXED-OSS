function escapeHtml(value) {
  return String(value || "")
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
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%); color: #0f172a; }
      .wrap { min-height: 100vh; display: grid; place-items: center; padding: 24px; }
      .card { width: 100%; max-width: 560px; background: rgba(255,255,255,0.96); border-radius: 24px; border: 1px solid rgba(148,163,184,0.24); box-shadow: 0 20px 60px rgba(15,23,42,0.12); padding: 32px; }
      .label { font-size: 12px; letter-spacing: 0.16em; text-transform: uppercase; color: #64748b; margin-bottom: 12px; }
      h1 { margin: 0 0 12px; font-size: 28px; }
      p { margin: 0 0 24px; color: #475569; line-height: 1.6; }
      a { display: inline-flex; align-items: center; justify-content: center; padding: 12px 18px; border-radius: 14px; background: #0f172a; color: #fff; text-decoration: none; font-weight: 600; }
    </style>
    ${autoRedirect ? `<meta http-equiv="refresh" content="1;url=${safeRedirectUrl}" />` : ""}
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="label">Maxed Gateway</div>
        <h1>${safeTitle}</h1>
        <p>${safeMessage}</p>
        <a href="${safeRedirectUrl}">Continue</a>
      </div>
    </div>
    ${autoRedirect ? `<script>setTimeout(function(){ window.location.replace(${JSON.stringify(redirectUrl)}); }, 900);</script>` : ""}
  </body>
</html>`;
}

module.exports = function registerExternalRoutes(app, deps) {
  const {
    SERVICE_CATALOG,
    SERVICE_ACCESS_CAPABILITIES,
    getPublicServiceUrl,
    getMaxedWorkspaceUrl,
    getServiceCredential = null,
  } = deps;

  app.get("/api/external/catalog", (_req, res) => {
    res.json({
      services: Object.values(SERVICE_CATALOG).map((service) => ({
        ...service,
        publicUrl: getPublicServiceUrl(service.key),
        maxedWorkspaceUrl: getMaxedWorkspaceUrl(service.key),
      })),
    });
  });

  app.get("/api/external/services/:service", (req, res) => {
    const service = req.params.service;
    const descriptor = SERVICE_CATALOG[service];
    if (!descriptor) {
      return res.status(404).json({ error: "Unknown service" });
    }

    return res.json({
      ...descriptor,
      publicUrl: getPublicServiceUrl(service),
      maxedWorkspaceUrl: getMaxedWorkspaceUrl(service),
      access: SERVICE_ACCESS_CAPABILITIES[service] || null,
    });
  });

  app.get("/bridge/:service", async (req, res) => {
    try {
      const service = req.params.service;
      const publicUrl = getPublicServiceUrl(service);
      const maxedWorkspaceUrl = getMaxedWorkspaceUrl(service);
      const access = SERVICE_ACCESS_CAPABILITIES[service];
      const sessionFirmId = typeof req.headers["x-maxed-firm-id"] === "string" ? req.headers["x-maxed-firm-id"] : "";
      const sessionUserId = typeof req.headers["x-maxed-user-id"] === "string" ? req.headers["x-maxed-user-id"] : "";
      const isPlatformAdmin = String(req.headers["x-maxed-platform-admin"] || "").toLowerCase() === "true";
      const requestedFirmId = typeof req.query.firmId === "string" ? req.query.firmId.trim() : "";
      const mode = req.query.mode === "direct" ? "direct" : "maxed";

      if (!SERVICE_CATALOG[service] || !publicUrl) {
        return res.status(404).send(bridgePage({
          title: "Workspace Unavailable",
          message: "This workspace is not configured in Maxed yet.",
          redirectUrl: "https://app.maxed.life/dashboard",
          autoRedirect: false,
        }));
      }

      if (!requestedFirmId) {
        return res.status(400).send(bridgePage({
          title: "Firm Session Missing",
          message: "Maxed could not determine which firm workspace to open. Return to the dashboard and try again.",
          redirectUrl: maxedWorkspaceUrl,
          autoRedirect: false,
        }));
      }

      if (!sessionUserId && !isPlatformAdmin) {
        return res.status(401).send(bridgePage({
          title: "Login Required",
          message: "Open the workspace from an authenticated Maxed session and try again.",
          redirectUrl: maxedWorkspaceUrl,
          autoRedirect: false,
        }));
      }

      if (!isPlatformAdmin && sessionFirmId && requestedFirmId !== sessionFirmId) {
        return res.status(403).send(bridgePage({
          title: "Workspace Access Denied",
          message: "This workspace request does not match the current firm session.",
          redirectUrl: maxedWorkspaceUrl,
          autoRedirect: false,
        }));
      }

      if (getServiceCredential) {
        const credential = await getServiceCredential(requestedFirmId, service);
        const hasSavedAccess = !!credential?.token || (!!credential?.username && !!credential?.password);
        if (!hasSavedAccess) {
          return res.status(401).send(bridgePage({
            title: "Workspace Credentials Required",
            message: "This workspace does not have saved credentials yet. Add the firm login and any API token in Maxed admin before opening it.",
            redirectUrl: maxedWorkspaceUrl,
            autoRedirect: false,
          }));
        }
      }

      if (mode === "direct") {
        return res.status(200).send(bridgePage({
          title: "Opening Live Module",
          message: access?.browserSessionBroker
            ? "Maxed is handing off to the live workspace for this firm."
            : "Maxed is opening the full upstream module for advanced actions that are not yet surfaced natively in the Maxed workspace.",
          redirectUrl: publicUrl,
        }));
      }

      return res.status(200).send(bridgePage({
        title: "Open In Maxed",
        message: "This workspace is controlled by Maxed. Continue into the Maxed workspace instead of the raw upstream app.",
        redirectUrl: maxedWorkspaceUrl,
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
};
