require("dotenv").config();

const createServiceApp = require("../../src/shared/createServiceApp");
const { prisma } = require("../../src/shared/platformData");
const {
  createPlatformSessionHelpers,
  isPlatformAdminEmail,
} = require("../../src/shared/platformSession");
const registerAuthRoutes = require("../../src/auth/registerAuthRoutes");
const { getServicePort } = require("../../src/shared/runtimeConfig");
const { checkDatabaseReadiness } = require("../../src/shared/readiness");

const bcryptAvailable = (() => {
  try {
    require("bcryptjs");
    return true;
  } catch {
    return false;
  }
})();

const { issuePlatformSession, resolvePlatformSessionFromRequest } =
  createPlatformSessionHelpers({ prisma });

const app = createServiceApp({
  serviceName: "maxed-auth",
  readinessCheck: () => checkDatabaseReadiness(prisma),
});

app.use(async (req, _res, next) => {
  req.platformSession = await resolvePlatformSessionFromRequest(req);
  next();
});

registerAuthRoutes(app, {
  prisma,
  bcryptAvailable,
  issuePlatformSession,
  isPlatformAdminEmail,
  resolvePlatformSessionFromRequest,
});

const PORT = Number(process.env.PORT || getServicePort("auth"));
app.listen(PORT, () => {
  console.log(`Maxed auth running on http://localhost:${PORT}`);
});
