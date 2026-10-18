// Network: connections (two-way, by request) and follows (one-way).
// Sending a request also follows that person; accepting follows them back.
import { sb, run, many, rows, count, changed, PROFILE_COLS } from "./supabase.js";
import { esc, initials } from "./util.js";

// The database copies each person's name, headline, field and account type onto
// connections and follows, so lists load fast.

// Connection rows, with "from" and "to" like the rest of the app expects.
const conns = list => rows(list).map(c => ({ ...c, from: c.fromId, to: c.toId }));
const pair = (a, b) => `and(from_id.eq.${a},to_id.eq.${b}),and(from_id.eq.${b},to_id.eq.${a})`;

// Where you stand with someone: none, sent, received or connected; and whether you follow them.
export async function relationship(meUid, otherUid) {
  const [c, f] = await Promise.all([
    run(sb.from("connections").select("*").or(pair(meUid, otherUid)).limit(1)),
    run(sb.from("follows").select("target").eq("follower", meUid).eq("target", otherUid))
  ]);
  let status = "none", conn = null;
  if (c.length) {
    conn = conns(c)[0];
    status = conn.status === "accepted" ? "connected" : conn.from === meUid ? "sent" : "received";
  }
  return { status, conn, following: f.length > 0 };
}

const followQuietly = target => run(sb.from("follows").upsert({ target }, { onConflict: "follower,target", ignoreDuplicates: true }));

export async function sendRequest(state, other, note = "") {
  await run(sb.from("connections").insert({ to_id: other.id, note: note.slice(0, 300) }));
  await followQuietly(other.id);
}

export async function accept(state, conn) {
  await changed(sb.from("connections").update({ status: "accepted" }).eq("id", conn.id));
  await followQuietly(conn.from);
}

// Decline, withdraw and remove are all the same thing: the connection record goes away.
export const removeConnection = connId => run(sb.from("connections").delete().eq("id", connId));

export const follow = (state, other) => followQuietly(other.id);
export const unfollow = (meUid, otherUid) => run(sb.from("follows").delete().eq("follower", meUid).eq("target", otherUid));

const C = () => sb.from("connections").select("*");
export const incoming = async uid => conns(await run(C().eq("to_id", uid).eq("status", "pending").limit(200)));
export const sent = async uid => conns(await run(C().eq("from_id", uid).eq("status", "pending").limit(200)));
export const connections = async uid => conns(await run(C().contains("users", [uid]).eq("status", "accepted").limit(1000)));
export const following = uid => many(sb.from("follows").select("*").eq("follower", uid).limit(1000));
export const followers = uid => many(sb.from("follows").select("*").eq("target", uid).limit(1000));

const head = t => sb.from(t).select("*", { count: "exact", head: true });
export async function counts(uid) {
  const n = async q => { try { return await count(q); } catch (e) { return null; } };
  const [c, fr, fg] = await Promise.all([
    n(head("connections").contains("users", [uid]).eq("status", "accepted")),
    n(head("follows").eq("target", uid)),
    n(head("follows").eq("follower", uid))
  ]);
  return { connections: c, followers: fr, following: fg };
}
export async function pendingCount(uid) {
  try { return await count(head("connections").eq("to_id", uid).eq("status", "pending")); }
  catch (e) { return 0; }
}

// Members who share interests with you, or work in your field.
export const peopleWithInterests = (interests, n) => many(sb.from("profiles").select(PROFILE_COLS).overlaps("interests", interests).eq("onboarded", true).limit(n));
export const peopleInField = (field, n) => many(sb.from("profiles").select(PROFILE_COLS).eq("field", field).eq("onboarded", true).limit(n));
export const getProfile = async uid => (await peopleById([uid]))[0] || null;
export const peopleById = ids => many(sb.from("profiles").select(PROFILE_COLS).in("id", ids));

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
