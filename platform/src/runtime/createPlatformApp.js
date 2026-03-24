const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

module.exports = function createPlatformApp({ requireAuth, supabaseConnected }) {
  const app = express();

  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({
    origin: process.env.CORS_ORIGINS
      ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim())
      : ["https://app.maxed.life", "https://portal.maxed.life", "http://localhost:3005", "http://localhost:3006"],
    credentials: true,
  }));
  app.use(express.json({ limit: "10mb" }));

  const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later" },
  });
  app.use("/api", limiter);

  app.get("/api/supabase/status", (_req, res) => {
    res.json({ connected: supabaseConnected });
  });

  app.use("/api", (req, res, next) => {
    if (req.path === "/auth/login" || req.path === "/auth/verify" || req.path === "/register" || req.path === "/auth/forgot-password" || req.path === "/auth/reset-password") {
      return next();
    }
    return requireAuth(req, res, next);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", platform: "Maxed OpenCPA", version: "0.1.0" });
  });

  return app;
};
