const fs = require("fs");
const path = require("path");

const rootCwd = path.resolve(__dirname, "../..");
const platformCwd = path.join(rootCwd, "platform");
const dashboardCwd = path.join(rootCwd, "dashboard");
const portalCwd = path.join(rootCwd, "client-portal");
const opencpaCwd = path.join(rootCwd, "opencpa");

const splitPlatformEntrypoint = path.join(
  platformCwd,
  "services",
  "maxed-gateway",
  "server.js",
);

const hasSplitPlatform = fs.existsSync(splitPlatformEntrypoint);

const sharedPlatformEnv = {
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

function hasPackageJson(dir) {
  return fs.existsSync(path.join(dir, "package.json"));
}

function nextApp(name, cwd, port) {
  return {
    name,
    cwd,
    script: "npm",
    args: "start",
    env: {
      NODE_ENV: "production",
      PORT: String(port),
    },
  };
}

function standaloneNextApp(name, cwd, port) {
  return {
    name,
    cwd,
    script: "node",
    args: ".next/standalone/server.js",
    env: {
      NODE_ENV: "production",
      PORT: String(port),
    },
  };
}

const frontendApps = [
  hasPackageJson(dashboardCwd) ? nextApp("dashboard", dashboardCwd, 3005) : null,
  hasPackageJson(portalCwd) ? standaloneNextApp("portal", portalCwd, 3006) : null,
  hasPackageJson(opencpaCwd) ? standaloneNextApp("opencpa", opencpaCwd, 3007) : null,
].filter(Boolean);

const platformApps = hasSplitPlatform
  ? [
      {
        name: "maxed-gateway",
        cwd: platformCwd,
        script: "node",
        args: "services/maxed-gateway/server.js",
        env: {
          ...sharedPlatformEnv,
          PORT: "4100",
        },
      },
      {
        name: "maxed-auth",
        cwd: platformCwd,
        script: "node",
        args: "services/maxed-auth/server.js",
        env: {
          ...sharedPlatformEnv,
          PORT: "4101",
        },
      },
      {
        name: "maxed-api",
        cwd: platformCwd,
        script: "node",
        args: "services/maxed-api/server.js",
        env: {
          ...sharedPlatformEnv,
          PORT: "4102",
        },
      },
      {
        name: "maxed-external-api",
        cwd: platformCwd,
        script: "node",
        args: "services/maxed-external-api/server.js",
        env: {
          ...sharedPlatformEnv,
          PORT: "4103",
        },
      },
      {
        name: "maxed-stream",
        cwd: platformCwd,
        script: "node",
        args: "services/maxed-stream/server.js",
        env: {
          ...sharedPlatformEnv,
          PORT: "4104",
        },
      },
      {
        name: "maxed-config",
        cwd: platformCwd,
        script: "node",
        args: "services/maxed-config/server.js",
        env: {
          ...sharedPlatformEnv,
          PORT: "4105",
        },
      },
    ]
  : [
      {
        name: "platform",
        cwd: platformCwd,
        script: "node",
        args: "server.js",
        env: {
          NODE_ENV: "production",
          PORT: "4000",
        },
      },
    ];

module.exports = {
  apps: [...frontendApps, ...platformApps],
};
