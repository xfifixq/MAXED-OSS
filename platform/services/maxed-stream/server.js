require("dotenv").config();

const createServiceApp = require("../../src/shared/createServiceApp");
const createRuntimeEventStore = require("../../src/stream/createRuntimeEventStore");
const registerStreamRoutes = require("../../src/stream/registerStreamRoutes");
const { getServicePort } = require("../../src/shared/runtimeConfig");

const app = createServiceApp({
  serviceName: "maxed-stream",
});

const eventStore = createRuntimeEventStore();
registerStreamRoutes(app, { eventStore });

const PORT = Number(process.env.PORT || getServicePort("stream"));
app.listen(PORT, () => {
  console.log(`Maxed stream running on http://localhost:${PORT}`);
});
