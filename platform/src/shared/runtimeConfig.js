const DEFAULT_INTERNAL_HOST = process.env.MAXED_INTERNAL_HOST || "127.0.0.1";

const MAXED_SERVICE_PORTS = {
  gateway: Number(process.env.MAXED_GATEWAY_PORT || 4100),
  auth: Number(process.env.MAXED_AUTH_PORT || 4101),
  api: Number(process.env.MAXED_API_PORT || 4102),
  externalApi: Number(process.env.MAXED_EXTERNAL_API_PORT || 4103),
  stream: Number(process.env.MAXED_STREAM_PORT || 4104),
  config: Number(process.env.MAXED_CONFIG_PORT || 4105),
};

const MAXED_INTERNAL_URLS = {
  gateway: process.env.MAXED_GATEWAY_INTERNAL_URL || null,
  auth: process.env.MAXED_AUTH_INTERNAL_URL || null,
  api: process.env.MAXED_API_INTERNAL_URL || null,
  externalApi: process.env.MAXED_EXTERNAL_API_INTERNAL_URL || null,
  stream: process.env.MAXED_STREAM_INTERNAL_URL || null,
  config: process.env.MAXED_CONFIG_INTERNAL_URL || null,
};

function normalizeServiceRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  if (normalized === "external-api" || normalized === "external_api") {
    return "externalApi";
  }
  return normalized;
}

function getServicePort(role) {
  const normalized = normalizeServiceRole(role);
  const port = MAXED_SERVICE_PORTS[normalized];
  if (!port) {
    throw new Error(`Unknown Maxed service role: ${role}`);
  }
  return port;
}

function getInternalServiceBaseUrl(role) {
  const normalized = normalizeServiceRole(role);
  const explicit = MAXED_INTERNAL_URLS[normalized];
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  return `http://${DEFAULT_INTERNAL_HOST}:${getServicePort(normalized)}`;
}

function getGatewayPublicUrl() {
  return (
    process.env.MAXED_GATEWAY_PUBLIC_URL ||
    process.env.PUBLIC_API_URL ||
    "https://api.maxed.life"
  ).replace(/\/$/, "");
}

module.exports = {
  MAXED_SERVICE_PORTS,
  normalizeServiceRole,
  getServicePort,
  getInternalServiceBaseUrl,
  getGatewayPublicUrl,
};
