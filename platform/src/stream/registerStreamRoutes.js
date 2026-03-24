module.exports = function registerStreamRoutes(app, deps) {
  const { eventStore } = deps;

  app.get("/api/stream/events", (req, res) => {
    const limit = Number(req.query.limit || 100);
    res.json({
      items: eventStore.list(limit),
    });
  });

  app.post("/api/stream/events", async (req, res) => {
    try {
      const event = await eventStore.append(req.body || {});
      return res.status(201).json(event);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/stream/events/live", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const unsubscribe = eventStore.subscribe((event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    req.on("close", () => {
      unsubscribe();
      res.end();
    });
  });

  app.get("/api/stream/status", (_req, res) => {
    res.json({
      mode: "runtime-events",
      storage: eventStore.eventLogPath,
    });
  });
};
