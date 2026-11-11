import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

for (const file of ["src/worker.js","scripts/smoke.mjs","scripts/sanitize-worker-tail.mjs","public/app.js"]) {
  const result=spawnSync(process.execPath,["--check",file],{stdio:"inherit"});
  if(result.status!==0)process.exit(result.status??1);
  console.log("PASS syntax "+file);
}
const config=JSON.parse(readFileSync("wrangler.jsonc","utf8"));
const pkg=JSON.parse(readFileSync("package.json","utf8"));
if(config.name!=="cloud-devops-capstone-module06")throw new Error("Unexpected Worker name.");
if(config.d1_databases?.[0]?.database_name!=="taskflow-capstone-module06")throw new Error("Unexpected D1 binding.");
if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.d1_databases[0].database_id))throw new Error("Set the real D1 database ID before building.");
if(!pkg.scripts["test:smoke"]||!pkg.scripts.deploy)throw new Error("Missing package scripts.");
console.log("PASS JSON and Cloudflare configuration");
