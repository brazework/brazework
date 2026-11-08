// Projects on profiles. Everyone sees a project's card (title, summary, status, topics);
// the write-up and link are hidden from others while a project is private.
// Sharing a project to the feed makes an ordinary post that points at it.
import { sb, run, many } from "./supabase.js";
import { esc, timeAgo, icon, TOPICS } from "./util.js";

export const MAX_PROJECT_TAGS = 3;

export const projectsOf = uid => many(sb.from("projects").select("*").eq("owner_id", uid).order("created_at", { ascending: false }).limit(100));

export async function projectsByIds(ids) {
  if (!ids.length) return [];
  return many(sb.from("projects").select("*").in("id", ids));
}

// Details you're allowed to read (all of yours, others' public ones), by project id.
export async function detailsFor(ids) {
  if (!ids.length) return new Map();
  const rs = await many(sb.from("project_details").select("*").in("project_id", ids));
  return new Map(rs.map(d => [d.projectId, d]));
}

// Creates or updates a project and its details. Returns the project.
export async function saveProject(id, fields, details) {
  const row = {
    title: fields.title, summary: fields.summary, status: fields.status,
    year: fields.status === "completed" && fields.year ? Number(fields.year) : null,
    tags: fields.tags.slice(0, MAX_PROJECT_TAGS), private: !!fields.private
  };
  let pr;
  if (id) [pr] = await run(sb.from("projects").update(row).eq("id", id).select());
  else [pr] = await run(sb.from("projects").insert(row).select());
  if (!pr) throw Object.assign(new Error("You don't have permission to do that."), { code: "permission-denied" });
  const d = { details: details.details, link: details.link };
  const updated = id ? await run(sb.from("project_details").update(d).eq("project_id", pr.id).select()) : [];
  if (!updated.length) await run(sb.from("project_details").insert({ project_id: pr.id, ...d }));
  return pr;
}

export const setPrivate = (id, value) => run(sb.from("projects").update({ private: value }).eq("id", id).select());
// Deleting a project also removes the posts about it.
export const deleteProject = id => run(sb.from("projects").delete().eq("id", id));

// A feed post about your project. Its topics come from the project.
export const postAboutProject = (pr, body) =>
  run(sb.from("posts").insert({ body, project_id: pr.id, kind: "project", tags: (pr.tags || []).slice(0, 3) }));

const ago = ts => { const t = timeAgo(ts); return /^\d+[mhd]$/.test(t) ? t + " ago" : t === "just now" ? t : "on " + t; };

export function projectMeta(pr) {
  if (!pr) return "";
  return pr.status === "completed"
    ? `Completed${pr.year ? " " + pr.year : ""}`
    : `In progress · updated ${ago(pr.updatedAt)}`;
}

export const privateBadge = `<span class="pj-private">${icon("lock", 12)}Private</span>`;

// The project box inside a feed post.
export function projectBlock(pr, authorId) {
  if (!pr) return "";
  return `<a class="post-project" href="#/u/${esc(authorId)}/projects/${esc(pr.id)}">
    <span class="row" style="gap:8px"><strong>${esc(pr.title)}</strong>${pr.private ? privateBadge : ""}</span>
    <span class="small faint">${esc(projectMeta(pr))}</span>
    <span class="small" style="color:var(--accent)">View project →</span>
  </a>`;
}

export function topicOptions() {
  return TOPICS.map(g => `<optgroup label="${esc(g.name)}">${g.topics.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</optgroup>`).join("");
}

// A link only becomes clickable if it's a normal web address.
export const safeLink = u => /^https?:\/\/[^\s]+$/i.test(u || "") ? u : "";
