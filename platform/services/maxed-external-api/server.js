require("dotenv").config();

const createServiceApp = require("../../src/shared/createServiceApp");
const registerExternalRoutes = require("../../src/external/registerExternalRoutes");
const {
  SERVICE_CATALOG,
  SERVICE_ACCESS_CAPABILITIES,
  getPublicServiceUrl,
  getMaxedWorkspaceUrl,
} = require("../../src/openframe/serviceRegistry");
const { getServicePort } = require("../../src/shared/runtimeConfig");

const app = createServiceApp({
  serviceName: "maxed-external-api",
});

registerExternalRoutes(app, {
  SERVICE_CATALOG,
  SERVICE_ACCESS_CAPABILITIES,
  getPublicServiceUrl,
  getMaxedWorkspaceUrl,
});

const PORT = Number(process.env.PORT || getServicePort("externalApi"));
app.listen(PORT, () => {
  console.log(`Maxed external API running on http://localhost:${PORT}`);
});
