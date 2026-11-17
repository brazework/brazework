// The dependency audit CI runs (web.yml → security): `npm audit` on production dependencies, failing
// on any high or critical advisory, except the few listed in audit-exceptions.json. Each exception
// names the advisory, why it can't reach members, and the date to look again; one past its date
// fails the audit, so nothing stays excused by accident. Usage: node scripts/audit.mjs
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const exceptions = JSON.parse(readFileSync(new URL("../audit-exceptions.json", import.meta.url), "utf8"));
let report;
try { report = execFileSync("npm", ["audit", "--omit=dev", "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); }
catch (e) { report = e.stdout; } // npm audit exits non-zero when it finds anything
const vulns = JSON.parse(report).vulnerabilities ?? {};
const today = new Date().toISOString().slice(0, 10);
const bad = [];
for (const [name, v] of Object.entries(vulns)) {
  for (const via of v.via) {
    if (typeof via !== "object" || !["high", "critical"].includes(via.severity)) continue;
    const id = via.url?.split("/").pop();
    const ex = exceptions.find((x) => x.advisory === id);
    if (ex && ex.reviewBy >= today) { console.log(`excused until ${ex.reviewBy}: ${id} in ${name}`); continue; }
    bad.push(`${via.severity}: ${via.title} in ${name} (${via.url})${ex ? `; its exception expired on ${ex.reviewBy}` : ""}`);
  }
}
for (const x of exceptions) if (x.reviewBy < today) bad.push(`The exception for ${x.advisory} expired on ${x.reviewBy}: check for a fix, then renew or remove it.`);
if (bad.length) { console.error([...new Set(bad)].join("\n")); process.exit(1); }
console.log("No high or critical advisories in production dependencies, beyond the listed exceptions.");
