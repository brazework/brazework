// One open Linear issue per watch (shared by db-watch.mjs and infra-drift.mjs). The first run that
// finds something files an issue titled `title`; later runs comment on the open issue whose title
// starts with `prefix` instead of piling up new ones. Without LINEAR_API_KEY it only says so.
export async function fileOrComment({ prefix, title, body }) {
  const KEY = process.env.LINEAR_API_KEY;
  if (!KEY) return console.log("LINEAR_API_KEY isn't set: not filing in Linear.");
  const TEAM_ID = process.env.LINEAR_TEAM_ID || "e9a4549f-0bad-4ef4-a105-e907d69ab2ca";
  const gql = async (query, variables) => {
    const res = await fetch("https://api.linear.app/graphql", { method: "POST", headers: { "Content-Type": "application/json", Authorization: KEY }, body: JSON.stringify({ query, variables }) });
    const json = await res.json();
    if (json.errors) throw new Error(json.errors.map((e) => e.message).join("; "));
    return json.data;
  };
  const { issues } = await gql(`query($team: ID!, $prefix: String!) { issues(first: 5, filter: { team: { id: { eq: $team } }, title: { startsWith: $prefix }, state: { type: { nin: ["completed", "canceled"] } } }) { nodes { id identifier } } }`, { team: TEAM_ID, prefix });
  const open = issues.nodes[0];
  if (open) {
    await gql(`mutation($i: CommentCreateInput!) { commentCreate(input: $i) { success } }`, { i: { issueId: open.id, body } });
    console.log(`Commented on ${open.identifier}`);
  } else {
    const { issueCreate } = await gql(`mutation($i: IssueCreateInput!) { issueCreate(input: $i) { issue { identifier } } }`, { i: { teamId: TEAM_ID, title, description: body } });
    console.log(`Filed ${issueCreate.issue.identifier}`);
  }
}
