const path = require("path");

const platformCwd = path.resolve(__dirname, "../../platform");
const sharedEnv = {
  MAXED_GATEWAY_PORT: "4100",
  MAXED_AUTH_PORT: "4101",
  MAXED_API_PORT: "4102",
  MAXED_EXTERNAL_API_PORT: "4103",
  MAXED_STREAM_PORT: "4104",
  MAXED_CONFIG_PORT: "4105",
  MAXED_GATEWAY_INTERNAL_URL: "http://127.0.0.1:4100",
  MAXED_AUTH_INTERNAL_URL: "http://127.0.0.1:4101",
  MAXED_API_INTERNAL_URL: "http://127.0.0.1:4102",
  MAXED_EXTERNAL_API_INTERNAL_URL: "http://127.0.0.1:4103",
  MAXED_STREAM_INTERNAL_URL: "http://127.0.0.1:4104",
  MAXED_CONFIG_INTERNAL_URL: "http://127.0.0.1:4105",
  PUBLIC_API_URL: "https://api.maxed.life",
};

module.exports = {
  apps: [
    {
      name: "maxed-gateway",
      cwd: platformCwd,
      script: "node",
      args: "services/maxed-gateway/server.js",
      env: {
        ...sharedEnv,
        PORT: "4100",
      },
    },
    {
      name: "maxed-auth",
      cwd: platformCwd,
      script: "node",
      args: "services/maxed-auth/server.js",
      env: {
        ...sharedEnv,
        PORT: "4101",
      },
    },
    {
      name: "maxed-api",
      cwd: platformCwd,
      script: "node",
      args: "services/maxed-api/server.js",
      env: {
        ...sharedEnv,
        PORT: "4102",
      },
    },
    {
      name: "maxed-external-api",
      cwd: platformCwd,
      script: "node",
      args: "services/maxed-external-api/server.js",
      env: {
        ...sharedEnv,
        PORT: "4103",
      },
    },
    {
      name: "maxed-stream",
      cwd: platformCwd,
      script: "node",
      args: "services/maxed-stream/server.js",
      env: {
        ...sharedEnv,
        PORT: "4104",
      },
    },
    {
      name: "maxed-config",
      cwd: platformCwd,
      script: "node",
      args: "services/maxed-config/server.js",
      env: {
        ...sharedEnv,
        PORT: "4105",
      },
    },
  ],
};
