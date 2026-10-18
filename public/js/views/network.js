// Network: invitations, connections, sent requests, following, followers and people you may know.
import { esc, friendlyError, toast, timeAgo, ms } from "../util.js";
import {
  incoming, sent, connections, following, followers, accept, removeConnection, follow, unfollow,
  sendRequest, otherOf, personRow, askNote, peopleWithInterests, peopleInField
} from "../network.js";

const TABS = [["invitations", "Invitations"], ["connections", "Connections"], ["sent", "Sent"], ["following", "Following"], ["followers", "Followers"], ["suggested", "People you may know"]];

export function render({ view, state, params, navigate }) {
  const me = state.user.uid, p = state.profile;
  let data = null, tab = params[0] && TABS.some(t => t[0] === params[0]) ? params[0] : null;
  let search = "", kind = "all", sort = "recent";

  view.innerHTML = `
    <div class="page"><div class="cols">
      <aside class="col-side">
        <section class="card stack">
          <h2 style="font-size:17px">Your network</h2>
          <div class="stack" style="gap:2px" id="n-stats">${[1, 2, 3, 4].map(() => `<div class="skeleton" style="height:34px"></div>`).join("")}</div>
        </section>
        <section class="card stack" id="n-fields" hidden></section>
      </aside>
      <section class="col-main">
        <div class="tabs" role="tablist" aria-label="Network" style="overflow-x:auto">
          ${TABS.map(([k, l]) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="false">${l}<span class="tab-count" data-count="${k}"></span></button>`).join("")}
        </div>
        <div id="n-pane" class="stack" style="gap:14px"></div>
      </section>
    </div></div>`;

  const pane = view.querySelector("#n-pane");
  const setTab = t => {
    tab = t;
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === t)));
    draw();
  };
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => setTab(b.dataset.tab));

  async function load() {
    try {
      const [inv, snt, con, fg, fr] = await Promise.all([incoming(me), sent(me), connections(me), following(me), followers(me)]);
      data = { inv, snt, con, fg, fr };
      if (!tab) tab = inv.length ? "invitations" : con.length ? "connections" : "suggested";
      view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === tab)));
      drawSide(); draw();
    } catch (e) { pane.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(e))}</p></div>`; }
  }

  function drawSide() {
    const stats = [["connections", "Connections", data.con.length], ["invitations", "Invitations", data.inv.length], ["sent", "Sent", data.snt.length], ["following", "Following", data.fg.length], ["followers", "Followers", data.fr.length]];
    const el = view.querySelector("#n-stats");
    el.innerHTML = stats.map(([k, l, n]) => `<button class="stat-row" data-go="${k}"><span>${l}</span><strong>${n}</strong></button>`).join("");
    el.querySelectorAll("[data-go]").forEach(b => b.onclick = () => setTab(b.dataset.go));
    const set = (k, n) => { const c = view.querySelector(`[data-count="${k}"]`); if (c) c.textContent = n ? ` ${n}` : ""; };
    set("invitations", data.inv.length); set("connections", data.con.length); set("sent", data.snt.length);

    const people = data.con.map(c => otherOf(c, me));
    const box = view.querySelector("#n-fields");
    if (!people.length) { box.hidden = true; return; }
    const byField = new Map();
    people.forEach(x => { const f = x.field || "Other"; byField.set(f, (byField.get(f) || 0) + 1); });
    const pros = people.filter(x => x.accountType === "professional").length, studs = people.filter(x => x.accountType === "student").length;
    const max = Math.max(...byField.values());
    box.hidden = false;
    box.innerHTML = `<h2 style="font-size:15px">Connections by field</h2>
      <div class="stack" style="gap:8px">${[...byField].sort((a, b) => b[1] - a[1]).map(([f, n]) => `
        <div class="stack" style="gap:4px"><div class="row small" style="justify-content:space-between"><span>${esc(f)}</span><span class="faint">${n}</span></div>
        <div class="bar"><span style="width:${Math.round(n / max * 100)}%"></span></div></div>`).join("")}</div>
      <div class="row small" style="gap:16px;border-top:1px solid var(--divider);padding-top:10px"><span><strong>${pros}</strong> <span class="muted">Professionals</span></span><span><strong>${studs}</strong> <span class="muted">Students</span></span></div>`;
  }

  const empty = msg => `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">${msg}</p></div>`;
  const list = rows => `<div class="card stack" style="gap:0;padding:4px 0">${rows.join("")}</div>`;

  function draw() {
    if (!data) { pane.innerHTML = `<div class="card stack">${[1, 2, 3].map(() => `<div class="skeleton" style="height:44px"></div>`).join("")}</div>`; return; }
    ({ invitations: drawInvites, connections: drawConnections, sent: drawSent, following: drawFollowing, followers: drawFollowers, suggested: drawSuggested })[tab]();
  }

  function drawInvites() {
    if (!data.inv.length) { pane.innerHTML = empty("No pending invitations. You're all caught up."); return; }
    pane.innerHTML = `
      <div class="row" style="justify-content:space-between"><span class="muted">${data.inv.length} ${data.inv.length === 1 ? "person wants" : "people want"} to connect</span>${data.inv.length > 1 ? `<button class="btn" id="accept-all">Accept all</button>` : ""}</div>
      ${list(data.inv.sort(byNewest).map(c => personRow(otherOf(c, me), {
        sub: `Sent ${esc(timeAgo(c.createdAt))}`, note: c.note,
        actions: `<button class="btn ghost" data-ignore="${esc(c.id)}">Ignore</button><button class="btn primary" data-accept="${esc(c.id)}">Accept</button>`
      })))}`;
    const doAccept = async c => {
      await accept(state, c);
      data.inv = data.inv.filter(x => x !== c);
      data.con.unshift({ ...c, status: "accepted", acceptedAt: nowTs() });
      const them = otherOf(c, me);
      if (!data.fg.some(f => f.target === them.id)) data.fg.unshift({ target: them.id, targetInfo: them, createdAt: nowTs() });
    };
    pane.querySelectorAll("[data-accept]").forEach(b => b.onclick = () => act(b, async () => {
      const c = data.inv.find(x => x.id === b.dataset.accept); await doAccept(c);
      toast(`You're now connected with <strong>${esc(otherOf(c, me).firstName)}</strong>.`);
    }));
    pane.querySelectorAll("[data-ignore]").forEach(b => b.onclick = () => act(b, async () => {
      await removeConnection(b.dataset.ignore); data.inv = data.inv.filter(x => x.id !== b.dataset.ignore);
    }));
    const all = pane.querySelector("#accept-all");
    if (all) all.onclick = () => act(all, async () => { const n = data.inv.length; for (const c of [...data.inv]) await doAccept(c); toast(`Accepted ${n} invitations.`); });
  }

  function drawConnections() {
    if (!data.con.length) {
      pane.innerHTML = empty(`No connections yet. <a href="#/network/suggested">Find people you may know</a>.`);
      return;
    }
    const q = search.trim().toLowerCase();
    let rows = data.con.map(c => ({ c, x: otherOf(c, me) }))
      .filter(({ x }) => (kind === "all" || (kind === "pro" ? x.accountType === "professional" : x.accountType === "student"))
        && (!q || `${x.firstName} ${x.lastName} ${x.headline}`.toLowerCase().includes(q)));
    rows.sort(sort === "name" ? (a, b) => `${a.x.firstName}`.localeCompare(`${b.x.firstName}`) : (a, b) => ms(b.c.acceptedAt) - ms(a.c.acceptedAt));
    pane.innerHTML = `
      <div class="row" style="gap:10px">
        <label for="n-search" class="sr-only">Search connections</label>
        <input id="n-search" class="input" type="search" placeholder="Search connections" value="${esc(search)}" style="flex:1 1 220px">
        <label for="n-sort" class="sr-only">Sort</label>
        <select id="n-sort" class="input" style="width:auto"><option value="recent"${sort === "recent" ? " selected" : ""}>Recently added</option><option value="name"${sort === "name" ? " selected" : ""}>First name</option></select>
      </div>
      <div class="row" style="gap:6px">${[["all", "All"], ["pro", "Professionals"], ["student", "Students"]].map(([k, l]) => `<button class="chip sm" data-kind="${k}" aria-pressed="${k === kind}">${l}</button>`).join("")}</div>
      ${rows.length ? list(rows.map(({ c, x }) => personRow(x, {
        sub: `Connected ${esc(timeAgo(c.acceptedAt))}`,
        actions: `<button class="btn ghost" disabled title="Messages are coming soon">Message</button><button class="btn ghost" data-remove="${esc(c.id)}">Remove</button>`
      }))) : empty("No connections match.")}`;
    const input = pane.querySelector("#n-search");
    input.oninput = () => { search = input.value; drawConnections(); const i = pane.querySelector("#n-search"); i.focus(); i.setSelectionRange(i.value.length, i.value.length); };
    pane.querySelector("#n-sort").onchange = e => { sort = e.target.value; drawConnections(); };
    pane.querySelectorAll("[data-kind]").forEach(b => b.onclick = () => { kind = b.dataset.kind; drawConnections(); });
    pane.querySelectorAll("[data-remove]").forEach(b => b.onclick = () => {
      const c = data.con.find(x => x.id === b.dataset.remove), x = otherOf(c, me);
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = `Remove ${x.firstName}?`; return; }
      act(b, async () => { await removeConnection(c.id); data.con = data.con.filter(y => y !== c); drawSide(); toast(`Removed ${esc(x.firstName)} from your connections.`); });
    });
  }

  function drawSent() {
    if (!data.snt.length) { pane.innerHTML = empty("No pending sent invitations."); return; }
    pane.innerHTML = `<p class="small muted">Invitations you've sent that haven't been answered yet.</p>` + list(data.snt.sort(byNewest).map(c => personRow(otherOf(c, me), {
      sub: `Sent ${esc(timeAgo(c.createdAt))}`, note: c.note,
      actions: `<button class="btn ghost" data-withdraw="${esc(c.id)}">Withdraw</button>`
    })));
    pane.querySelectorAll("[data-withdraw]").forEach(b => b.onclick = () => act(b, async () => {
      await removeConnection(b.dataset.withdraw); data.snt = data.snt.filter(x => x.id !== b.dataset.withdraw); toast("Invitation withdrawn.");
    }));
  }

  function drawFollowing() {
    if (!data.fg.length) { pane.innerHTML = empty("You're not following anyone yet. Following someone puts their posts in your Following feed."); return; }
    pane.innerHTML = `<p class="small muted">People whose posts appear in your Following feed. Sending or accepting a connection request follows them automatically.</p>` +
      list(data.fg.sort(byNewest).map(f => personRow({ id: f.target, ...(f.targetInfo || {}) }, {
        actions: `<button class="btn ghost" data-unfollow="${esc(f.target)}">Following ✓</button>`
      })));
    pane.querySelectorAll("[data-unfollow]").forEach(b => b.onclick = () => act(b, async () => {
      await unfollow(me, b.dataset.unfollow); data.fg = data.fg.filter(x => x.target !== b.dataset.unfollow);
    }));
  }

  function drawFollowers() {
    if (!data.fr.length) { pane.innerHTML = empty("No followers yet. Share posts and projects and people will start following you."); return; }
    const mine = new Set(data.fg.map(f => f.target));
    pane.innerHTML = list(data.fr.sort(byNewest).map(f => personRow({ id: f.follower, ...(f.followerInfo || {}) }, {
      sub: `Followed you ${esc(timeAgo(f.createdAt))}`,
      actions: mine.has(f.follower) ? `<span class="small faint">Following</span>` : `<button class="btn" data-followback="${esc(f.follower)}">Follow back</button>`
    })));
    pane.querySelectorAll("[data-followback]").forEach(b => b.onclick = () => act(b, async () => {
      const f = data.fr.find(x => x.follower === b.dataset.followback);
      await follow(state, { id: f.follower, ...(f.followerInfo || {}) });
      data.fg.unshift({ target: f.follower, targetInfo: f.followerInfo, createdAt: nowTs() });
    }));
  }

  async function drawSuggested() {
    pane.innerHTML = `<div class="card stack">${[1, 2, 3].map(() => `<div class="skeleton" style="height:44px"></div>`).join("")}</div>`;
    const interests = p.interests || [];
    const known = new Set([me, ...data.con.map(c => otherOf(c, me).id), ...data.snt.map(c => c.to), ...data.inv.map(c => c.from)]);
    try {
      const found = new Map();
      if (interests.length) (await peopleWithInterests(interests, 40)).forEach(u => found.set(u.id, u));
      if (p.field) (await peopleInField(p.field, 20)).forEach(u => found.set(u.id, u));
      const mineI = new Set(interests);
      const people = [...found].filter(([id, u]) => !known.has(id) && u.onboarded)
        .map(([id, u]) => ({ id, ...u, shared: (u.interests || []).filter(t => mineI.has(t)) }))
        .sort((a, b) => b.shared.length - a.shared.length || ((b.field === p.field) - (a.field === p.field))).slice(0, 20);
      if (tab !== "suggested") return;
      if (!people.length) { pane.innerHTML = empty("No suggestions right now. As more people join in your fields, they'll show up here."); return; }
      pane.innerHTML = `<p class="small muted">Based on your field and interests.</p>` + list(people.map(x => personRow(x, {
        sub: x.shared.length ? `${x.shared.length} shared interest${x.shared.length > 1 ? "s" : ""}: ${esc(x.shared.slice(0, 2).join(", "))}` : esc(x.field || ""),
        actions: `<button class="btn primary" data-connect="${esc(x.id)}">Connect</button>`
      })));
      pane.querySelectorAll("[data-connect]").forEach(b => b.onclick = async () => {
        const x = people.find(y => y.id === b.dataset.connect);
        const note = await askNote(x); if (note === null) return;
        act(b, async () => {
          await sendRequest(state, x, note);
          data.snt = await sent(me);
          if (!data.fg.some(f => f.target === x.id)) data.fg.unshift({ target: x.id, targetInfo: x, createdAt: nowTs() });
          toast(`Request sent to <strong>${esc(x.firstName)}</strong>.`);
        }, true);
      });
    } catch (e) { pane.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(e))}</p></div>`; }
  }

  // Runs an action; afterwards redraws so lists and counts stay right.
  async function act(btn, fn, keepPane) {
    btn.disabled = true;
    try { await fn(); drawSide(); if (!keepPane) draw(); else { btn.textContent = "Pending"; } }
    catch (e) { toast(esc(friendlyError(e))); btn.disabled = false; }
  }

  draw();
  load();
}

// A stand-in timestamp for things just created on this page.
const nowTs = () => new Date().toISOString();
const byNewest = (a, b) => ms(b.createdAt) - ms(a.createdAt);
