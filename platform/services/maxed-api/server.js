require("dotenv").config();

const { getServicePort } = require("../../src/shared/runtimeConfig");
const { start } = require("../../server");

const PORT = Number(process.env.PORT || getServicePort("api"));
start(PORT);
