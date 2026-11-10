// Keeps Linear in step with main, for every commit, including work done without a Linear issue.
//   - A commit that names an issue (FIX-12; old FOR- IDs work too) gets a "Shipped in <commit>" comment on it.
//   - "Fixes FIX-12" (or Closes / Resolves) also moves that issue to Done.
//   - A commit that names no issue is logged as a new Done issue, labelled Source: Commit, in the
//     project its files point to, so Linear shows everything that shipped, not only what was planned.
// Runs from .github/workflows/linear-sync.yml. Needs the LINEAR_API_KEY repository secret (a Linear
// personal API key); without it, it says so and exits cleanly. Safe to re-run: it never logs a
// commit twice. Skip a commit with "[skip linear]" in its message.
const KEY = process.env.LINEAR_API_KEY;
// The team by its permanent ID: its key (FIX today, was FOR) can be renamed in Linear at any time.
const TEAM_ID = process.env.LINEAR_TEAM_ID || "e9a4549f-0bad-4ef4-a105-e907d69ab2ca";
const LINK_COMMITS = process.env.LINK_COMMITS !== "off"; // "off" once Linear's own GitHub integration posts links
const commits = JSON.parse(process.env.COMMITS || "[]");

if (!KEY) { console.log("LINEAR_API_KEY isn't set: skipping the Linear sync (see CONTRIBUTING.md, Tracking work)."); process.exit(0); }

async function gql(query, variables = {}) {
  const res = await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "Content-Type": "application/json", Authorization: KEY }, body: JSON.stringify({ query, variables }) });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

const { team } = await gql(`query($id: String!) { team(id: $id) { id key states { nodes { id type } } projects(first: 50) { nodes { id name } } } }`, { id: TEAM_ID });
if (!team) throw new Error(`no Linear team ${TEAM_ID}`);
const TEAM = team.key;
// Issue IDs in commit messages: the current key, plus old keys Linear still redirects (FOR before FIX).
const KEYS = [...new Set([TEAM, ...(process.env.LINEAR_OLD_KEYS || "FOR").split(",").map((k) => k.trim()).filter(Boolean)])].join("|");
const done = team.states.nodes.find((s) => s.type === "completed").id;
const { issueLabels } = await gql(`query { issueLabels(first: 250) { nodes { id name team { id } } } }`);
const label = (name) => issueLabels.nodes.find((l) => l.name === name && (!l.team || l.team.id === team.id))?.id;
const project = (prefix) => team.projects.nodes.find((p) => p.name.startsWith(prefix))?.id;

// Which project a commit belongs to, from the files it touched (first match wins).
const AREAS = [
  ["Quality", [/^\.github\//, /^web\/e2e\//, /^web\/next\.config/, /\.test\./]],
  ["Launch", [/^supabase\/maintenance\//, /^docs\/(launch|next-migration)\.md$/]],
  ["Brand", [/^README\.md$/, /^docs\/(strategy|naming|positioning)\.md$/, /^web\/src\/components\/landing\//, /^web\/src\/app\/page\.tsx$/]],
];
function projectFor(files) {
  for (const [prefix, patterns] of AREAS) if (files.some((f) => patterns.some((p) => p.test(f)))) return project(prefix);
  return project("Product");
}
function typeFor(subject, files) {
  if (/\b(fix|fixes|fixed|bug)\b/i.test(subject)) return "Bug";
  if (/^(e2e|ci|deps|dependencies|docs|chore|tests?)\b/i.test(subject) || files.every((f) => /^(docs\/|\.github\/|web\/e2e\/|.*\.md$)/.test(f))) return "Chore";
  return "Improvement";
}

const short = (c) => c.id.slice(0, 7);
for (const c of commits) {
  const message = c.message || "";
  const subject = message.split("\n")[0].slice(0, 200);
  if (/\[skip linear\]/i.test(message) || /^Merge /.test(subject) || /dependabot/i.test(c.author?.username || c.author?.name || "")) { console.log(`skip ${short(c)} ${subject}`); continue; }
  const link = `[${short(c)}](${c.url})`;
  const refs = [...new Set((message.match(new RegExp(`\\b(?:${KEYS})-\\d+\\b`, "g")) || []))];
  const fixes = new Set([...message.matchAll(new RegExp(`\\b(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\\s+((?:${KEYS})-\\d+)`, "gi"))].map((m) => m[1].toUpperCase()));

  if (refs.length) {
    for (const ref of refs) {
      const { issue } = await gql(`query($id: String!) { issue(id: $id) { id state { type } comments(first: 100) { nodes { body } } } }`, { id: ref }).catch(() => ({ issue: null }));
      if (!issue) { console.log(`${short(c)}: ${ref} not found`); continue; }
      if (LINK_COMMITS && !issue.comments.nodes.some((n) => n.body.includes(c.id.slice(0, 12)))) {
        await gql(`mutation($i: CommentCreateInput!) { commentCreate(input: $i) { success } }`, { i: { issueId: issue.id, body: `Shipped to main in ${link}: ${subject}\n\n<!-- commit ${c.id} -->` } });
      }
      if (fixes.has(ref) && issue.state.type !== "completed" && issue.state.type !== "canceled") {
        await gql(`mutation($id: String!, $i: IssueUpdateInput!) { issueUpdate(id: $id, input: $i) { success } }`, { id: issue.id, i: { stateId: done } });
        console.log(`${short(c)}: ${ref} → Done`);
      } else console.log(`${short(c)}: linked to ${ref}`);
    }
    continue;
  }

  // No issue named: log it, once.
  const { issues } = await gql(`query($sha: String!) { issues(first: 1, filter: { description: { contains: $sha } }) { nodes { identifier } } }`, { sha: c.id });
  if (issues.nodes.length) { console.log(`${short(c)}: already logged as ${issues.nodes[0].identifier}`); continue; }
  const files = [...(c.added || []), ...(c.modified || []), ...(c.removed || [])];
  const body = message.split("\n").slice(1).join("\n").replace(/Co-Authored-By:.*$/gim, "").trim();
  const description = [
    `**Shipped to main in ${link}** by ${c.author?.name || "someone"}, without a Linear issue, so it was logged here automatically.`,
    body && `\n${body}`,
    files.length ? `\n**Files (${files.length}):** ${files.slice(0, 15).map((f) => `\`${f}\``).join(", ")}${files.length > 15 ? ", …" : ""}` : "",
    `\nNext time, start the commit with an issue ID (\`${TEAM}-123: …\`) to link it instead.\n\n<!-- commit ${c.id} -->`,
  ].filter(Boolean).join("\n");
  const labelIds = [label("Commit"), label(typeFor(subject, files))].filter(Boolean);
  const { issueCreate } = await gql(`mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { identifier } } }`, {
    i: { teamId: team.id, title: subject, description, stateId: done, labelIds, projectId: projectFor(files) },
  });
  console.log(`${short(c)}: logged as ${issueCreate.issue.identifier}`);
}
