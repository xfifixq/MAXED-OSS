require("dotenv").config();

const createServiceApp = require("../../src/shared/createServiceApp");
const createRuntimeEventStore = require("../../src/stream/createRuntimeEventStore");
const registerStreamRoutes = require("../../src/stream/registerStreamRoutes");
const { getServicePort } = require("../../src/shared/runtimeConfig");
const { LOCAL_STORAGE_ROOT } = require("../../src/shared/platformData");
const { checkStorageReadiness } = require("../../src/shared/readiness");

const app = createServiceApp({
  serviceName: "maxed-stream",
  readinessCheck: () => checkStorageReadiness(LOCAL_STORAGE_ROOT),
});

const eventStore = createRuntimeEventStore();
registerStreamRoutes(app, { eventStore });

const PORT = Number(process.env.PORT || getServicePort("stream"));
app.listen(PORT, () => {
  console.log(`Maxed stream running on http://localhost:${PORT}`);
});
