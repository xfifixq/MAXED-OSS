require("dotenv").config();

const createGatewayApp = require("../../src/gateway/createGatewayApp");
const { getServicePort } = require("../../src/shared/runtimeConfig");

const PORT = Number(process.env.PORT || getServicePort("gateway"));
const app = createGatewayApp();

app.listen(PORT, () => {
  console.log(`Maxed gateway running on http://localhost:${PORT}`);
});
