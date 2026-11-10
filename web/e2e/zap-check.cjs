// Reads the OWASP ZAP baseline report (.zap/zap.json) and fails on any High-risk finding.
// Medium and Low are listed but don't fail CI. Each one is either fixed or filed in Linear (Security).
const fs = require("fs");
const report = JSON.parse(fs.readFileSync(`${__dirname}/../.zap/zap.json`, "utf8"));
const alerts = (report.site ?? []).flatMap((s) => s.alerts ?? []);
const RISK = { 3: "High", 2: "Medium", 1: "Low", 0: "Info" };
const rows = alerts.map((a) => ({ risk: Number(a.riskcode), name: a.name, count: Number(a.count ?? a.instances?.length ?? 0), id: a.pluginid })).sort((x, y) => y.risk - x.risk);
for (const r of rows) console.log(`${RISK[r.risk].padEnd(6)} ${r.name} (rule ${r.id}, ${r.count} URL${r.count === 1 ? "" : "s"})`);
const high = rows.filter((r) => r.risk >= 3);
console.log(`\n${high.length} high, ${rows.filter((r) => r.risk === 2).length} medium, ${rows.filter((r) => r.risk === 1).length} low.`);
if (high.length) { console.log("High-risk findings fail the build. The full report is in the zap-report artifact."); process.exit(1); }
