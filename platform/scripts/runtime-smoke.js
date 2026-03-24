#!/usr/bin/env node

const targets = [
  ["gateway", process.env.MAXED_GATEWAY_SMOKE_URL || "http://127.0.0.1:4100/ready"],
  ["auth", process.env.MAXED_AUTH_SMOKE_URL || "http://127.0.0.1:4101/ready"],
  ["api", process.env.MAXED_API_SMOKE_URL || "http://127.0.0.1:4102/ready"],
  ["external-api", process.env.MAXED_EXTERNAL_API_SMOKE_URL || "http://127.0.0.1:4103/ready"],
  ["stream", process.env.MAXED_STREAM_SMOKE_URL || "http://127.0.0.1:4104/ready"],
  ["config", process.env.MAXED_CONFIG_SMOKE_URL || "http://127.0.0.1:4105/ready"],
];

async function main() {
  let failed = false;

  for (const [name, url] of targets) {
    try {
      const res = await fetch(url);
      const payload = await res.text();
      if (!res.ok) {
        failed = true;
        console.error(`${name}: FAIL ${res.status} ${payload}`);
        continue;
      }

      console.log(`${name}: OK ${res.status}`);
    } catch (err) {
      failed = true;
      console.error(`${name}: FAIL ${err.message}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
  }
}

main();
