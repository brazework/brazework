// Communities hub: the communities you're in, discovery, and creating a new one.
import { esc, friendlyError, toast, FIELDS, TOPICS } from "../util.js";
import {
  myCommunities, createCommunity, badge, fmtCount, membersLabel, PRIVACY, PRIVACY_LABEL, TYPES, TYPE_LABEL, ROLE_LABEL,
  hasRequested, runJoinAction, topCommunities, nameTaken
} from "../communities.js";

export function render({ view, state, navigate, params }) {
  const p = state.profile, uid = state.user.uid;
  const interests = new Set(p.interests || []);
  let tab = params[0] === "discover" ? "discover" : "yours";
  let mine = null, all = null, search = "", fieldFilter = "";

  view.innerHTML = `
    <div class="page stack" style="gap:20px;max-width:1000px">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div class="stack" style="gap:6px">
          <div class="kicker">Communities</div>
          <h1 style="font-size:30px">Communities</h1>
          <p class="muted">Keep up with the groups you're in and find new ones in your field.</p>
        </div>
        <button class="btn primary" id="c-create">+ Create community</button>
      </div>
      <div class="tabs" role="tablist" aria-label="Communities">
        <button class="tab" role="tab" data-tab="yours">Your communities <span class="faint" id="c-count"></span></button>
        <button class="tab" role="tab" data-tab="discover">Discover</button>
      </div>
      <div id="c-body" class="stack" style="gap:14px"></div>
    </div>`;

  const body = view.querySelector("#c-body");
  view.querySelector("#c-create").onclick = () => openCreate(state, navigate);

  const isMatch = c => (c.topics || []).some(t => interests.has(t)) || (c.field && c.field === p.field);

  const drawYours = () => {
    if (!mine) { body.innerHTML = skeleton(); return; }
    if (!mine.length) {
      body.innerHTML = `<div class="card stack" style="text-align:center;border-style:dashed;align-items:center;padding:40px">
        <p class="muted">You haven't joined any communities yet.</p>
        <div class="row" style="justify-content:center"><button class="btn primary" data-go-discover>Discover communities</button><button class="btn" data-create>Start one</button></div></div>`;
      body.querySelector("[data-go-discover]").onclick = () => setTab("discover");
      body.querySelector("[data-create]").onclick = () => openCreate(state, navigate);
      return;
    }
    body.innerHTML = mine.map(c => `
      <article class="card c-row">
        ${badge(c, 52)}
        <div class="stack" style="gap:4px;flex:1 1 260px;min-width:0">
          <div class="row" style="gap:8px"><a href="#/c/${esc(c.id)}" class="c-name">${esc(c.name)}</a><span class="role-chip role-${esc(c.myRole)}">${esc(ROLE_LABEL[c.myRole] || "Member")}</span></div>
          <span class="small faint">${membersLabel(c.memberCount)} · ${esc(PRIVACY_LABEL[c.privacy] || "")} · ${esc(c.field || "")}</span>
          <p class="small muted c-about">${esc(c.about || "")}</p>
        </div>
        <div class="row" style="gap:8px">
          <a class="btn primary" href="#/c/${esc(c.id)}">Open</a>
          ${["owner", "admin", "moderator", "helper"].includes(c.myRole) ? `<a class="btn" href="#/c/${esc(c.id)}/manage">Manage</a>` : ""}
        </div>
      </article>`).join("");
  };

  const drawDiscover = () => {
    const fields = ["", ...FIELDS];
    body.innerHTML = `
      <div class="stack" style="gap:12px">
        <label for="c-search" class="sr-only">Search communities</label>
        <input id="c-search" class="input" type="search" placeholder="Search communities" value="${esc(search)}">
        <div class="row" style="gap:6px">${fields.map(f => `<button class="chip sm" data-field="${esc(f)}" aria-pressed="${f === fieldFilter}">${f ? esc(f) : "All fields"}</button>`).join("")}</div>
      </div>
      <div id="c-results" class="stack" style="gap:14px">${skeleton()}</div>`;
    const input = body.querySelector("#c-search");
    input.oninput = () => { search = input.value; drawResults(); };
    body.querySelectorAll("[data-field]").forEach(b => b.onclick = () => {
      fieldFilter = b.dataset.field;
      body.querySelectorAll("[data-field]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      drawResults();
    });
    drawResults();
  };

  const drawResults = async () => {
    const el = body.querySelector("#c-results"); if (!el) return;
    if (!all) { el.innerHTML = skeleton(); return; }
    const myIds = new Set((mine || []).map(c => c.id));
    const q = search.trim().toLowerCase();
    let list = all.filter(c => (!fieldFilter || c.field === fieldFilter)
      && (!q || (c.name || "").toLowerCase().includes(q) || (c.about || "").toLowerCase().includes(q) || (c.topics || []).some(t => t.toLowerCase().includes(q))));
    list.sort((a, b) => (isMatch(b) - isMatch(a)) || (Number(b.memberCount || 0) - Number(a.memberCount || 0)));
    if (!list.length) {
      el.innerHTML = `<div class="card stack" style="text-align:center;border-style:dashed;align-items:center;padding:36px">
        <p class="muted">${all.length ? "No communities match that yet." : "There are no communities on Forge yet."} Why not start one?</p>
        <button class="btn primary" data-create>Create community</button></div>`;
      el.querySelector("[data-create]").onclick = () => openCreate(state, navigate);
      return;
    }
    el.innerHTML = list.map(c => `
      <article class="card c-row" data-cid="${esc(c.id)}">
        ${badge(c, 52)}
        <div class="stack" style="gap:4px;flex:1 1 260px;min-width:0">
          <a href="#/c/${esc(c.id)}" class="c-name">${esc(c.name)}</a>
          <span class="small faint">${membersLabel(c.memberCount)} · ${esc(PRIVACY_LABEL[c.privacy] || "")} · ${esc(c.field || "")} · ${esc(TYPE_LABEL[c.type] || "")}</span>
          ${isMatch(c) ? `<span class="post-reason">Matches your interests</span>` : ""}
          <p class="small muted c-about">${esc(c.about || "")}</p>
        </div>
        <div class="row" style="gap:8px">
          ${myIds.has(c.id)
            ? `<a class="btn" href="#/c/${esc(c.id)}">Open</a>`
            : `<button class="btn primary" data-join="${esc(c.id)}">${c.privacy === "public" ? "Join" : "Request to join"}</button>`}
        </div>
      </article>`).join("");
    el.querySelectorAll("[data-join]").forEach(btn => {
      const c = all.find(x => x.id === btn.dataset.join);
      if (c.privacy !== "public") hasRequested(c.id, uid).then(r => { if (r) { btn.dataset.state = "requested"; btn.textContent = "Requested · withdraw"; btn.classList.remove("primary"); } });
      btn.onclick = () => runJoinAction(btn, c, state, null, async () => {
        if (c.privacy === "public") { mine = await myCommunities(uid).catch(() => mine); countLabel(); drawResults(); }
        else if (btn.dataset.state === "requested") { btn.dataset.state = ""; btn.textContent = "Request to join"; btn.classList.add("primary"); btn.disabled = false; }
        else { btn.dataset.state = "requested"; btn.textContent = "Requested · withdraw"; btn.classList.remove("primary"); btn.disabled = false; }
      });
    });
  };

  const countLabel = () => { view.querySelector("#c-count").textContent = mine ? `· ${mine.length}` : ""; };
  function setTab(t) {
    tab = t;
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === t)));
    t === "yours" ? drawYours() : drawDiscover();
  }
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => setTab(b.dataset.tab));
  setTab(tab);

  myCommunities(uid).then(r => { mine = r; countLabel(); tab === "yours" ? drawYours() : drawResults(); })
    .catch(e => { mine = []; body.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(e))}</p></div>`; });
  topCommunities(200)
    .then(list => { all = list; if (tab === "discover") drawResults(); })
    .catch(e => { all = []; if (tab === "discover") toast(esc(friendlyError(e))); });
}

function skeleton() {
  return Array.from({ length: 3 }, () => `<div class="card row" aria-hidden="true"><div class="skeleton" style="width:52px;height:52px;border-radius:12px"></div><div class="stack" style="gap:8px;flex:1"><div class="skeleton" style="width:40%;height:14px"></div><div class="skeleton" style="width:60%;height:10px"></div></div></div>`).join("");
}

/* ---------- Create a community ---------- */

export function openCreate(state, navigate) {
  if (document.getElementById("create-wrap")) return;
  const host = document.getElementById("overlay");
  const wrap = document.createElement("div");
  wrap.id = "create-wrap";
  const topicOptions = TOPICS.map(g => `<optgroup label="${esc(g.name)}">${g.topics.map(t => `<option value="${esc(t)}">${esc(t)}</option>`).join("")}</optgroup>`).join("");
  wrap.innerHTML = `
    <div class="scrim" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="cc-title">
      <form class="stack" style="gap:18px" id="cc-form" novalidate>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div class="stack" style="gap:4px"><h2 id="cc-title" style="font-size:22px">Create a community</h2><p class="small muted">Bring people together around a field, project, school or goal.</p></div>
          <button type="button" class="btn ghost" data-close aria-label="Close" style="min-height:36px;padding:0 10px;font-size:20px">×</button>
        </div>
        <div class="field"><label for="cc-name">Community name</label><input id="cc-name" class="input" maxlength="60" placeholder="e.g. Robotics Builders"></div>
        <div class="field"><label for="cc-about">What's it about?</label><textarea id="cc-about" class="input" maxlength="500" placeholder="Who it's for and what members do here"></textarea></div>
        <div class="field"><label for="cc-field">Main field</label>
          <select id="cc-field" class="input"><option value="">Choose a field</option>${[...FIELDS, "All of STEM"].map(f => `<option${f === state.profile.field ? " selected" : ""}>${esc(f)}</option>`).join("")}</select></div>
        <div class="stack" style="gap:8px"><span class="label">Type</span>
          <div class="row" style="gap:6px">${TYPES.map(([k, l], i) => `<button type="button" class="chip sm" data-type="${k}" aria-pressed="${i === 0}">${l}</button>`).join("")}</div></div>
        <div class="stack" style="gap:8px"><span class="label">Topics <span class="faint small">(up to 3, helps people find it)</span></span>
          <div class="row" style="gap:6px" id="cc-topics"></div>
          <label for="cc-topic-add" class="sr-only">Add a topic</label>
          <select id="cc-topic-add" class="input" style="max-width:300px;min-height:40px"><option value="">Add a topic…</option>${topicOptions}</select></div>
        <div class="stack" style="gap:8px"><span class="label">Who can join?</span>
          ${PRIVACY.map(([k, l, h], i) => `<button type="button" class="choice" data-privacy="${k}" aria-pressed="${i === 0}"><strong>${l}</strong><span class="small muted">${h}</span></button>`).join("")}</div>
        <div class="field"><label for="cc-rules">Community rules <span class="faint small">(optional)</span></label><textarea id="cc-rules" class="input" maxlength="1500" placeholder="1. Be respectful.\n2. Share your work, not spam."></textarea></div>
        <p class="error" id="cc-error" role="alert"></p>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" id="cc-submit">Create community</button></div>
      </form>
    </div>`;
  host.appendChild(wrap);
  const $ = s => wrap.querySelector(s);
  $("#cc-name").focus();

  let type = "field", privacy = "public";
  const topics = new Set();
  const drawTopics = () => {
    $("#cc-topics").innerHTML = topics.size
      ? [...topics].map(t => `<button type="button" class="chip sm" aria-pressed="true" data-rm="${esc(t)}">${esc(t)} ×</button>`).join("")
      : `<span class="small faint">None yet</span>`;
  };
  drawTopics();
  $("#cc-topics").onclick = e => { const b = e.target.closest("[data-rm]"); if (b) { topics.delete(b.dataset.rm); drawTopics(); } };
  $("#cc-topic-add").onchange = e => {
    const t = e.target.value; e.target.value = "";
    if (!t) return;
    if (topics.size >= 3 && !topics.has(t)) { toast("Pick up to 3 topics."); return; }
    topics.add(t); drawTopics();
  };
  wrap.querySelectorAll("[data-type]").forEach(b => b.onclick = () => { type = b.dataset.type; wrap.querySelectorAll("[data-type]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
  wrap.querySelectorAll("[data-privacy]").forEach(b => b.onclick = () => { privacy = b.dataset.privacy; wrap.querySelectorAll("[data-privacy]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });

  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.querySelectorAll("[data-close]").forEach(el => el.onclick = close);

  $("#cc-form").onsubmit = async e => {
    e.preventDefault();
    const err = $("#cc-error"); err.textContent = "";
    const name = $("#cc-name").value.trim().replace(/\s+/g, " ");
    const about = $("#cc-about").value.trim();
    const field = $("#cc-field").value;
    if (name.length < 3) { err.textContent = "Give your community a name (at least 3 characters)."; return; }
    if (!about) { err.textContent = "Add a sentence about what the community is for."; return; }
    if (!field) { err.textContent = "Choose a main field."; return; }
    const btn = $("#cc-submit"); btn.disabled = true; btn.textContent = "Creating…";
    try {
      if (await nameTaken(name)) { err.textContent = "A community with that name already exists. Try another name."; btn.disabled = false; btn.textContent = "Create community"; return; }
      const id = await createCommunity(state, { name, about, field, type, privacy, topics: [...topics], rules: $("#cc-rules").value.trim() });
      close();
      toast(`<strong>${esc(name)}</strong> is live. Invite people by sharing its page.`, 7000);
      navigate(`c/${id}`);
    } catch (ex) { err.textContent = friendlyError(ex); btn.disabled = false; btn.textContent = "Create community"; }
  };
}
