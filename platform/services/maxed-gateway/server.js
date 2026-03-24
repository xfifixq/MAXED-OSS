require("dotenv").config();

const createGatewayApp = require("../../src/gateway/createGatewayApp");
const { getServicePort, getInternalServiceBaseUrl } = require("../../src/shared/runtimeConfig");
const { combineReadinessChecks, checkInternalHttpService } = require("../../src/shared/readiness");

const PORT = Number(process.env.PORT || getServicePort("gateway"));
const app = createGatewayApp({
  readinessCheck: combineReadinessChecks([
    () => checkInternalHttpService("auth", getInternalServiceBaseUrl("auth")),
    () => checkInternalHttpService("api", getInternalServiceBaseUrl("api")),
    () => checkInternalHttpService("externalApi", getInternalServiceBaseUrl("externalApi")),
    () => checkInternalHttpService("stream", getInternalServiceBaseUrl("stream")),
    () => checkInternalHttpService("config", getInternalServiceBaseUrl("config")),
  ]),
});

app.listen(PORT, () => {
  console.log(`Maxed gateway running on http://localhost:${PORT}`);
});
