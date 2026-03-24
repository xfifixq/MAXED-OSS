module.exports = function registerLegacyServiceRoutes(app, deps) {
  const {
    SERVICES,
    prisma,
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
  } = deps;

  app.get("/api/services/paperless/documents", async (req, res) => {
    try {
      const { page = 1, search = "", tag = "", correspondent = "", documentType = "" } = req.query;
      const qs = new URLSearchParams({ page: String(page), ordering: "-created" });
      if (search) qs.set("query", String(search));
      if (tag) qs.set("tags__id", String(tag));
      if (correspondent) qs.set("correspondent__id", String(correspondent));
      if (documentType) qs.set("document_type__id", String(documentType));
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

  app.get("/api/services/paperless/documents/:id/download", async (req, res) => {
    try {
      const url = `${SERVICES.paperless}/api/documents/${req.params.id}/download/`;
      const upstream = await fetch(url, { headers: await paperlessAuth(req.firmId) });

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
      res.status(502).json({ error: "Paperless unavailable", detail: err.message });
    }
  });

  app.patch("/api/services/paperless/documents/:id", async (req, res) => {
    try {
      const upstream = await fetch(`${SERVICES.paperless}/api/documents/${req.params.id}/`, {
        method: "PATCH",
        headers: {
          ...(await paperlessAuth(req.firmId)),
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
      res.status(502).json({ error: "Paperless unavailable", detail: err.message });
    }
  });

  app.post("/api/services/paperless/documents/upload", async (req, res) => {
    try {
      const {
        filename,
        base64Data,
        contentType,
        title,
        created,
        correspondent,
        documentType,
        archiveSerialNumber,
        tags,
      } = req.body || {};

      if (!filename || !base64Data) {
        return res.status(400).json({ error: "filename and base64Data are required" });
      }

      const form = new FormData();
      const buffer = Buffer.from(base64Data, "base64");
      const blob = new Blob([buffer], { type: contentType || "application/octet-stream" });

      form.append("document", blob, filename);
      if (title) form.append("title", String(title));
      if (created) form.append("created", String(created));
      if (correspondent) form.append("correspondent", String(correspondent));
      if (documentType) form.append("document_type", String(documentType));
      if (archiveSerialNumber) form.append("archive_serial_number", String(archiveSerialNumber));

      const normalizedTags = Array.isArray(tags) ? tags : tags ? [tags] : [];
      normalizedTags.forEach((tag) => form.append("tags", String(tag)));

      const upstream = await fetch(`${SERVICES.paperless}/api/documents/post_document/`, {
        method: "POST",
        headers: await paperlessAuth(req.firmId),
        body: form,
      });

      const text = await upstream.text();
      try {
        const json = text ? JSON.parse(text) : {};
        return res.status(upstream.status).json(json);
      } catch {
        return res.status(upstream.status).send(text);
      }
    } catch (err) {
      res.status(502).json({ error: "Paperless unavailable", detail: err.message });
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

  app.get("/api/services/paperless/correspondents", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.paperless, "/api/correspondents/", {
        headers: await paperlessAuth(req.firmId),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Paperless unavailable", detail: err.message });
    }
  });

  app.get("/api/services/paperless/document-types", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.paperless, "/api/document_types/", {
        headers: await paperlessAuth(req.firmId),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Paperless unavailable", detail: err.message });
    }
  });

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
      const active = req.body?.active !== false;
      const result = await proxyFetch(
        SERVICES.n8n,
        `/api/v1/workflows/${req.params.id}`,
        {
          method: "PATCH",
          headers: await n8nAuth(req.firmId),
          body: JSON.stringify({ active }),
        }
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "n8n unavailable", detail: err.message });
    }
  });

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

  app.get("/api/services/kimai/customers", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/customers", {
        headers: await kimaiAuth(req.firmId),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Kimai unavailable", detail: err.message });
    }
  });

  app.post("/api/services/kimai/customers", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/customers", {
        method: "POST",
        headers: await kimaiAuth(req.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Kimai unavailable", detail: err.message });
    }
  });

  app.post("/api/services/kimai/projects", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/projects", {
        method: "POST",
        headers: await kimaiAuth(req.firmId),
        body: JSON.stringify(req.body),
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

  app.post("/api/services/kimai/activities", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.kimai, "/api/activities", {
        method: "POST",
        headers: await kimaiAuth(req.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Kimai unavailable", detail: err.message });
    }
  });

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

  app.get("/api/services/invoiceninja/invoices/:id", async (req, res) => {
    try {
      const result = await proxyFetch(
        SERVICES.invoiceninja,
        `/api/v1/invoices/${req.params.id}`,
        { headers: await invoiceNinjaAuth(req.firmId) }
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.get("/api/services/invoiceninja/invoices/:id/download", async (req, res) => {
    try {
      const upstream = await fetch(`${SERVICES.invoiceninja}/api/v1/invoices/${req.params.id}/download`, {
        headers: await invoiceNinjaAuth(req.firmId),
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

  app.post("/api/services/invoiceninja/firm-clients/:clientId/sync", async (req, res) => {
    try {
      const result = await ensureInvoiceNinjaClient(req.firmId, req.params.clientId);
      res.json(result);
    } catch (err) {
      res.status(err.status || 502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.post("/api/services/invoiceninja/firm-clients/:clientId/invoices", async (req, res) => {
    try {
      const { amount, dueDate, description, status } = req.body || {};
      if (!amount || !dueDate) {
        return res.status(400).json({ error: "amount and dueDate are required" });
      }

      const { client, remoteClientId } = await ensureInvoiceNinjaClient(req.firmId, req.params.clientId);
      const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/invoices", {
        method: "POST",
        headers: await invoiceNinjaAuth(req.firmId),
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

      res.status(201).json({
        localInvoice,
        remote: result.data,
      });
    } catch (err) {
      res.status(err.status || 502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.get("/api/services/invoiceninja/payments", async (req, res) => {
    try {
      const { page = 1 } = req.query;
      const result = await proxyFetch(
        SERVICES.invoiceninja,
        `/api/v1/payments?page=${page}&per_page=50&sort=created_at|desc`,
        { headers: await invoiceNinjaAuth(req.firmId) }
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

  app.post("/api/services/invoiceninja/payments", async (req, res) => {
    try {
      const result = await proxyFetch(SERVICES.invoiceninja, "/api/v1/payments", {
        method: "POST",
        headers: await invoiceNinjaAuth(req.firmId),
        body: JSON.stringify(req.body),
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Invoice Ninja unavailable", detail: err.message });
    }
  });

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
          "/api/reports/balance-sheet",
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
          "/api/reports/profit-loss-sheet",
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

  app.get("/api/services/mattermost/me", async (req, res) => {
    try {
      const token = await getMattermostToken(req.firmId);
      if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
      const result = await proxyFetch(SERVICES.mattermost, "/api/v4/users/me", {
        headers: { Authorization: "Bearer " + token },
      });
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
    }
  });

  app.get("/api/services/mattermost/teams/:teamId/channels", async (req, res) => {
    try {
      const token = await getMattermostToken(req.firmId);
      if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
      const result = await proxyFetch(
        SERVICES.mattermost,
        `/api/v4/users/me/teams/${req.params.teamId}/channels`,
        { headers: { Authorization: "Bearer " + token } }
      );
      res.status(result.status).json(result.data);
    } catch (err) {
      res.status(502).json({ error: "Mattermost unavailable", detail: err.message });
    }
  });

  app.post("/api/services/mattermost/channels", async (req, res) => {
    try {
      const token = await getMattermostToken(req.firmId);
      if (!token) return res.status(401).json({ error: "Mattermost auth unavailable" });
      const result = await proxyFetch(SERVICES.mattermost, "/api/v4/channels", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: JSON.stringify(req.body),
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
};
