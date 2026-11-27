import { MCP_TOOLS } from "@/lib/mcp";
import { CONNECT_LABEL, EVERYONE, PLAYBOOKS, PROMPTS, type LaneContent, type Playbook } from "@/lib/mcp-playbooks";
import { TOOLS } from "@/lib/tool-setup";

// The public guide to connecting your AI (/ai, docs/mcp-workflows.md), built from the code's own lists
// so it can't drift: the prompts and tools the MCP server offers (lib/mcp.ts, lib/mcp-playbooks.ts),
// the assistants Settings → Your tools sets up (lib/tool-setup.ts), and the field playbooks. A tool or
// prompt added to the server shows up here by itself. Pure, and tested (tests/ai-guide.test.ts).

/** The loop, in three steps. */
export const FLOW = [
  { title: "Your AI drafts it", body: "Ask in plain words. Your assistant reads the tools you already use and writes the result, with its proof." },
  { title: "You approve it", body: "It shows you first, or leaves a draft in Brazework. Nothing goes out until you say yes." },
  { title: "Someone who saw it signs", body: "Your club, a professor, a coworker or a client signs it. Then it's on your record, wherever you go next." },
] as const;

/** What it never does. True of every tool, whatever its token may do. */
export const RULES = [
  "Nothing is posted, sent or changed without your yes. A draft waits for you in Brazework.",
  "It never verifies or signs anything. Clubs and the people who saw the work do that, in Brazework.",
  "It never deletes anything, and never changes what someone else made.",
  "It sees only what you could see in the app, and follows the same rules and limits as the app.",
] as const;

/** The assistants Settings → Your tools sets up with a token (GitHub Actions is an automation, listed apart). */
export const ASSISTANTS = TOOLS.filter((t) => t.id !== "github-actions").map((t) => t.name);

const firstSentence = (s: string) => (s.match(/^.*?[.!?](\s|$)/)?.[0] ?? s).trim();

/** The slash commands (MCP prompts), in the server's order. */
export const COMMANDS = PROMPTS.map((p) => ({ name: p.name, title: p.title, body: p.description }));

/** The tools, grouped as a member thinks of them: what it reads, and what it can do for you. */
export function toolGroups() {
  const row = (t: (typeof MCP_TOOLS)[number]) => ({ name: t.name, title: t.title, body: firstSentence(t.description) });
  return [
    { id: "reads", title: "It reads your Brazework", tools: MCP_TOOLS.filter((t) => !t.needs).map(row) },
    { id: "does", title: "It drafts and does, with your yes", tools: MCP_TOOLS.filter((t) => t.needs).map(row) },
  ];
}

const laneSection = (l: LaneContent) => ({ signers: l.signers, moments: l.moments.map((m) => ({ when: m.when, example: m.example, evidence: m.evidence })) });

/** One field's section: the tools people in it use, and for studying and for working, the moments worth recording and who signs. */
export function fieldSection(p: Playbook) {
  return {
    id: p.id, field: p.field,
    tools: p.tools.map((t) => ({ name: t.name, how: CONNECT_LABEL[t.connect], reads: t.reads })),
    lanes: { study: laneSection(p.study), work: laneSection(p.work) },
  };
}
export const FIELDS = PLAYBOOKS.map(fieldSection);
export const FOR_EVERYONE = EVERYONE.map((t) => ({ name: t.name, how: CONNECT_LABEL[t.connect], reads: t.reads }));
