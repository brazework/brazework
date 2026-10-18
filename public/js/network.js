// Network: connections (two-way, by request) and follows (one-way).
// Sending a request also follows that person; accepting follows them back.
import {
  db, doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where, limit,
  writeBatch, serverTimestamp, getCountFromServer
} from "./firebase.js";
import { esc, initials } from "./util.js";

export const pairId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
export const followId = (follower, target) => `${follower}_${target}`;

// The few profile fields stored alongside a connection or follow, so lists load fast.
export const info = (p = {}) => ({
  firstName: p.firstName || "", lastName: p.lastName || "", headline: p.headline || "",
  field: p.field || "", accountType: p.accountType || ""
});

// Where you stand with someone: none, sent, received or connected; and whether you follow them.
export async function relationship(meUid, otherUid) {
  const [c, f] = await Promise.all([
    getDoc(doc(db, "connections", pairId(meUid, otherUid))),
    getDoc(doc(db, "follows", followId(meUid, otherUid)))
  ]);
  let status = "none", conn = null;
  if (c.exists()) {
    conn = { id: c.id, ...c.data() };
    status = conn.status === "accepted" ? "connected" : conn.from === meUid ? "sent" : "received";
  }
  return { status, conn, following: f.exists() };
}

export async function sendRequest(state, other, note = "") {
  const me = state.user.uid;
  const batch = writeBatch(db);
  batch.set(doc(db, "connections", pairId(me, other.id)), {
    users: [me, other.id], from: me, to: other.id, status: "pending", note: note.slice(0, 300),
    people: { [me]: info(state.profile), [other.id]: info(other) }, createdAt: serverTimestamp()
  });
  const f = await getDoc(doc(db, "follows", followId(me, other.id)));
  if (!f.exists()) batch.set(doc(db, "follows", followId(me, other.id)), followDoc(state, other));
  await batch.commit();
}

export async function accept(state, conn) {
  const me = state.user.uid, them = conn.from;
  const batch = writeBatch(db);
  batch.update(doc(db, "connections", conn.id), { status: "accepted", acceptedAt: serverTimestamp() });
  const f = await getDoc(doc(db, "follows", followId(me, them)));
  if (!f.exists()) batch.set(doc(db, "follows", followId(me, them)), followDoc(state, { id: them, ...(conn.people || {})[them] }));
  await batch.commit();
}

// Decline, withdraw and remove are all the same thing: the connection record goes away.
export const removeConnection = connId => deleteDoc(doc(db, "connections", connId));

function followDoc(state, other) {
  return { follower: state.user.uid, target: other.id, followerInfo: info(state.profile), targetInfo: info(other), createdAt: serverTimestamp() };
}
export const follow = (state, other) => setDoc(doc(db, "follows", followId(state.user.uid, other.id)), followDoc(state, other));
export const unfollow = (meUid, otherUid) => deleteDoc(doc(db, "follows", followId(meUid, otherUid)));

const rows = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));
export const incoming = uid => getDocs(query(collection(db, "connections"), where("to", "==", uid), where("status", "==", "pending"), limit(200))).then(rows);
export const sent = uid => getDocs(query(collection(db, "connections"), where("from", "==", uid), where("status", "==", "pending"), limit(200))).then(rows);
export const connections = uid => getDocs(query(collection(db, "connections"), where("users", "array-contains", uid), where("status", "==", "accepted"), limit(1000))).then(rows);
export const following = uid => getDocs(query(collection(db, "follows"), where("follower", "==", uid), limit(1000))).then(rows);
export const followers = uid => getDocs(query(collection(db, "follows"), where("target", "==", uid), limit(1000))).then(rows);

export async function counts(uid) {
  const n = async q => { try { return (await getCountFromServer(q)).data().count; } catch (e) { return null; } };
  const [c, fr, fg] = await Promise.all([
    n(query(collection(db, "connections"), where("users", "array-contains", uid), where("status", "==", "accepted"))),
    n(query(collection(db, "follows"), where("target", "==", uid))),
    n(query(collection(db, "follows"), where("follower", "==", uid)))
  ]);
  return { connections: c, followers: fr, following: fg };
}
export async function pendingCount(uid) {
  try { return (await getCountFromServer(query(collection(db, "connections"), where("to", "==", uid), where("status", "==", "pending")))).data().count; }
  catch (e) { return 0; }
}

// The other person in a connection record.
export function otherOf(conn, me) {
  const id = (conn.users || []).find(u => u !== me) || (conn.from === me ? conn.to : conn.from);
  return { id, ...((conn.people || {})[id] || {}) };
}

export function personRow(person, { sub = "", actions = "", note = "" } = {}) {
  return `
    <div class="person-row" data-person="${esc(person.id)}">
      <a class="avatar md" href="#/u/${esc(person.id)}">${esc(initials(person.firstName, person.lastName))}</a>
      <div class="stack" style="gap:2px;flex:1 1 220px;min-width:0">
        <a href="#/u/${esc(person.id)}" style="font-weight:600;text-decoration:none">${esc(person.firstName)} ${esc(person.lastName)}</a>
        <span class="small muted" style="overflow:hidden;text-overflow:ellipsis">${esc(person.headline || "")}</span>
        ${sub ? `<span class="small faint">${sub}</span>` : ""}
        ${note ? `<p class="small person-note">“${esc(note)}”</p>` : ""}
      </div>
      <div class="row" style="gap:8px">${actions}</div>
    </div>`;
}

// Small dialog for an optional note with a connection request. Resolves with the note, or null if cancelled.
export function askNote(person) {
  return new Promise(resolve => {
    const host = document.getElementById("overlay");
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="scrim" data-x></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cn-title" style="width:min(480px,calc(100vw - 32px))">
        <form class="stack" style="gap:16px">
          <h2 id="cn-title" style="font-size:20px">Connect with ${esc(person.firstName)}</h2>
          <div class="field"><label for="cn-note">Add a note <span class="faint small">(optional)</span></label>
            <textarea id="cn-note" class="input" maxlength="300" placeholder="Say how you know each other or what you'd like to talk about"></textarea>
            <span class="small faint" id="cn-count">0 / 300</span></div>
          <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-x>Cancel</button><button class="btn primary">Send request</button></div>
        </form>
      </div>`;
    host.appendChild(wrap);
    const ta = wrap.querySelector("#cn-note");
    ta.focus();
    ta.oninput = () => { wrap.querySelector("#cn-count").textContent = `${ta.value.length} / 300`; };
    const done = v => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = e => { if (e.key === "Escape") done(null); };
    document.addEventListener("keydown", onKey);
    wrap.querySelectorAll("[data-x]").forEach(el => el.onclick = () => done(null));
    wrap.querySelector("form").onsubmit = e => { e.preventDefault(); done(ta.value.trim()); };
  });
}
