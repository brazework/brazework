// Communities: roles, joining and leaving, requests, moderation and auto-moderation.
import { sb, run, row, many, one, changed } from "./supabase.js";
import { esc, toast, friendlyError, ms } from "./util.js";

export const ROLE_LABEL = { owner: "Owner", admin: "Admin", moderator: "Moderator", helper: "Helper", member: "Member" };
export const RANK = { owner: 5, admin: 4, moderator: 3, helper: 2, member: 1 };
export const rank = role => RANK[role] || 0;

// What each role can do. The database rules enforce the same thing.
export const PERMS = [
  ["approve", "Approve join requests", 2],
  ["removePosts", "Remove posts and comments", 3],
  ["review", "Review held posts", 3],
  ["removeMembers", "Remove and ban members below them", 3],
  ["roles", "Assign roles below their own", 4],
  ["editInfo", "Edit community info and rules", 4],
  ["automod", "Set up auto-moderation", 4]
];
export const can = (role, perm) => { const row = PERMS.find(x => x[0] === perm); return !!row && rank(role) >= row[2]; };

export const TYPES = [["field", "Field community"], ["study", "Study group"], ["project", "Project team"], ["school", "School & alumni"]];
export const TYPE_LABEL = Object.fromEntries(TYPES);
export const PRIVACY = [
  ["public", "Public", "Anyone on Forge can find it, read it and join."],
  ["approval", "Approval required", "Anyone can find it; posts are for members, and you approve who joins."]
];
export const PRIVACY_LABEL = { public: "Public", approval: "Approval required" };

const TINTS = ["#3B4B63", "#4A3B5E", "#2F5249", "#5C4632", "#3A4E5C", "#503A44"];
export function tint(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return TINTS[h % TINTS.length]; }
export function cInitials(name) {
  return String(name || "").trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "C";
}
export function badge(c, size = 44) {
  return `<span class="c-badge" style="width:${size}px;height:${size}px;font-size:${Math.round(size / 3)}px;background:${tint(c.id)}">${esc(cInitials(c.name))}</span>`;
}
export const membersLabel = n => `${fmtCount(n)} ${Number(n) === 1 ? "member" : "members"}`;
export const fmtCount = n => { n = Number(n || 0); return n >= 10000 ? Math.round(n / 1000) + "k" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); };

export const getCommunity = cid => one(sb.from("communities").select("*").eq("id", cid));
export const getMembership = (cid, uid) => one(sb.from("community_members").select("*").eq("community_id", cid).eq("uid", uid));

// Communities with the most members first (for Discover and suggestions).
export const topCommunities = (n = 200) => many(sb.from("communities").select("*").order("member_count", { ascending: false }).limit(n));
export async function nameTaken(name) {
  return (await run(sb.from("communities").select("id").eq("name_lower", name.toLowerCase()).limit(1))).length > 0;
}

// Every community you belong to, with your role, most recently joined first.
export async function myCommunities(uid) {
  const rs = await run(sb.from("community_members").select("role, joined_at, communities(*)").eq("uid", uid).limit(100));
  return rs.filter(r => r.communities)
    .map(r => ({ ...row(r.communities), myRole: r.role, joinedAt: r.joined_at }))
    .sort((a, b) => ms(b.joinedAt) - ms(a.joinedAt));
}

// Creates the community with you as owner, in one step.
export async function createCommunity(state, { name, about, field, type, privacy, topics, rules }) {
  return run(sb.rpc("create_community", {
    p_name: name, p_about: about, p_field: field, p_type: type, p_privacy: privacy, p_topics: topics, p_rules: rules || ""
  }));
}

// Public: join right away. Approval required: send a request.
// The database fills in your name and moves the member count.
export async function join(c, state) {
  if (c.privacy === "public") {
    await run(sb.from("community_members").insert({ community_id: c.id, uid: state.user.uid, role: "member" }));
    return "joined";
  }
  await run(sb.from("community_requests").insert({ community_id: c.id }));
  return "requested";
}
export const cancelRequest = (cid, uid) => run(sb.from("community_requests").delete().eq("community_id", cid).eq("uid", uid));
export async function hasRequested(cid, uid) {
  try { return (await run(sb.from("community_requests").select("uid").eq("community_id", cid).eq("uid", uid))).length > 0; }
  catch (e) { return false; }
}
export const leave = (cid, uid) => run(sb.from("community_members").delete().eq("community_id", cid).eq("uid", uid));

export const requests = cid => many(sb.from("community_requests").select("*").eq("community_id", cid).order("at", { ascending: true }).limit(100));
export const members = (cid, n = 500) => many(sb.from("community_members").select("*").eq("community_id", cid).limit(n));
export const bans = cid => many(sb.from("community_bans").select("*").eq("community_id", cid));
export const heldPosts = cid => many(sb.from("posts").select("*").eq("community_id", cid).eq("status", "held").order("created_at", { ascending: false }).limit(100));
export const visiblePosts = (cids, n = 50) => many(sb.from("posts").select("*").in("community_id", cids).eq("status", "visible").order("created_at", { ascending: false }).limit(n));

export const approve = (cid, req) => run(sb.rpc("approve_request", { p_cid: cid, p_uid: req.uid }));
export const decline = (cid, uid) => run(sb.from("community_requests").delete().eq("community_id", cid).eq("uid", uid));
export const setRole = (cid, uid, role) => changed(sb.from("community_members").update({ role }).eq("community_id", cid).eq("uid", uid));
export async function removeMember(cid, member, state, ban = false) {
  // The ban goes in first, while they're still a member, so the database can check their role.
  if (ban) await run(sb.from("community_bans").insert({ community_id: cid, uid: member.uid }));
  await changed(sb.from("community_members").delete().eq("community_id", cid).eq("uid", member.uid));
}
export const unban = (cid, uid) => run(sb.from("community_bans").delete().eq("community_id", cid).eq("uid", uid));
export const approvePost = id => changed(sb.from("posts").update({ status: "visible" }).eq("id", id));
// changes: any of name, about, field, type, privacy, rules, topics, automod.
export const updateCommunity = (cid, changes) => changed(sb.from("communities").update(changes).eq("id", cid));

// Auto-moderation runs when someone posts. Matching posts are held for a moderator.
export function autoModVerdict(c, membership, text) {
  const am = c.automod || {};
  if (rank(membership && membership.role) >= 3) return { status: "visible" }; // moderators and above are never held
  const lower = text.toLowerCase();
  const hit = (am.words || []).find(w => w && lower.includes(String(w).toLowerCase()));
  if (hit) return { status: "held", note: "Your post is waiting for a moderator's review because it matched one of this community's filters." };
  if (am.holdNewLinks && /https?:\/\/|www\./i.test(text)) {
    const j = membership && membership.joinedAt ? ms(membership.joinedAt) : Date.now();
    if (Date.now() - j < 7 * 86400000) return { status: "held", note: "Posts with links from members who joined this week are reviewed first. A moderator will look at it soon." };
  }
  return { status: "visible" };
}

// Shared Join / Leave / Requested button behaviour.
export async function runJoinAction(btn, c, state, membership, onDone) {
  const uid = state.user.uid;
  btn.disabled = true;
  try {
    if (membership) {
      if (membership.role === "owner") { toast("Owners can't leave their own community."); btn.disabled = false; return; }
      if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Click again to leave"; btn.disabled = false; return; }
      await leave(c.id, uid); toast(`You left ${esc(c.name)}.`);
    } else if (btn.dataset.state === "requested") {
      await cancelRequest(c.id, uid); toast("Request withdrawn.");
    } else {
      const r = await join(c, state);
      toast(r === "joined" ? `Welcome to <strong>${esc(c.name)}</strong>.` : "Request sent. You'll be in once a moderator approves it.");
    }
    onDone && onDone();
  } catch (e) { toast(esc(friendlyError(e))); btn.disabled = false; }
}

// Table of permissions by role.
export function rolesTable() {
  const roles = ["owner", "admin", "moderator", "helper"];
  return `<div class="perm-table" role="table" aria-label="What each role can do">
    <div class="perm-row perm-head" role="row"><span role="columnheader">Permission</span>${roles.map(r => `<span role="columnheader">${ROLE_LABEL[r]}</span>`).join("")}</div>
    ${PERMS.map(([k, l]) => `<div class="perm-row" role="row"><span role="cell">${esc(l)}</span>${roles.map(r => `<span role="cell" class="${can(r, k) ? "yes" : "no"}">${can(r, k) ? "✓" : "—"}</span>`).join("")}</div>`).join("")}
  </div>`;
}
