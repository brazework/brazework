// Your organization: register a company or school (verified by your account's email domain),
// add and edit its events, and keep a log of its past events. #/org and #/org/new.
import { live } from "../supabase.js";
import { esc, friendlyError, toast, TOPICS, ms } from "../util.js";
import {
  TYPES, FORMATS, SIZES, INDUSTRIES, DROP_AFTER_MS, myOrganizations, registerOrganization, organizationEvents, inLog,
  createEvent, updateEvent, cancelEvent, fullDate, clock, timeRange, whereLabel
} from "../events.js";

const PERSONAL = ["gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "mail.com"];
const TYPE_LABEL = { company: "Verified company", school: "Verified school", forge: "Forge" };

export async function render({ view, state, params, navigate }) {
  const me = state.user.uid;
  view.innerHTML = `<div class="page"><div class="skeleton" style="height:160px;border-radius:14px"></div></div>`;
  let orgs;
  try { orgs = await myOrganizations(me); }
  catch (e) { view.innerHTML = `<div class="page"><div class="card"><p class="error">${esc(friendlyError(e))}</p></div></div>`; return; }
  if (!orgs.length || params[0] === "new") { renderRegister({ view, state, navigate, hasOrgs: orgs.length > 0 }); return; }
  return renderManage({ view, orgs, requested: params[0] });
}

/* ---------- Register a company or school ---------- */

function renderRegister({ view, state, navigate, hasOrgs }) {
  const email = String(state.user.email || "").toLowerCase();
  const host = email.split("@")[1] || "";
  const personal = PERSONAL.includes(host);
  let type = "", size = "";
  const industries = new Set();

  view.innerHTML = `
    <div class="page" style="max-width:760px">
      ${hasOrgs ? `<a href="#/org" class="small muted" style="text-decoration:none">← Back to your organization</a>` : `<a href="#/events" class="small muted" style="text-decoration:none">← Back to events</a>`}
      <form class="card stack" id="og-form" novalidate style="gap:20px;margin-top:12px">
        <div class="stack" style="gap:6px">
          <div class="kicker">For companies &amp; schools</div>
          <h1 style="font-size:28px">Bring your organization to Forge</h1>
          <p class="muted">Host events for the STEM community. You'll be this organization's first admin.</p>
        </div>
        ${personal ? `<div class="card" style="border-color:var(--accent)">
          <p><strong>This needs a work email.</strong> <span class="muted">You're signed in as ${esc(email)}. Organizations are verified through their email domain, so personal addresses can't register one. Sign up for a Forge account with your work or school address, then come back here.</span></p>
        </div>` : `<p class="small muted">Verified through your account email, <strong>${esc(email)}</strong>: it has to match your organization's website.</p>`}
        <div class="stack" style="gap:8px"><span class="label">Who are you registering?</span>
          <div class="row">
            <button type="button" class="choice" data-type="company" aria-pressed="false"><strong>Company</strong><span class="small muted">Meet engineers and scientists, and host events.</span></button>
            <button type="button" class="choice" data-type="school" aria-pressed="false"><strong>School</strong><span class="small muted">Share career events with your students.</span></button>
          </div>
        </div>
        <div class="field"><label for="og-name">Organization name</label><input id="og-name" class="input" maxlength="120" autocomplete="organization"></div>
        <div class="field"><label for="og-site">Website</label><input id="og-site" class="input" maxlength="200" placeholder="${esc(!personal && host ? host : "example.com")}" autocomplete="url"></div>
        <div class="field"><label for="og-loc">Location</label><input id="og-loc" class="input" maxlength="160" placeholder="City, State / Country"></div>
        <div id="og-company" class="stack" style="gap:20px" hidden>
          <div class="stack" style="gap:8px"><span class="label">Company size</span>
            <div class="row" style="gap:6px">${SIZES.map(s => `<button type="button" class="chip sm" data-size="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join("")}</div></div>
          <div class="stack" style="gap:8px"><span class="label">Industries and markets <span class="faint small">(pick all that apply)</span></span>
            <div class="row" style="gap:6px">${INDUSTRIES.map(s => `<button type="button" class="chip sm" data-ind="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join("")}</div></div>
        </div>
        <p class="error" id="og-error" role="alert"></p>
        <div><button class="btn primary" id="og-submit" ${personal ? "disabled" : ""}>Register organization</button></div>
      </form>
    </div>`;

  const $ = s => view.querySelector(s);
  view.querySelectorAll("[data-type]").forEach(b => b.onclick = () => {
    type = b.dataset.type;
    view.querySelectorAll("[data-type]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $("#og-company").hidden = type !== "company";
  });
  view.querySelectorAll("[data-size]").forEach(b => b.onclick = () => {
    size = b.dataset.size;
    view.querySelectorAll("[data-size]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  });
  view.querySelectorAll("[data-ind]").forEach(b => b.onclick = () => {
    const v = b.dataset.ind;
    industries.has(v) ? industries.delete(v) : industries.add(v);
    b.setAttribute("aria-pressed", String(industries.has(v)));
  });
  $("#og-form").onsubmit = async e => {
    e.preventDefault();
    const err = $("#og-error"); err.textContent = "";
    const name = $("#og-name").value.trim(), website = $("#og-site").value.trim(), location = $("#og-loc").value.trim();
    if (!type) { err.textContent = "Choose company or school."; return; }
    if (name.length < 2) { err.textContent = "Enter your organization's name."; return; }
    if (!website) { err.textContent = "Enter your organization's website."; return; }
    if (!location) { err.textContent = "Enter your location."; return; }
    if (type === "company" && !size) { err.textContent = "Choose your company size."; return; }
    if (type === "company" && !industries.size) { err.textContent = "Pick at least one industry or market."; return; }
    const btn = $("#og-submit"); btn.disabled = true; btn.textContent = "Registering…";
    try {
      await registerOrganization({ type, name, website, location, size, industries: [...industries] });
      toast(`<strong>${esc(name)}</strong> is verified. You can add events now.`, 7000);
      navigate("org");
    } catch (ex) { err.textContent = friendlyError(ex); btn.disabled = false; btn.textContent = "Register organization"; }
  };
}

/* ---------- Manage events and the past-events log ---------- */

function renderManage({ view, orgs, requested }) {
  let org = orgs.find(o => o.id === requested) || orgs[0];
  let tab = "upcoming", events = null, stop = null;

  view.innerHTML = `<div class="page stack" style="gap:20px;max-width:1000px">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div class="stack" style="gap:6px;min-width:0">
          <div class="kicker">Your organization</div>
          <div class="row" style="gap:10px"><h1 style="font-size:28px" id="o-name"></h1><span class="tag" id="o-badge" style="font-size:11px;text-transform:uppercase;letter-spacing:.08em"></span></div>
          <span class="small faint" id="o-sub"></span>
        </div>
        <div class="row" style="gap:8px"><a class="btn ghost" href="#/org/new">Register another</a><button class="btn primary" id="o-add">+ Add event</button></div>
      </div>
      ${orgs.length > 1 ? `<div class="row" style="gap:6px" role="group" aria-label="Organization">${orgs.map(o => `<button class="chip sm" data-org="${esc(o.id)}" aria-pressed="${o.id === org.id}">${esc(o.name)}</button>`).join("")}</div>` : ""}
      <div class="tabs" role="tablist" aria-label="Organization events">
        <button class="tab" role="tab" data-tab="upcoming">Upcoming<span class="tab-count" data-count="upcoming"></span></button>
        <button class="tab" role="tab" data-tab="log">Past events<span class="tab-count" data-count="log"></span></button>
      </div>
      <div id="o-pane" class="stack" style="gap:12px"></div>
    </div>`;

  const pane = view.querySelector("#o-pane");
  view.querySelector("#o-add").onclick = () => openEventForm(org);
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => { tab = b.dataset.tab; draw(); });
  view.querySelectorAll("[data-org]").forEach(b => b.onclick = () => {
    org = orgs.find(o => o.id === b.dataset.org);
    view.querySelectorAll("[data-org]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    watch();
  });

  function draw() {
    view.querySelector("#o-name").textContent = org.name;
    view.querySelector("#o-badge").textContent = TYPE_LABEL[org.type] || "";
    view.querySelector("#o-sub").textContent = [org.domain, org.location].filter(Boolean).join(" · ");
    view.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    if (!events) { pane.innerHTML = `<div class="card"><div class="skeleton" style="height:48px"></div></div>`; return; }
    const log = events.filter(inLog), upcoming = events.filter(e => !inLog(e)).sort((a, b) => ms(a.startsAt) - ms(b.startsAt));
    view.querySelector(`[data-count="upcoming"]`).textContent = upcoming.length ? ` ${upcoming.length}` : "";
    view.querySelector(`[data-count="log"]`).textContent = log.length ? ` ${log.length}` : "";
    if (tab === "upcoming") drawUpcoming(upcoming); else drawLog(log);
  }

  function drawUpcoming(list) {
    pane.innerHTML = `<p class="small muted">These show in Forge's Events tab, and to members with matching interests.</p>` + (list.length ? list.map(e => `
      <article class="card row" data-id="${esc(e.id)}" style="gap:16px">
        <div class="stack" style="flex:1 1 300px;min-width:0;gap:4px">
          <div class="row" style="gap:8px"><span class="ev-type">${esc(e.type)}</span><span class="small faint">${esc(e.topic)}</span></div>
          <strong style="font-size:16px">${esc(e.title)}</strong>
          <span class="small faint">${esc(fullDate(e.startsAt))} · ${esc(timeRange(e))} · ${esc(whereLabel(e))}</span>
          <span class="small muted">${Number(e.rsvpCount || 0).toLocaleString("en-US")} attending</span>
        </div>
        <div class="row" style="gap:8px"><button class="btn" data-edit>Edit</button><button class="btn ghost" data-cancel style="color:var(--warn)">Cancel event</button></div>
      </article>`).join("") : `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">No upcoming events. Add one and it shows up in Forge's Events tab right away.</p></div>`);
    pane.querySelectorAll("[data-id]").forEach(card => {
      const ev = events.find(x => x.id === card.dataset.id);
      card.querySelector("[data-edit]").onclick = () => openEventForm(org, ev);
      card.querySelector("[data-cancel]").onclick = async e => {
        const b = e.target;
        if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Click again to cancel"; return; }
        b.disabled = true;
        try { await cancelEvent(ev.id); toast("Event cancelled. It's now in your past events."); }
        catch (err) { toast(esc(friendlyError(err))); b.disabled = false; }
      };
    });
  }

  function drawLog(list) {
    const row = e => {
      const leavesAt = ms(e.endsAt) + DROP_AFTER_MS;
      const status = e.status === "cancelled" ? `<span class="small" style="color:var(--warn)">Cancelled</span>`
        : leavesAt > Date.now() ? `<span class="small faint">Leaves the Events tab ${esc(fullDate(leavesAt))}, ${esc(clock(leavesAt))}</span>` : "";
      return `<div class="ev-log-row">
        <span class="small faint" style="white-space:nowrap">${esc(fullDate(e.startsAt))}</span>
        <span class="stack" style="gap:2px;min-width:0"><strong style="font-size:15px">${esc(e.title)}</strong><span class="small faint">${esc(e.type)} · ${esc(whereLabel(e))}</span>${status}</span>
        <span class="small" style="white-space:nowrap"><strong>${Number(e.rsvpCount || 0).toLocaleString("en-US")}</strong> <span class="muted">attending</span></span>
      </div>`;
    };
    pane.innerHTML = `<p class="small muted">A permanent record of your organization's events. Only your organization's admins can see this. Events leave Forge's Events tab 24 hours after they end.</p>` +
      (list.length ? `<div class="card stack" style="gap:0;padding:4px 0">${list.map(row).join("")}</div>`
        : `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">Nothing here yet. Events you've hosted will be logged here once they end.</p></div>`);
  }

  function watch() {
    if (stop) stop();
    events = null; draw();
    const id = org.id;
    stop = live(["events"], () => organizationEvents(id), list => { if (id === org.id) { events = list; draw(); } },
      err => { pane.innerHTML = `<div class="card"><p class="error">${esc(friendlyError(err))}</p></div>`; });
  }
  watch();
  return () => { if (stop) stop(); };
}

/* ---------- Add or edit an event ---------- */

// The browser's date picker works in local time; the database stores an exact moment.
const toLocalInput = ts => { const d = new Date(ts); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

function openEventForm(org, existing) {
  if (document.getElementById("ev-form-wrap")) return;
  const e = existing || {};
  let type = e.type || TYPES[0], format = e.format || FORMATS[0];
  const host = document.getElementById("overlay");
  const wrap = document.createElement("div");
  wrap.id = "ev-form-wrap";
  const topicOptions = TOPICS.map(g => `<optgroup label="${esc(g.name)}">${g.topics.map(t => `<option value="${esc(t)}"${t === e.topic ? " selected" : ""}>${esc(t)}</option>`).join("")}</optgroup>`).join("");
  wrap.innerHTML = `
    <div class="scrim" data-close></div>
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="ef-title">
      <form class="stack" style="gap:18px" id="ef-form" novalidate>
        <div class="row" style="justify-content:space-between;align-items:flex-start">
          <div class="stack" style="gap:4px"><h2 id="ef-title" style="font-size:22px">${existing ? "Edit event" : "Add an event"}</h2><p class="small muted">Hosted by ${esc(org.name)}. It shows in Forge's Events tab until 24 hours after it ends.</p></div>
          <button type="button" class="btn ghost" data-close aria-label="Close" style="min-height:36px;padding:0 10px;font-size:20px">×</button>
        </div>
        <div class="field"><label for="ef-name">Event name</label><input id="ef-name" class="input" maxlength="120" value="${esc(e.title || "")}"></div>
        <div class="stack" style="gap:8px"><span class="label">Type</span><div class="row" style="gap:6px">${TYPES.map(t => `<button type="button" class="chip sm" data-etype="${esc(t)}" aria-pressed="${t === type}">${esc(t)}</button>`).join("")}</div></div>
        <div class="field"><label for="ef-topic">Topic <span class="faint small">(members with this interest see it under Upcoming for you)</span></label>
          <select id="ef-topic" class="input"><option value="">Choose a topic</option>${topicOptions}</select></div>
        <div class="row" style="align-items:flex-start">
          <div class="field" style="flex:1 1 220px"><label for="ef-start">Starts</label><input id="ef-start" class="input" type="datetime-local" value="${e.startsAt ? toLocalInput(e.startsAt) : ""}"></div>
          <div class="field" style="flex:1 1 220px"><label for="ef-end">Ends</label><input id="ef-end" class="input" type="datetime-local" value="${e.endsAt ? toLocalInput(e.endsAt) : ""}"></div>
        </div>
        <div class="stack" style="gap:8px"><span class="label">Format</span><div class="row" style="gap:6px">${FORMATS.map(f => `<button type="button" class="chip sm" data-eformat="${esc(f)}" aria-pressed="${f === format}">${esc(f)}</button>`).join("")}</div></div>
        <div class="field" id="ef-loc-wrap"><label for="ef-loc">Location</label><input id="ef-loc" class="input" maxlength="160" placeholder="Venue, City" value="${esc(e.location || "")}"></div>
        <div class="field"><label for="ef-link">Event page or sign-up link <span class="faint small">(optional)</span></label><input id="ef-link" class="input" maxlength="300" placeholder="https://" value="${esc(e.link || "")}"></div>
        <div class="field"><label for="ef-desc">Details <span class="faint small">(optional)</span></label><textarea id="ef-desc" class="input" maxlength="2000" placeholder="What's happening, who it's for and what to bring">${esc(e.description || "")}</textarea></div>
        <p class="error" id="ef-error" role="alert"></p>
        <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" id="ef-submit">${existing ? "Save changes" : "Publish event"}</button></div>
      </form>
    </div>`;
  host.appendChild(wrap);
  const $ = s => wrap.querySelector(s);
  $("#ef-name").focus();

  const showLoc = () => { $("#ef-loc-wrap").hidden = format === "Online"; };
  showLoc();
  wrap.querySelectorAll("[data-etype]").forEach(b => b.onclick = () => { type = b.dataset.etype; wrap.querySelectorAll("[data-etype]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); });
  wrap.querySelectorAll("[data-eformat]").forEach(b => b.onclick = () => { format = b.dataset.eformat; wrap.querySelectorAll("[data-eformat]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); showLoc(); });

  const close = () => { wrap.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = ev => { if (ev.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.querySelectorAll("[data-close]").forEach(el => el.onclick = close);

  $("#ef-form").onsubmit = async ev => {
    ev.preventDefault();
    const err = $("#ef-error"); err.textContent = "";
    const title = $("#ef-name").value.trim(), topic = $("#ef-topic").value, location = format === "Online" ? "" : $("#ef-loc").value.trim();
    const start = new Date($("#ef-start").value), end = new Date($("#ef-end").value);
    let link = $("#ef-link").value.trim();
    if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
    if (title.length < 3) { err.textContent = "Give the event a name (at least 3 characters)."; return; }
    if (!topic) { err.textContent = "Choose a topic, so the right members see it."; return; }
    if (isNaN(start) || isNaN(end)) { err.textContent = "Choose when the event starts and ends."; return; }
    if (end <= start) { err.textContent = "The end has to be after the start."; return; }
    if (end <= new Date()) { err.textContent = "The event has to end in the future."; return; }
    if (format !== "Online" && !location) { err.textContent = "Add a location."; return; }
    const btn = $("#ef-submit"); btn.disabled = true;
    const fields = { title, type, format, topic, location, link, description: $("#ef-desc").value.trim(), startsAt: start.toISOString(), endsAt: end.toISOString() };
    try {
      if (existing) await updateEvent(existing.id, fields); else await createEvent(org.id, fields);
      close();
      toast(existing ? "Event updated." : `<strong>${esc(title)}</strong> is live in the Events tab.`);
    } catch (ex) { err.textContent = friendlyError(ex); btn.disabled = false; }
  };
}
