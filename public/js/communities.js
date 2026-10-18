// Communities: roles, joining and leaving, requests, moderation and auto-moderation.
import {
  db, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection, collectionGroup, query, where, limit,
  runTransaction, writeBatch, serverTimestamp
} from "./firebase.js";
import { esc, toast, friendlyError } from "./util.js";

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
export const postsCol = cid => `communities/${cid}/posts`;
export const membersLabel = n => `${fmtCount(n)} ${Number(n) === 1 ? "member" : "members"}`;
export const fmtCount = n => { n = Number(n || 0); return n >= 10000 ? Math.round(n / 1000) + "k" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(n); };

export async function getCommunity(cid) {
  const s = await getDoc(doc(db, "communities", cid));
  return s.exists() ? { id: s.id, ...s.data() } : null;
}

export async function getMembership(cid, uid) {
  const s = await getDoc(doc(db, "communities", cid, "members", uid));
  return s.exists() ? s.data() : null;
}

// Every community you belong to, with your role, most recently joined first.
export async function myCommunities(uid) {
  const snap = await getDocs(query(collectionGroup(db, "members"), where("uid", "==", uid), limit(100)));
  const rows = await Promise.all(snap.docs.map(async d => {
    const cid = d.ref.parent.parent.id;
    try { const c = await getCommunity(cid); return c ? { ...c, myRole: d.data().role, joinedAt: d.data().joinedAt } : null; }
    catch (e) { return null; }
  }));
  const ms = t => (t && t.toMillis ? t.toMillis() : 0);
  return rows.filter(Boolean).sort((a, b) => ms(b.joinedAt) - ms(a.joinedAt));
}

const memberDoc = (p, uid, role) => ({
  uid, role, firstName: p.firstName || "", lastName: p.lastName || "", headline: p.headline || "", joinedAt: serverTimestamp()
});

export async function createCommunity(state, { name, about, field, type, privacy, topics, rules }) {
  const uid = state.user.uid, p = state.profile;
  const ref = doc(collection(db, "communities"));
  const batch = writeBatch(db);
  batch.set(ref, {
    name, nameLower: name.toLowerCase(), about, field, type, privacy, topics, rules: rules || "",
    ownerId: uid, ownerName: `${p.firstName} ${p.lastName}`, memberCount: 1, lastMemberChange: uid,
    automod: { words: [], holdNewLinks: false }, createdAt: serverTimestamp()
  });
  batch.set(doc(db, "communities", ref.id, "members", uid), memberDoc(p, uid, "owner"));
  await batch.commit();
  return ref.id;
}

// Adds a member and moves the member count by one, together.
async function addMember(cid, uid, data, alsoDelete) {
  const cRef = doc(db, "communities", cid);
  await runTransaction(db, async tx => {
    const c = await tx.get(cRef);
    if (!c.exists()) throw Object.assign(new Error("This community no longer exists."), { code: "not-found" });
    tx.set(doc(db, "communities", cid, "members", uid), data);
    tx.update(cRef, { memberCount: Number(c.data().memberCount || 0) + 1, lastMemberChange: uid });
    if (alsoDelete) tx.delete(alsoDelete);
  });
}

async function dropMember(cid, uid, banRef) {
  const cRef = doc(db, "communities", cid);
  await runTransaction(db, async tx => {
    const c = await tx.get(cRef);
    tx.delete(doc(db, "communities", cid, "members", uid));
    if (c.exists()) tx.update(cRef, { memberCount: Math.max(0, Number(c.data().memberCount || 0) - 1), lastMemberChange: uid });
    if (banRef) tx.set(banRef.ref, banRef.data);
  });
}

// Public: join right away. Approval required: send a request.
export async function join(c, state) {
  const uid = state.user.uid, p = state.profile;
  if (c.privacy === "public") { await addMember(c.id, uid, memberDoc(p, uid, "member")); return "joined"; }
  await setDoc(doc(db, "communities", c.id, "requests", uid), {
    uid, firstName: p.firstName || "", lastName: p.lastName || "", headline: p.headline || "", at: serverTimestamp()
  });
  return "requested";
}
export const cancelRequest = (cid, uid) => deleteDoc(doc(db, "communities", cid, "requests", uid));
export async function hasRequested(cid, uid) {
  try { return (await getDoc(doc(db, "communities", cid, "requests", uid))).exists(); } catch (e) { return false; }
}
export const leave = (cid, uid) => dropMember(cid, uid);

export async function approve(cid, req) {
  await addMember(cid, req.uid, {
    uid: req.uid, role: "member", firstName: req.firstName || "", lastName: req.lastName || "", headline: req.headline || "", joinedAt: serverTimestamp()
  }, doc(db, "communities", cid, "requests", req.uid));
}
export const decline = (cid, uid) => deleteDoc(doc(db, "communities", cid, "requests", uid));
export const setRole = (cid, uid, role) => updateDoc(doc(db, "communities", cid, "members", uid), { role });
export function removeMember(cid, member, state, ban = false) {
  return dropMember(cid, member.uid, ban ? {
    ref: doc(db, "communities", cid, "bans", member.uid),
    data: { uid: member.uid, name: `${member.firstName} ${member.lastName}`, by: state.user.uid, at: serverTimestamp() }
  } : null);
}
export const unban = (cid, uid) => deleteDoc(doc(db, "communities", cid, "bans", uid));

// Auto-moderation runs when someone posts. Matching posts are held for a moderator.
export function autoModVerdict(c, membership, text) {
  const am = c.automod || {};
  if (rank(membership && membership.role) >= 3) return { status: "visible" }; // moderators and above are never held
  const lower = text.toLowerCase();
  const hit = (am.words || []).find(w => w && lower.includes(String(w).toLowerCase()));
  if (hit) return { status: "held", note: "Your post is waiting for a moderator's review because it matched one of this community's filters." };
  if (am.holdNewLinks && /https?:\/\/|www\./i.test(text)) {
    const j = membership && membership.joinedAt && membership.joinedAt.toMillis ? membership.joinedAt.toMillis() : Date.now();
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
