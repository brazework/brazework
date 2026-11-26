// Archives the Done issues that linear-sync.mjs used to create, one per commit with no Linear issue
// ("…without a Linear issue, so it was logged here automatically"). Those filled the Free plan's
// 250-issue cap; commits without an issue now go on one weekly issue instead. Archiving keeps them:
// they're searchable and can be restored from the issue's menu. Nothing else is touched.
// Runs from .github/workflows/linear-archive-logged.yml. ARCHIVE=true archives; anything else only lists.
const KEY = process.env.LINEAR_API_KEY;
const TEAM_ID = process.env.LINEAR_TEAM_ID || "e9a4549f-0bad-4ef4-a105-e907d69ab2ca";
const ARCHIVE = process.env.ARCHIVE === "true";
if (!KEY) { console.log("LINEAR_API_KEY isn't set: nothing to do."); process.exit(0); }

async function gql(query, variables = {}) {
  const res = await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "Content-Type": "application/json", Authorization: KEY }, body: JSON.stringify({ query, variables }) });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
  return json.data;
}

const MARK = "without a Linear issue, so it was logged here automatically";
const found = [];
for (let after = null; ;) {
  const { issues } = await gql(`query($t: ID!, $mark: String!, $after: String) {
    issues(first: 100, after: $after, filter: { team: { id: { eq: $t } }, state: { type: { eq: "completed" } }, description: { contains: $mark } }) {
      nodes { id identifier title } pageInfo { hasNextPage endCursor } } }`, { t: TEAM_ID, mark: MARK, after });
  found.push(...issues.nodes);
  if (!issues.pageInfo.hasNextPage) break;
  after = issues.pageInfo.endCursor;
}

console.log(`${found.length} auto-logged commit issues${ARCHIVE ? ", archiving" : " (a dry run: run again with archive ticked to archive them)"}:`);
for (const i of found) {
  if (ARCHIVE) await gql(`mutation($id: String!) { issueArchive(id: $id) { success } }`, { id: i.id });
  console.log(`  ${i.identifier} ${i.title}`);
}
if (ARCHIVE) console.log(`Archived ${found.length}.`);
