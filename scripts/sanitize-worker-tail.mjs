import { readFileSync, writeFileSync } from "node:fs";

const [inputPath, outputPath] = process.argv.slice(2);
if (!inputPath || !outputPath) {
  console.error("Usage: node scripts/sanitize-worker-tail.mjs <raw-json> <safe-json>");
  process.exit(2);
}
const input = readFileSync(inputPath, "utf8").replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
const objects = [];
let start = -1, depth = 0, inString = false, escaped = false;
for (let i = 0; i < input.length; i++) {
  const c = input[i];
  if (start < 0) {
    if (c === "{") { start = i; depth = 1; }
    continue;
  }
  if (inString) {
    if (escaped) escaped = false;
    else if (c === "\\") escaped = true;
    else if (c === '"') inString = false;
    continue;
  }
  if (c === '"') inString = true;
  else if (c === "{") depth++;
  else if (c === "}" && --depth === 0) {
    try { objects.push(JSON.parse(input.slice(start, i + 1))); } catch {}
    start = -1;
  }
}
const invocations = [];
const requests = [];
for (const event of objects) {
  if (!event || typeof event !== "object" || !event.scriptName) continue;
  invocations.push({
    timestamp: event.eventTimestamp ?? null,
    scriptName: event.scriptName,
    outcome: event.outcome ?? "unknown",
    wallTimeMs: Number(event.wallTime ?? 0),
    cpuTimeMs: Number(event.cpuTime ?? 0),
    exceptions: Array.isArray(event.exceptions) ? event.exceptions.map((e) => ({ name: e?.name ?? "Error" })) : [],
  });
  for (const log of Array.isArray(event.logs) ? event.logs : []) {
    const message = Array.isArray(log?.message) ? log.message.join(" ") : String(log?.message ?? "");
    let record;
    try { record = JSON.parse(message); } catch { continue; }
    if (record.event !== "http_request") continue;
    requests.push({
      requestId: record.requestId ?? null,
      method: record.method ?? null,
      route: record.route ?? null,
      status: Number(record.status ?? 0),
      durationMs: Number(record.durationMs ?? 0),
      level: log.level ?? "log",
    });
  }
}
if (!invocations.length || !requests.length) {
  console.error(`No Worker invocation/request logs parsed (events=${objects.length}).`);
  process.exit(1);
}
const statusCounts = {};
for (const request of requests) statusCounts[request.status] = (statusCounts[request.status] ?? 0) + 1;
const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100) / 100 : 0;
const safe = {
  source: "wrangler tail --format json",
  privacy: "Client IP, headers, URL, geolocation, TLS fingerprints and log message content beyond safe request fields were omitted.",
  metrics: {
    invocationCount: invocations.length,
    requestLogCount: requests.length,
    successfulInvocations: invocations.filter((e) => e.outcome === "ok" && e.exceptions.length === 0).length,
    errorInvocations: invocations.filter((e) => e.outcome !== "ok" || e.exceptions.length > 0).length,
    httpErrorResponses: requests.filter((r) => r.status >= 400).length,
    serverErrorResponses: requests.filter((r) => r.status >= 500).length,
    statusCounts,
    averageWallTimeMs: average(invocations.map((e) => e.wallTimeMs)),
    averageCpuTimeMs: average(invocations.map((e) => e.cpuTimeMs)),
    averageApplicationDurationMs: average(requests.map((r) => r.durationMs)),
  },
  invocations,
  requests,
};
writeFileSync(outputPath, JSON.stringify(safe, null, 2) + "\n");
console.log(`SANITIZED_TAIL_OK invocations=${invocations.length} requests=${requests.length}`);
