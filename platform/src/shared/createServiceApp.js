const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

function matchesPublicPath(req, publicPaths) {
  return publicPaths.some((entry) => {
    if (!entry) return false;
    if (typeof entry === "function") return entry(req);
    if (entry instanceof RegExp) return entry.test(req.path);
    return req.path === entry;
  });
}

module.exports = function createServiceApp({
  serviceName,
  version = "0.1.0",
  requireAuth = null,
  publicPaths = [],
  includeSupabaseStatus = false,
  supabaseConnected = false,
  jsonLimit = "10mb",
  rateLimitMax = 200,
}) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((value) => value.trim())
      : [
          "https://app.maxed.life",
          "https://portal.maxed.life",
          "https://api.maxed.life",
          "http://localhost:3005",
          "http://localhost:3006",
          "http://localhost:4100",
        ],
    credentials: true,
  }));
  app.use(express.json({ limit: jsonLimit }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });
  app.use("/api", limiter);

  if (includeSupabaseStatus) {
    app.get("/api/supabase/status", (_req, res) => {
      res.json({ connected: supabaseConnected });
    });
  }

  if (requireAuth) {
    app.use("/api", (req, res, next) => {
      if (matchesPublicPath(req, publicPaths)) {
        return next();
      }
      return requireAuth(req, res, next);
    });
  }

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: serviceName, version });
  });

  return app;
};
