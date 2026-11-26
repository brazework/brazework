// Keeps Linear in step with main, for every commit, including work done without a Linear issue.
//   - A commit that names an issue (FIX-12; old FOR- IDs work too) gets a "Shipped in <commit>" comment on it.
//   - "Fixes FIX-12" (or Closes / Resolves) also moves that issue to Done.
//   - A commit that names no issue is logged as a comment on that week's "Shipped without an issue"
//     issue (labelled Commit, Done), so Linear shows everything that shipped, not only what was planned,
//     for one issue a week. (It used to be one new issue per commit, which filled the Free plan's
//     250-issue cap in two weeks; .github/workflows/linear-archive-logged.yml archives those.)
// Runs from .github/workflows/linear-sync.yml. Needs the LINEAR_API_KEY repository secret (a Linear
// personal API key); without it, it says so and exits cleanly. Safe to re-run: it never logs a
// commit twice. Skip a commit with "[skip linear]" in its message.
import { execFileSync } from "node:child_process";

const KEY = process.env.LINEAR_API_KEY;
// The team by its permanent ID: its key (FIX today, was FOR) can be renamed in Linear at any time.
const TEAM_ID = process.env.LINEAR_TEAM_ID || "e9a4549f-0bad-4ef4-a105-e907d69ab2ca";
const LINK_COMMITS = process.env.LINK_COMMITS !== "off"; // "off" once Linear's own GitHub integration posts links
// A push sends its commits; a manual run with SINCE (YYYY-MM-DD) logs main's commits since then instead,
// to catch up after a gap. Commits already logged or linked are skipped, so overlapping is fine.
const SINCE = process.env.SINCE?.trim();
const commits = SINCE ? commitsSince(SINCE) : JSON.parse(process.env.COMMITS || "null") || [];

function commitsSince(since) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error(`SINCE should look like 2026-11-26, not "${since}"`);
  const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
  const repo = `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}`;
  return git("log", "--reverse", "--first-parent", `--since=${since}T00:00:00Z`, "--format=%H", "HEAD").split("\n").filter(Boolean).map((id) => ({
    id,
    url: `${repo}/commit/${id}`,
    message: git("show", "-s", "--format=%B", id).trim(),
    timestamp: git("show", "-s", "--format=%cI", id).trim(),
    author: { name: git("show", "-s", "--format=%an", id).trim() },
    modified: git("show", "--name-only", "--format=", id).split("\n").filter(Boolean),
  }));
}

if (!KEY) { console.log("LINEAR_API_KEY isn't set: skipping the Linear sync (see CONTRIBUTING.md, Tracking work)."); process.exit(0); }

async function gql(query, variables = {}) {
  const res = await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "Content-Type": "application/json", Authorization: KEY }, body: JSON.stringify({ query, variables }) });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

const { team } = await gql(`query($id: String!) { team(id: $id) { id key states { nodes { id type } } } }`, { id: TEAM_ID });
if (!team) throw new Error(`no Linear team ${TEAM_ID}`);
const TEAM = team.key;
// Issue IDs in commit messages: the current key, plus old keys Linear still redirects (FOR before FIX).
const KEYS = [...new Set([TEAM, ...(process.env.LINEAR_OLD_KEYS || "FOR").split(",").map((k) => k.trim()).filter(Boolean)])].join("|");
const done = team.states.nodes.find((s) => s.type === "completed").id;
const { issueLabels } = await gql(`query { issueLabels(first: 250) { nodes { id name team { id } } } }`);
const label = (name) => issueLabels.nodes.find((l) => l.name === name && (!l.team || l.team.id === team.id))?.id;

// The Monday (UTC) of the week a commit landed in, as YYYY-MM-DD.
function weekOf(timestamp) {
  const d = new Date(timestamp || Date.now());
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}
// This week's "Shipped without an issue" issue, found by its title or created once.
const weekly = new Map();
async function weeklyIssue(week) {
  if (weekly.has(week)) return weekly.get(week);
  const title = `Shipped without an issue: week of ${week}`;
  const { issues } = await gql(`query($t: ID!, $title: String!) { issues(first: 1, filter: { team: { id: { eq: $t } }, title: { eq: $title } }) { nodes { id identifier comments(first: 250) { nodes { body } } } } }`, { t: team.id, title });
  let issue = issues.nodes[0];
  if (!issue) {
    const description = `Everything merged to main in the week of ${week} without a Linear issue, one comment per commit, posted by \`.github/scripts/linear-sync.mjs\`.\n\nNext time, start the commit with an issue ID (\`${TEAM}-123: …\`) to link it instead.`;
    const { issueCreate } = await gql(`mutation($i: IssueCreateInput!) { issueCreate(input: $i) { success issue { id identifier } } }`, {
      i: { teamId: team.id, title, description, stateId: done, labelIds: [label("Commit")].filter(Boolean) },
    });
    issue = { ...issueCreate.issue, comments: { nodes: [] } };
  }
  weekly.set(week, issue);
  return issue;
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

  // No issue named: log it on this week's issue, once.
  // Commits from before the weekly issue were logged as issues of their own; leave those be.
  const { issues } = await gql(`query($sha: String!) { issues(first: 1, filter: { description: { contains: $sha } }) { nodes { identifier } } }`, { sha: c.id });
  if (issues.nodes.length) { console.log(`${short(c)}: already logged as ${issues.nodes[0].identifier}`); continue; }
  let week;
  try {
    week = await weeklyIssue(weekOf(c.timestamp));
  } catch (e) {
    // Linear's Free plan stops new issues past its issue cap ("usage limit exceeded"). That shouldn't
    // fail main's checks or stop the commits after this one being linked and closed, so warn and go on.
    // Once there's room again, re-run it or run it by hand with a date: it logs each commit only once.
    if (!/usage limit/i.test(e.message)) throw e;
    console.log(`::warning title=Linear issue limit::${short(c)} wasn't logged: Linear says "${e.message}" (the Free plan's issue cap). Archive old issues (the Linear cleanup workflow) or upgrade, then run Linear sync by hand with a date to log it.`);
    continue;
  }
  if (week.comments.nodes.some((n) => n.body.includes(c.id))) { console.log(`${short(c)}: already logged on ${week.identifier}`); continue; }
  const files = [...(c.added || []), ...(c.modified || []), ...(c.removed || [])];
  const body = message.split("\n").slice(1).join("\n").replace(/Co-Authored-By:.*$/gim, "").trim();
  const comment = [
    `**${subject}**, shipped to main in ${link} by ${c.author?.name || "someone"}.`,
    body && `\n${body}`,
    files.length ? `\n**Files (${files.length}):** ${files.slice(0, 15).map((f) => `\`${f}\``).join(", ")}${files.length > 15 ? ", …" : ""}` : "",
    `\n<!-- commit ${c.id} -->`,
  ].filter(Boolean).join("\n");
  await gql(`mutation($i: CommentCreateInput!) { commentCreate(input: $i) { success } }`, { i: { issueId: week.id, body: comment } });
  week.comments.nodes.push({ body: comment });
  console.log(`${short(c)}: logged on ${week.identifier}`);
}
