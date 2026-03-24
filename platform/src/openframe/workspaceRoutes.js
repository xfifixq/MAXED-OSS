module.exports = function registerWorkspaceRoutes(app, deps) {
  const {
    SERVICES,
    prisma,
    proxyFetch,
    paperlessAuth,
    kimaiAuth,
    docusealAuth,
    n8nAuth,
    twentyAuth,
    invoiceNinjaAuth,
    getMattermostToken,
    getMetabaseSession,
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
    ensureInvoiceNinjaClient,
    invoiceNinjaResourceId,
  } = deps;

  app.get("/api/firms/:firmId/workspaces/bookkeeping", async (req, res) => {
    try {
      const workspace = await loadBookkeepingWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/documents", async (req, res) => {
    try {
      const workspace = await loadDocumentsWorkspace(req.params.firmId, req.query || {});
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/documents/:id/thumb", async (req, res) => {
    try {
      const url = `${SERVICES.paperless}/api/documents/${req.params.id}/thumb/`;
      const upstream = await fetch(url, { headers: await paperlessAuth(req.params.firmId) });
      res.set("Content-Type", upstream.headers.get("content-type") || "image/png");
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Paperless unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/documents/:id/download", async (req, res) => {
    try {
      const upstream = await fetch(`${SERVICES.paperless}/api/documents/${req.params.id}/download/`, {
        headers: await paperlessAuth(req.params.firmId),
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        return res.status(upstream.status).json({
          error: "Paperless download failed",
          detail,
        });
      }

      const contentType = upstream.headers.get("content-type");
      const contentDisposition = upstream.headers.get("content-disposition");
      if (contentType) res.set("Content-Type", contentType);
      if (contentDisposition) res.set("Content-Disposition", contentDisposition);
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Paperless unavailable", detail: err.message });
    }
  });

  app.patch("/api/firms/:firmId/workspaces/documents/:id", async (req, res) => {
    try {
      const upstream = await fetch(`${SERVICES.paperless}/api/documents/${req.params.id}/`, {
        method: "PATCH",
        headers: {
          ...(await paperlessAuth(req.params.firmId)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body || {}),
      });

      const text = await upstream.text();
      try {
        const json = text ? JSON.parse(text) : {};
        return res.status(upstream.status).json(json);
      } catch {
        return res.status(upstream.status).send(text);
      }
    } catch (err) {
      res.status(err.status || 502).json({ error: "Paperless unavailable", detail: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/documents/upload", async (req, res) => {
    try {
      const { clientId, filename, base64Data, contentType, title } = req.body || {};
      if (!clientId || !filename || !base64Data) {
        return res.status(400).json({ error: "clientId, filename, and base64Data are required" });
      }

      const client = await prisma.client.findFirst({
        where: { id: clientId, firmId: req.params.firmId },
      });
      if (!client) return res.status(404).json({ error: "Client not found" });

      const storagePath = `dashboard/${req.params.firmId}/${client.id}/${Date.now()}-${filename}`;
      const buffer = Buffer.from(base64Data, "base64");
      const storage = await writeManagedStorageObject({
        bucket: "documents",
        relativePath: storagePath,
        buffer,
        contentType: contentType || "application/octet-stream",
      });

      const localDocument = await prisma.document.create({
        data: {
          clientId: client.id,
          title: title || filename,
          type: contentType || "Document",
          status: "uploaded",
          paperlessDocId: storagePath,
        },
      });

      let paperless = null;
      let syncIssue = null;
      try {
        const form = new FormData();
        const blob = new Blob([buffer], { type: contentType || "application/octet-stream" });
        form.append("document", blob, filename);
        form.append("title", String(title || filename));
        if (client.paperlessTag) form.append("tags", String(client.paperlessTag));

        const upstream = await fetch(`${SERVICES.paperless}/api/documents/post_document/`, {
          method: "POST",
          headers: await paperlessAuth(req.params.firmId),
          body: form,
        });
        const text = await upstream.text();
        try {
          paperless = text ? JSON.parse(text) : {};
        } catch {
          paperless = text;
        }
        if (!upstream.ok) {
          syncIssue = {
            service: "paperless",
            operation: "upload",
            status: upstream.status,
            reason: "sync_failed",
            detail: stringifyConnectorDetail(paperless),
          };
        }
      } catch (err) {
        syncIssue = workspaceIssueFromError("paperless", "upload", err);
      }

      res.status(syncIssue ? 207 : 201).json({
        storage,
        localDocument,
        paperless,
        syncIssue,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/time-tracking", async (req, res) => {
    try {
      const workspace = await loadTimeTrackingWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/time-tracking/timesheets", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/timesheets", {
        method: "POST",
        headers: await kimaiAuth(req.params.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Kimai unavailable", detail: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/time-tracking/setup-records", async (req, res) => {
    try {
      const headers = await kimaiAuth(req.params.firmId);
      const payload = req.body || {};
      const issues = [];
      const created = {};

      if (payload.customerName?.trim()) {
        const result = await proxyFetch(SERVICES.kimai, "/api/customers", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: payload.customerName.trim() }),
        });
        if (statusOk(result.status)) created.customer = result.data;
        else issues.push(workspaceIssueFromResult("kimai", "create_customer", result));
      }

      if (payload.projectName?.trim() && payload.customerId) {
        const result = await proxyFetch(SERVICES.kimai, "/api/projects", {
          method: "POST",
          headers,
          body: JSON.stringify({
            name: payload.projectName.trim(),
            customer: Number(payload.customerId) || payload.customerId,
          }),
        });
        if (statusOk(result.status)) created.project = result.data;
        else issues.push(workspaceIssueFromResult("kimai", "create_project", result));
      }

      if (payload.activityName?.trim()) {
        const result = await proxyFetch(SERVICES.kimai, "/api/activities", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: payload.activityName.trim() }),
        });
        if (statusOk(result.status)) created.activity = result.data;
        else issues.push(workspaceIssueFromResult("kimai", "create_activity", result));
      }

      res.status(issues.length ? 207 : 201).json({ created, issues });
    } catch (err) {
      res.status(err.status || 502).json({ error: "Kimai unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/proposals", async (req, res) => {
    try {
      const workspace = await loadProposalsWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/proposals/submissions", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.docuseal, "/api/submissions", {
        method: "POST",
        headers: await docusealAuth(req.params.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "DocuSeal unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/workflows", async (req, res) => {
    try {
      const workspace = await loadWorkflowsWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/workflows/:id/activate", async (req, res) => {
    try {
      const active = req.body?.active !== false;
      const result = await proxyFetch(SERVICES.n8n, `/api/v1/workflows/${req.params.id}`, {
        method: "PATCH",
        headers: await n8nAuth(req.params.firmId),
        body: JSON.stringify({ active }),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "n8n unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/chat", async (req, res) => {
    try {
      const workspace = await loadChatWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/chat/teams/:teamId/channels", async (req, res) => {
    try {
      res.json(await loadChatChannelsWorkspace(req.params.firmId, req.params.teamId));
    } catch (err) {
      res.status(err.status || 502).json({ error: "Mattermost unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/chat/channels/:id/posts", async (req, res) => {
    try {
      res.json(await loadChatPostsWorkspace(req.params.firmId, req.params.id));
    } catch (err) {
      res.status(err.status || 502).json({ error: "Mattermost unavailable", detail: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/chat/channels/:id/posts", async (req, res) => {
    try {
      const token = await getMattermostToken(req.params.firmId);
      if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
      const result = await proxyFetch(SERVICES.mattermost, "/api/v4/posts", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Mattermost unavailable", detail: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/chat/channels", async (req, res) => {
    try {
      const token = await getMattermostToken(req.params.firmId);
      if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
      const result = await proxyFetch(SERVICES.mattermost, "/api/v4/channels", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Mattermost unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/crm", async (req, res) => {
    try {
      const workspace = await loadCrmWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/crm/companies", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.twenty, "/api/companies", {
        method: "POST",
        headers: await twentyAuth(req.params.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Twenty CRM unavailable", detail: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/crm/people", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.twenty, "/api/people", {
        method: "POST",
        headers: await twentyAuth(req.params.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Twenty CRM unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/invoicing", async (req, res) => {
    try {
      const workspace = await loadInvoicingWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/invoicing/invoices/:id", async (req, res) => {
    try {
      const result = await proxyFetch(
        SERVICES.invoiceninja,
        `/api/v1/invoices/${req.params.id}`,
        { headers: await invoiceNinjaAuth(req.params.firmId) },
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/invoicing/invoices/:id/download", async (req, res) => {
    try {
      const upstream = await fetch(`${SERVICES.invoiceninja}/api/v1/invoices/${req.params.id}/download`, {
        headers: await invoiceNinjaAuth(req.params.firmId),
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        return res.status(upstream.status).json({
          error: "Invoice Ninja download failed",
          detail,
        });
      }

      const contentType = upstream.headers.get("content-type");
      const contentDisposition = upstream.headers.get("content-disposition");
      if (contentType) res.set("Content-Type", contentType);
      if (contentDisposition) res.set("Content-Disposition", contentDisposition);
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/invoicing/invoices", async (req, res) => {
    try {
      const { clientId, amount, dueDate, description, status } = req.body || {};
      if (!clientId || !amount || !dueDate) {
        return res.status(400).json({ error: "clientId, amount, and dueDate are required" });
      }

      const { client, remoteClientId } = await ensureInvoiceNinjaClient(req.params.firmId, clientId);
      const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/invoices", {
        method: "POST",
        headers: await invoiceNinjaAuth(req.params.firmId),
        body: JSON.stringify({
          client_id: remoteClientId,
          due_date: new Date(dueDate).toISOString().slice(0, 10),
          line_items: [
            {
              product_key: description || "Accounting services",
              notes: description || "",
              cost: Number(amount),
              quantity: 1,
            },
          ],
        }),
      });

      if (result.status >= 400) {
        return res.status(result.status).json(result.data);
      }

      const invoiceNinjaId = invoiceNinjaResourceId(result.data);
      const localInvoice = await prisma.invoice.create({
        data: {
          clientId: client.id,
          amount: Number(amount),
          status: status || "draft",
          dueDate: new Date(dueDate),
          invoiceNinjaId: invoiceNinjaId || null,
        },
      });

      res.status(201).json({ localInvoice, remote: result.data });
    } catch (err) {
      res.status(err.status || 502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.post("/api/firms/:firmId/workspaces/invoicing/payments", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/payments", {
        method: "POST",
        headers: await invoiceNinjaAuth(req.params.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/reporting", async (req, res) => {
    try {
      const workspace = await loadReportingWorkspace(req.params.firmId);
      res.json(workspace);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/firms/:firmId/workspaces/reporting/dashboards/:id", async (req, res) => {
    try {
      const session = await getMetabaseSession(req.params.firmId);
      if (!session) return res.status(401).json({ error: "Metabase session unavailable" });
      const result = await proxyFetch(SERVICES.metabase, `/api/dashboard/${req.params.id}`, {
        headers: { "X-Metabase-Session": session },
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Metabase unavailable", detail: err.message });
    }
  });
};
