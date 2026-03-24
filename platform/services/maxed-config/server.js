require("dotenv").config();

const createServiceApp = require("../../src/shared/createServiceApp");
const registerConfigRoutes = require("../../src/config/registerConfigRoutes");
const {
  SERVICES,
  PUBLIC_SERVICES,
  SERVICE_CATALOG,
  SERVICE_WORKSPACE_PATHS,
  SERVICE_ACCESS_CAPABILITIES,
} = require("../../src/openframe/serviceRegistry");
const { getServicePort } = require("../../src/shared/runtimeConfig");

const app = createServiceApp({
  serviceName: "maxed-config",
  readinessCheck: async () => ({ config: "ok" }),
});

registerConfigRoutes(app, {
  SERVICES,
  PUBLIC_SERVICES,
  SERVICE_CATALOG,
  SERVICE_WORKSPACE_PATHS,
  SERVICE_ACCESS_CAPABILITIES,
});

const PORT = Number(process.env.PORT || getServicePort("config"));
app.listen(PORT, () => {
  console.log(`Maxed config running on http://localhost:${PORT}`);
});
