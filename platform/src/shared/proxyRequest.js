const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function buildTargetUrl(baseUrl, req, rewritePath) {
  const originalUrl = req.originalUrl || req.url;
  const [pathPart, queryPart = ""] = originalUrl.split("?");
  const proxiedPath = typeof rewritePath === "function"
    ? rewritePath(pathPart, req)
    : (rewritePath || pathPart);
  const url = new URL(proxiedPath, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (queryPart) {
    url.search = queryPart;
  }
  return url.toString();
}

function buildProxyBody(req) {
  if (req.method === "GET" || req.method === "HEAD") {
    return undefined;
  }

  if (req.body == null) {
    return undefined;
  }

  if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
    return req.body;
  }

  return JSON.stringify(req.body);
}

module.exports = async function proxyRequest(req, res, options) {
  const {
    targetBaseUrl,
    rewritePath,
    extraHeaders = {},
    timeoutMs = 30000,
  } = options;

  const targetUrl = buildTargetUrl(targetBaseUrl, req, rewritePath);
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP_HEADERS.has(String(key).toLowerCase())) continue;
    if (value == null) continue;
    if (Array.isArray(value)) {
      headers.set(key, value.join(", "));
      continue;
    }
    headers.set(key, String(value));
  }

  for (const [key, value] of Object.entries(extraHeaders)) {
    if (value == null) continue;
    headers.set(key, String(value));
  }

  if (!headers.has("x-forwarded-proto")) {
    headers.set("x-forwarded-proto", req.protocol || "http");
  }
  if (!headers.has("x-forwarded-host") && req.headers.host) {
    headers.set("x-forwarded-host", String(req.headers.host));
  }
  if (!headers.has("x-forwarded-for") && req.ip) {
    headers.set("x-forwarded-for", req.ip);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: buildProxyBody(req),
      redirect: "manual",
      signal: controller.signal,
    });

    res.status(upstream.status);

    upstream.headers.forEach((value, key) => {
      if (HOP_BY_HOP_HEADERS.has(String(key).toLowerCase())) return;
      res.setHeader(key, value);
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    return res.send(buffer);
  } catch (error) {
    const status = error?.name === "AbortError" ? 504 : 502;
    return res.status(status).json({
      error: "Gateway upstream request failed",
      detail: error.message,
      upstream: targetBaseUrl,
    });
  } finally {
    clearTimeout(timer);
  }
};
