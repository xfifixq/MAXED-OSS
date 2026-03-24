const fs = require("fs/promises");

async function checkDatabaseReadiness(prisma) {
  await prisma.$queryRawUnsafe("SELECT 1");
  return { database: "ok" };
}

async function checkInternalHttpService(name, baseUrl) {
  const res = await fetch(`${String(baseUrl).replace(/\/$/, "")}/ready`);
  if (!res.ok) {
    const error = new Error(`${name} health check failed with ${res.status}`);
    error.status = 503;
    throw error;
  }
  return { [name]: "ok" };
}

async function checkStorageReadiness(rootPath) {
  await fs.mkdir(rootPath, { recursive: true });
  return { storage: "ok" };
}

function combineReadinessChecks(checks = []) {
  return async function readinessCheck() {
    const details = {};
    for (const check of checks) {
      const result = await check();
      if (result && typeof result === "object") {
        Object.assign(details, result);
      }
    }
    return details;
  };
}

module.exports = {
  checkDatabaseReadiness,
  checkInternalHttpService,
  checkStorageReadiness,
  combineReadinessChecks,
};
