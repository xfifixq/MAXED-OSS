const { canAccessFirm } = require("../shared/tenantAccess");

function extractFirmIdFromStoragePath(relativePath) {
  const match = String(relativePath || "").match(/^dashboard\/([^/]+)\//);
  return match ? match[1] : null;
}

module.exports = function registerStorageRoutes(app, deps) {
  const {
    supabase,
    resolveStorageTarget,
    buildPublicApiBase,
    writeManagedStorageObject,
  } = deps;

  app.post("/api/storage/upload", async (req, res) => {
    try {
      const { bucket = "documents", path: relativePath, base64Data, contentType } = req.body;
      if (!relativePath || !base64Data) {
        return res.status(400).json({ error: "path and base64Data required" });
      }

      const firmId = extractFirmIdFromStoragePath(relativePath);
      if (firmId && !canAccessFirm(req, firmId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const buffer = Buffer.from(base64Data, "base64");
      const storage = await writeManagedStorageObject({
        bucket,
        relativePath,
        buffer,
        contentType,
      });

      return res.json(storage);
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/storage/url", async (req, res) => {
    try {
      const { bucket = "documents", path: relativePath } = req.query;
      if (!relativePath) return res.status(400).json({ error: "path required" });

      const firmId = extractFirmIdFromStoragePath(relativePath);
      if (firmId && !canAccessFirm(req, firmId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (supabase) {
        const { data } = supabase.storage.from(String(bucket)).getPublicUrl(String(relativePath));
        return res.json({ provider: "supabase", url: data.publicUrl });
      }

      const target = resolveStorageTarget(bucket, relativePath);
      await deps.fs.access(target.absolutePath);

      const baseUrl = buildPublicApiBase(req);
      return res.json({
        provider: "local",
        url: `${baseUrl}/api/storage/file?bucket=${encodeURIComponent(target.bucket)}&path=${encodeURIComponent(target.relativePath)}`,
      });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  });

  app.get("/api/storage/file", async (req, res) => {
    try {
      const { bucket = "documents", path: relativePath } = req.query;
      if (!relativePath) return res.status(400).json({ error: "path required" });

      const firmId = extractFirmIdFromStoragePath(relativePath);
      if (firmId && !canAccessFirm(req, firmId)) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const target = resolveStorageTarget(bucket, relativePath);
      await deps.fs.access(target.absolutePath);
      return res.sendFile(target.absolutePath);
    } catch (err) {
      if (err?.code === "ENOENT") {
        return res.status(404).json({ error: "File not found" });
      }
      res.status(err.status || 500).json({ error: err.message });
    }
  });
};
