// Prints the per-field sections of docs/mcp-workflows.md from lib/mcp-playbooks.ts, so the docs say
// exactly what the MCP server serves. Run from web/: npx tsx scripts/print-playbooks.ts
import { CONNECT_LABEL, PLAYBOOKS } from "../src/lib/mcp-playbooks";

const BECOMES = { milestone: "milestone", result: "result post", update: "build update" } as const;
for (const p of PLAYBOOKS) {
  console.log(`### ${p.field}\n`);
  console.log("| Tool | How your assistant reaches it | What it reads |\n|---|---|---|");
  for (const t of p.tools) console.log(`| ${t.name} | ${CONNECT_LABEL[t.connect]} | ${t.reads} |`);
  console.log("\nMoments worth recording:\n");
  for (const m of p.moments) console.log(`- **${m.when}** → ${BECOMES[m.becomes]}: “${m.example}”. Proof: ${m.evidence}.`);
  console.log(`\nWho signs: ${p.signers}. Try \`/shipped\` with the field ${p.field}.\n`);
}
