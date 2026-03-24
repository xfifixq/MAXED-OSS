require("dotenv").config();

process.env.PORT = process.env.PORT || String(require("../../src/shared/runtimeConfig").getServicePort("api"));
require("../../server");
