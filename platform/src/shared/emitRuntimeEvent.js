const { getInternalServiceBaseUrl } = require("./runtimeConfig");

module.exports = async function emitRuntimeEvent(event) {
  try {
    await fetch(`${getInternalServiceBaseUrl("stream")}/api/stream/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Runtime event shipping is best-effort.
  }
};
