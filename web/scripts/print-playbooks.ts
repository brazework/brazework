// Prints the per-field sections of docs/mcp-workflows.md from lib/mcp-playbooks.ts, so the docs say
// exactly what the MCP server serves: each field's tools, then its studying part and its working part
// (the moments worth recording and who signs). Run from web/: npx tsx scripts/print-playbooks.ts
import { CONNECT_LABEL, PLAYBOOKS, type Moment } from "../src/lib/mcp-playbooks";

const BECOMES = { milestone: "milestone", result: "result post", update: "build update" } as const;
const moment = (m: Moment) => `- **${m.when}** → ${BECOMES[m.becomes]}: “${m.example}”. Proof: ${m.evidence}.`;
for (const p of PLAYBOOKS) {
  console.log(`### ${p.field}\n`);
  console.log("| Tool | How your assistant reaches it | What it reads |\n|---|---|---|");
  for (const t of p.tools) console.log(`| ${t.name} | ${CONNECT_LABEL[t.connect]} | ${t.reads} |`);
  console.log("\nMoments worth recording:\n");
  for (const m of p.study.moments) console.log(moment(m));
  console.log(`\nWho signs: ${p.study.signers}. Try \`/shipped\` with the field ${p.field}.\n`);
  console.log("At work:\n");
  for (const m of p.work.moments) console.log(moment(m));
  console.log(`\nWho signs at work: ${p.work.signers}. Try \`/shipped\` with the field ${p.field} and the lane Working.\n`);
}
