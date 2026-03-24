require("dotenv").config();

const createServiceApp = require("../../src/shared/createServiceApp");
const registerExternalRoutes = require("../../src/external/registerExternalRoutes");
const {
  SERVICE_CATALOG,
  SERVICE_ACCESS_CAPABILITIES,
  getPublicServiceUrl,
  getMaxedWorkspaceUrl,
} = require("../../src/openframe/serviceRegistry");
const { prisma } = require("../../src/shared/platformData");
const { getServicePort } = require("../../src/shared/runtimeConfig");

async function getServiceCredential(firmId, service) {
  if (!firmId || !service) return null;

  return prisma.serviceCredential.findUnique({
    where: {
      firmId_service: {
        firmId,
        service,
      },
    },
  });
}

const app = createServiceApp({
  serviceName: "maxed-external-api",
  readinessCheck: async () => ({ externalApi: "ok" }),
});

registerExternalRoutes(app, {
  SERVICE_CATALOG,
  SERVICE_ACCESS_CAPABILITIES,
  getPublicServiceUrl,
  getMaxedWorkspaceUrl,
  getServiceCredential,
});

const PORT = Number(process.env.PORT || getServicePort("externalApi"));
app.listen(PORT, () => {
  console.log(`Maxed external API running on http://localhost:${PORT}`);
});
