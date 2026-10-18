// Manage a community: join requests, held posts, members and roles, auto-moderation and settings.
// What you see depends on your role; the database rules enforce the same limits.
import { live } from "../supabase.js";
import { esc, initials, friendlyError, toast, timeAgo, FIELDS } from "../util.js";
import { deletePost } from "../posts.js";
import {
  approve, decline, setRole, removeMember, unban, rank, membersLabel, ROLE_LABEL, RANK, badge, PRIVACY, TYPES, rolesTable,
  getCommunity, requests, heldPosts, members as membersOf, bans as bansOf, approvePost, updateCommunity
} from "../communities.js";

export function render({ view, state, navigate, c, me }) {
  const cid = c.id, uid = state.user.uid;
  const myRank = rank(me && me.role);
  if (myRank < 2) {
    view.innerHTML = `<div class="page"><div class="card stack"><h1 style="font-size:22px">Moderators only</h1><p class="muted">Only this community's helpers, moderators, admins and owner can open this page.</p><a class="btn" href="#/c/${esc(cid)}">Back to ${esc(c.name)}</a></div></div>`;
    return;
  }

  const tabs = [
    ["requests", "Join requests", 2],
    ["review", "Review queue", 3],
    ["members", "Members & roles", 3],
    ["automod", "Auto-moderation", 4],
    ["settings", "Settings", 4],
    ["roles", "What roles can do", 2]
  ].filter(t => myRank >= t[2]);

  view.innerHTML = `
    <div class="page stack" style="gap:20px;max-width:1000px">
      <a href="#/c/${esc(cid)}" class="small muted" style="text-decoration:none">← Back to ${esc(c.name)}</a>
      <div class="row" style="gap:16px">
        ${badge(c, 56)}
        <div class="stack" style="gap:4px"><h1 style="font-size:26px">Manage ${esc(c.name)}</h1>
          <span class="muted small" id="m-sub">You're ${me.role === "owner" ? "the owner" : `a${me.role === "admin" ? "n" : ""} ${ROLE_LABEL[me.role].toLowerCase()}`} · ${membersLabel(c.memberCount)}</span></div>
      </div>
      <div class="tabs" role="tablist" aria-label="Manage">${tabs.map(([k, l], i) => `<button class="tab" role="tab" data-tab="${k}" aria-selected="${i === 0}">${l}<span class="tab-count" data-count="${k}"></span></button>`).join("")}</div>
      <div id="m-pane" class="stack" style="gap:14px"></div>
    </div>`;

  const pane = view.querySelector("#m-pane");
  let stop = null;
  const show = t => {
    if (stop) { stop(); stop = null; }
    view.querySelectorAll("[data-tab]").forEach(x => x.setAttribute("aria-selected", String(x.dataset.tab === t)));
    stop = ({ requests: drawRequests, review: drawReview, members: drawMembers, automod: drawAutomod, settings: drawSettings, roles: drawRoles })[t]() || null;
  };
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => show(b.dataset.tab));

  // Badge counts on the tabs.
  const counts = [];
  const setCount = (k, n) => { const el = view.querySelector(`[data-count="${k}"]`); if (el) el.textContent = n ? ` ${n}` : ""; };
  counts.push(live(["community_requests"], () => requests(cid), rs => setCount("requests", rs.length), () => {}));
  counts.push(live(["communities"], () => getCommunity(cid), fresh => {
    if (!fresh) return;
    c.memberCount = fresh.memberCount;
    const el = view.querySelector("#m-sub");
    if (el) el.textContent = el.textContent.replace(/·.*$/, `· ${membersLabel(c.memberCount)}`);
  }, () => {}));
  if (myRank >= 3) counts.push(live(["posts"], () => heldPosts(cid), ps => setCount("review", ps.length), () => {}));

  const empty = msg => `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">${msg}</p></div>`;

  function drawRequests() {
    pane.innerHTML = skeleton();
    return live(["community_requests"], () => requests(cid), reqs => {
      if (!reqs.length) { pane.innerHTML = empty(c.privacy === "public" ? "This community is public, so people join without a request." : "No one is waiting to join right now."); return; }
      pane.innerHTML = reqs.map(r => { return `
        <div class="card row" data-req="${esc(r.uid)}">
          <a class="avatar md" href="#/u/${esc(r.uid)}">${esc(initials(r.firstName, r.lastName))}</a>
          <div class="stack" style="gap:2px;flex:1 1 240px"><a href="#/u/${esc(r.uid)}" style="font-weight:600;text-decoration:none">${esc(r.firstName)} ${esc(r.lastName)}</a><span class="small faint">${esc(r.headline || "")} · asked ${esc(timeAgo(r.at))}</span></div>
          <div class="row" style="gap:8px"><button class="btn primary" data-approve>Approve</button><button class="btn" data-decline>Decline</button></div>
        </div>`; }).join("");
      pane.querySelectorAll("[data-req]").forEach(row => {
        const r = reqs.find(x => x.uid === row.dataset.req);
        row.querySelector("[data-approve]").onclick = e => act(e.target, () => approve(cid, r), `${r.firstName} is now a member.`);
        row.querySelector("[data-decline]").onclick = e => act(e.target, () => decline(cid, r.uid), "Request declined.");
      });
    }, err => { pane.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
  }

  function drawReview() {
    pane.innerHTML = skeleton();
    return live(["posts"], () => heldPosts(cid), held => {
      if (!held.length) { pane.innerHTML = empty("Nothing waiting for review. Posts caught by auto-moderation show up here."); return; }
      pane.innerHTML = held.map(x => { return `
        <div class="card stack" data-held="${esc(x.id)}">
          <div class="row" style="gap:10px"><span class="avatar sm">${esc(initials(x.authorFirst, x.authorLast))}</span>
            <span style="display:flex;flex-direction:column"><strong style="font-size:14px">${esc(x.authorFirst)} ${esc(x.authorLast)}</strong><span class="small faint">Held by auto-moderation · ${esc(timeAgo(x.createdAt))}</span></span></div>
          <p class="post-body">${esc(x.body)}</p>
          <div class="row" style="gap:8px"><button class="btn primary" data-ok>Approve post</button><button class="btn" data-rm>Remove</button></div>
        </div>`; }).join("");
      pane.querySelectorAll("[data-held]").forEach(card => {
        const id = card.dataset.held;
        card.querySelector("[data-ok]").onclick = e => act(e.target, () => approvePost(id), "Post approved and published.");
        card.querySelector("[data-rm]").onclick = e => act(e.target, () => deletePost({ id }), "Post removed.");
      });
    }, err => { pane.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
  }

  function drawMembers() {
    pane.innerHTML = skeleton();
    let members = [], bans = [], search = "";
    const draw = () => {
      const q = search.trim().toLowerCase();
      const shown = members.filter(m => !q || `${m.firstName} ${m.lastName}`.toLowerCase().includes(q))
        .sort((a, b) => rank(b.role) - rank(a.role) || `${a.firstName}`.localeCompare(`${b.firstName}`));
      const assignable = Object.keys(RANK).filter(r => RANK[r] < myRank);
      pane.innerHTML = `
        <label for="m-search" class="sr-only">Search members</label>
        <input id="m-search" class="input" type="search" placeholder="Search members" value="${esc(search)}">
        <div class="card stack" style="gap:0;padding:6px 0">${shown.map(m => {
          const below = rank(m.role) < myRank && m.uid !== uid;
          return `<div class="member-row" data-m="${esc(m.uid)}">
            <a class="avatar sm" href="#/u/${esc(m.uid)}">${esc(initials(m.firstName, m.lastName))}</a>
            <span style="display:flex;flex-direction:column;min-width:0;flex:1 1 200px"><a href="#/u/${esc(m.uid)}" style="font-weight:600;text-decoration:none">${esc(m.firstName)} ${esc(m.lastName)}${m.uid === uid ? " (you)" : ""}</a><span class="small faint">${esc(m.headline || "")}</span></span>
            ${below && myRank >= 4
              ? `<label class="sr-only" for="role-${esc(m.uid)}">Role for ${esc(m.firstName)}</label><select id="role-${esc(m.uid)}" class="input" data-role style="width:auto;min-height:36px">${assignable.map(r => `<option value="${r}"${r === m.role ? " selected" : ""}>${ROLE_LABEL[r]}</option>`).join("")}</select>`
              : `<span class="role-chip role-${esc(m.role)}">${esc(ROLE_LABEL[m.role])}</span>`}
            ${below ? `<button class="btn ghost small" data-remove style="min-height:34px">Remove</button><button class="btn ghost small" data-ban style="min-height:34px;color:var(--warn)">Ban</button>` : ""}
          </div>`; }).join("") || `<p class="muted" style="padding:16px">No members match.</p>`}</div>
        ${bans.length ? `<h2 style="font-size:16px;margin-top:8px">Banned</h2><div class="card stack" style="gap:0;padding:6px 0">${bans.map(b => `
          <div class="member-row" data-ban-id="${esc(b.uid)}"><span style="flex:1">${esc(b.name)}</span><span class="small faint">${esc(timeAgo(b.at))}</span><button class="btn ghost small" data-unban style="min-height:34px">Unban</button></div>`).join("")}</div>` : ""}`;
      const input = pane.querySelector("#m-search");
      input.oninput = () => { search = input.value; draw(); pane.querySelector("#m-search").focus(); };
      pane.querySelectorAll("[data-m]").forEach(row => {
        const m = members.find(x => x.uid === row.dataset.m);
        const sel = row.querySelector("[data-role]");
        if (sel) sel.onchange = () => act(sel, async () => { await setRole(cid, m.uid, sel.value); m.role = sel.value; draw(); }, `${m.firstName} is now ${ROLE_LABEL[sel.value]}.`);
        const rm = row.querySelector("[data-remove]");
        if (rm) rm.onclick = () => confirmThen(rm, "Confirm remove", () => act(rm, async () => { await removeMember(cid, m, state); members = members.filter(x => x !== m); draw(); }, `${m.firstName} was removed. They can rejoin.`));
        const ban = row.querySelector("[data-ban]");
        if (ban) ban.onclick = () => confirmThen(ban, "Confirm ban", () => act(ban, async () => { await removeMember(cid, m, state, true); members = members.filter(x => x !== m); await loadBans(); draw(); }, `${m.firstName} was banned and can't rejoin.`));
      });
      pane.querySelectorAll("[data-ban-id]").forEach(row => {
        row.querySelector("[data-unban]").onclick = e => act(e.target, async () => { await unban(cid, row.dataset.banId); bans = bans.filter(b => b.uid !== row.dataset.banId); draw(); }, "Ban lifted.");
      });
    };
    const loadBans = async () => { try { bans = await bansOf(cid); } catch (e) { bans = []; } };
    Promise.all([membersOf(cid, 500), loadBans()])
      .then(([list]) => { members = list; draw(); })
      .catch(err => { pane.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
    return null;
  }

  function drawAutomod() {
    const am = c.automod || { words: [], holdNewLinks: false };
    pane.innerHTML = `
      <section class="card stack" style="gap:16px">
        <div class="stack" style="gap:4px"><h2 style="font-size:18px">Auto-moderator</h2>
          <p class="small muted">When a post matches a rule below, it's held for review instead of published. It shows up in the Review queue for moderators and above. Moderators' own posts are never held, and auto-moderation never removes or bans anyone; a person always decides.</p></div>
        <div class="field"><label for="am-words">Hold posts that contain any of these words or phrases</label>
          <textarea id="am-words" class="input" maxlength="2000" placeholder="One per line or separated by commas">${esc((am.words || []).join("\n"))}</textarea>
          <span class="small faint">Not case-sensitive. Up to 50 entries.</span></div>
        <button type="button" class="choice" id="am-links" aria-pressed="${!!am.holdNewLinks}" style="flex:none">
          <strong>Hold links from new members</strong><span class="small muted">Posts with links from members who joined in the last 7 days are reviewed first. Stops most spam.</span></button>
        <div class="row"><button class="btn primary" id="am-save">Save auto-moderation</button></div>
      </section>`;
    const links = pane.querySelector("#am-links");
    links.onclick = () => links.setAttribute("aria-pressed", String(links.getAttribute("aria-pressed") !== "true"));
    pane.querySelector("#am-save").onclick = e => {
      const words = [...new Set(pane.querySelector("#am-words").value.split(/[\n,]/).map(w => w.trim()).filter(Boolean))].slice(0, 50);
      const automod = { words, holdNewLinks: links.getAttribute("aria-pressed") === "true" };
      act(e.target, async () => { await updateCommunity(cid, { automod }); c.automod = automod; }, "Auto-moderation saved.");
    };
    return null;
  }

  function drawSettings() {
    pane.innerHTML = `
      <section class="card stack" style="gap:16px">
        <h2 style="font-size:18px">Community settings</h2>
        <div class="field"><label for="s-name">Name</label><input id="s-name" class="input" maxlength="60" value="${esc(c.name)}"></div>
        <div class="field"><label for="s-about">About</label><textarea id="s-about" class="input" maxlength="500">${esc(c.about || "")}</textarea></div>
        <div class="field"><label for="s-field">Main field</label><select id="s-field" class="input">${[...FIELDS, "All of STEM"].map(f => `<option${f === c.field ? " selected" : ""}>${esc(f)}</option>`).join("")}</select></div>
        <div class="stack" style="gap:8px"><span class="label">Type</span><div class="row" style="gap:6px">${TYPES.map(([k, l]) => `<button type="button" class="chip sm" data-type="${k}" aria-pressed="${k === c.type}">${l}</button>`).join("")}</div></div>
        <div class="stack" style="gap:8px"><span class="label">Who can join?</span>${PRIVACY.map(([k, l, h]) => `<button type="button" class="choice" data-privacy="${k}" aria-pressed="${k === c.privacy}" style="flex:none"><strong>${l}</strong><span class="small muted">${h}</span></button>`).join("")}</div>
        <div class="field"><label for="s-rules">Rules</label><textarea id="s-rules" class="input" maxlength="1500">${esc(c.rules || "")}</textarea></div>
        <p class="error" id="s-error" role="alert"></p>
        <div class="row"><button class="btn primary" id="s-save">Save changes</button></div>
      </section>`;
    let type = c.type, privacy = c.privacy;
    pane.querySelectorAll("[data-type]").forEach(b => b.onclick = () => { type = b.dataset.type; pane.querySelectorAll("[data-type]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
    pane.querySelectorAll("[data-privacy]").forEach(b => b.onclick = () => { privacy = b.dataset.privacy; pane.querySelectorAll("[data-privacy]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
    pane.querySelector("#s-save").onclick = e => {
      const name = pane.querySelector("#s-name").value.trim().replace(/\s+/g, " ");
      const about = pane.querySelector("#s-about").value.trim();
      if (name.length < 3 || !about) { pane.querySelector("#s-error").textContent = "A name (3+ characters) and an About line are required."; return; }
      const changes = { name, about, field: pane.querySelector("#s-field").value, type, privacy, rules: pane.querySelector("#s-rules").value.trim() };
      act(e.target, async () => { await updateCommunity(cid, changes); Object.assign(c, changes); }, "Settings saved.");
    };
    return null;
  }

  function drawRoles() {
    pane.innerHTML = `<section class="card stack"><h2 style="font-size:18px">What each role can do</h2>
      <p class="small muted">Owner › Admin › Moderator › Helper › Member. Each role can only act on people below it. Admins can assign roles below Admin; only the owner can make someone an Admin.</p>
      ${rolesTable()}</section>`;
    return null;
  }

  async function act(btn, fn, okMsg) {
    btn.disabled = true;
    try { await fn(); if (okMsg) toast(esc(okMsg)); }
    catch (e) { toast(esc(friendlyError(e))); }
    if (btn.isConnected) btn.disabled = false;
  }
  function confirmThen(btn, label, fn) {
    if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = label; return; }
    fn();
  }

  show(tabs[0][0]);
  return () => { if (stop) stop(); counts.forEach(u => u()); };
}

function skeleton() {
  return `<div class="card stack" aria-hidden="true"><div class="skeleton" style="width:50%;height:14px"></div><div class="skeleton" style="width:30%;height:10px"></div></div>`;
}
