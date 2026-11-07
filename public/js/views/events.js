// Events: upcoming events matched to your interests, every event, and your saved events.
// Events leave this page 24 hours after they end; hosts keep them in the log on #/org.
import { live } from "../supabase.js";
import { esc, friendlyError, toast, ms } from "../util.js";
import {
  TYPES, tabEvents, myMarks, setRsvp, setSaved, myOrganizations, isOver, dateParts, monthLabel, timeRange, whereLabel, downloadCalendarFile
} from "../events.js";

const DAY = 86400000;
const SAVE_ICON = `<svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M5 3 H15 V17 L10 13.5 L5 17 Z"></path></svg>`;

export function render({ view, state, params }) {
  const me = state.user.uid, interests = state.profile.interests || [];
  let tab = ["all", "saved"].includes(params[0]) ? params[0] : "foryou";
  let events = null, marks = { saved: new Set(), going: new Set(), friends: new Map() };
  const active = new Set(interests);
  let type = "All", format = "All", when = "All";

  view.innerHTML = `
    <div class="page stack" style="gap:22px;max-width:1240px">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div class="stack" style="gap:6px">
          <h1 style="font-size:32px">Events</h1>
          <p class="muted">Career fairs, networking, workshops and talks picked from your interests.</p>
        </div>
        <a class="btn" href="#/org" id="ev-host">Host an event</a>
      </div>
      <div class="tabs" role="tablist" aria-label="Events">
        <button class="tab" role="tab" data-tab="foryou">Upcoming for you</button>
        <button class="tab" role="tab" data-tab="all">All events</button>
        <button class="tab" role="tab" data-tab="saved">Saved events <span class="tab-count" id="ev-saved-n"></span></button>
      </div>
      <div class="cols" id="ev-body"></div>
    </div>`;

  const body = view.querySelector("#ev-body");
  myOrganizations(me).then(list => { const b = view.querySelector("#ev-host"); if (b && list.length) b.textContent = "Manage your events"; }).catch(() => {});

  const setTab = t => { tab = t; draw(); };
  view.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => setTab(b.dataset.tab));

  function matches(e) {
    const du = (ms(e.startsAt) - Date.now()) / DAY;
    if (tab === "foryou" && !active.has(e.topic)) return false;
    if (type !== "All" && e.type !== type) return false;
    if (format !== "All" && e.format !== format && e.format !== "Hybrid") return false;
    if (when === "This week" && du > 7) return false;
    if (when === "This month" && new Date(e.startsAt).getMonth() !== new Date().getMonth()) return false;
    if (when === "Next 60 days" && du > 60) return false;
    return true;
  }

  const chips = (name, options, current) => options.map(o => `<button class="chip sm" data-${name}="${esc(o)}" aria-pressed="${o === current}">${esc(o)}</button>`).join("");

  function filtersHTML() {
    return `<aside class="col-side" aria-label="Filters" style="gap:20px">
      ${tab === "foryou" ? `<div class="stack" style="gap:10px">
        <div class="row" style="justify-content:space-between"><h2 style="font-size:14px">Your interests</h2><a href="#/settings" class="small muted">Edit</a></div>
        <div class="row" style="gap:6px">${interests.map(t => `<button class="chip sm" data-topic="${esc(t)}" aria-pressed="${active.has(t)}">${esc(t)}</button>`).join("")}</div>
      </div>` : ""}
      <div class="stack" style="gap:10px"><h2 style="font-size:14px">Type</h2><div class="row" style="gap:6px">${chips("type", ["All", ...TYPES], type)}</div></div>
      <div class="stack" style="gap:10px"><h2 style="font-size:14px">Format</h2><div class="row" style="gap:6px">${chips("format", ["All", "Online", "In person"], format)}</div></div>
      <div class="stack" style="gap:10px"><h2 style="font-size:14px">When</h2><div class="row" style="gap:6px">${chips("when", ["All", "This week", "This month", "Next 60 days"], when)}</div></div>
    </aside>`;
  }

  function cardHTML(e, { savedTab = false } = {}) {
    const d = dateParts(e.startsAt), over = isOver(e), going = marks.going.has(e.id), saved = marks.saved.has(e.id);
    const friends = marks.friends.get(e.id) || 0;
    const attending = Number(e.rsvpCount || 0);
    const social = [friends ? `${friends} ${friends === 1 ? "connection" : "connections"} going` : "", attending ? `${attending.toLocaleString("en-US")} attending` : ""].filter(Boolean).join(" · ");
    const matched = active.has(e.topic);
    return `<article class="card ev-card" data-event="${esc(e.id)}">
      <div class="ev-date"><span class="ev-dow">${esc(d.dow)}</span><span class="ev-day">${esc(d.day)}</span><span class="ev-mon">${esc(d.mon)}</span></div>
      <div class="stack" style="flex:1 1 300px;min-width:0;gap:6px">
        <div class="row" style="gap:8px">
          <span class="ev-type">${esc(e.type)}</span>
          ${over ? `<span class="small faint">Ended</span>` : matched ? `<span class="small" style="color:var(--accent)">Matches ${esc(e.topic)}</span>` : `<span class="small faint">${esc(e.topic)}</span>`}
        </div>
        <h3 style="font-size:17px;line-height:1.35">${esc(e.title)}</h3>
        <span style="font-size:14px;color:var(--text-2)">${esc(e.host)}</span>
        <span class="small faint">${esc(timeRange(e))} · ${esc(whereLabel(e))}</span>
        ${e.description ? `<p class="small muted ev-desc">${esc(e.description)}</p>` : ""}
        ${e.link ? `<a class="small" href="${esc(e.link)}" target="_blank" rel="noopener noreferrer">Event page ↗</a>` : ""}
        ${social ? `<span class="small faint">${esc(social)}</span>` : ""}
        ${savedTab ? `<span class="small" style="color:${going ? "var(--ok)" : "var(--muted)"}">${going ? "You're going" : "Saved · not RSVP'd yet"}</span>` : ""}
      </div>
      <div class="row" style="gap:8px;flex-wrap:${savedTab ? "wrap" : "nowrap"}">
        ${over ? "" : `<button class="btn ${going ? "ev-going" : "primary"}" data-act="rsvp" aria-pressed="${going}" style="min-height:40px">${going ? "✓ Going" : "RSVP"}</button>`}
        ${savedTab
          ? `${over ? "" : `<button class="btn" data-act="cal" style="min-height:40px">Add to calendar</button>`}<button class="btn ghost" data-act="save" style="min-height:40px">Remove</button>`
          : `<button class="btn ev-save${saved ? " on" : ""}" data-act="save" aria-pressed="${saved}" aria-label="${saved ? "Remove from saved events" : "Save event"}" title="${saved ? "Remove from saved events" : "Save event"}">${SAVE_ICON}</button>`}
      </div>
    </article>`;
  }

  function draw() {
    view.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    const n = (events || []).filter(e => marks.saved.has(e.id)).length;
    view.querySelector("#ev-saved-n").textContent = n ? String(n) : "";
    if (!events) { body.innerHTML = `<section class="col-main">${skeleton()}</section>`; return; }

    if (tab === "saved") {
      const saved = events.filter(e => marks.saved.has(e.id));
      body.innerHTML = `<section class="col-main" aria-label="Saved events" style="max-width:900px">
        <p class="small muted">Saved events stay here, separate from your other saved posts. They disappear automatically after the event is over.</p>
        ${saved.length ? saved.map(e => cardHTML(e, { savedTab: true })).join("") : `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">No saved events yet. Tap the bookmark on any event to keep it here.</p></div>`}
      </section>`;
      return;
    }

    const list = events.filter(matches);
    const months = new Map();
    list.forEach(e => { const k = monthLabel(e.startsAt); if (!months.has(k)) months.set(k, []); months.get(k).push(e); });
    const note = tab === "foryou"
      ? `${list.length} ${list.length === 1 ? "event" : "events"} matching ${active.size} of your ${interests.length} interests`
      : `${list.length} ${list.length === 1 ? "event" : "events"}`;
    const none = tab === "foryou" && !interests.length
      ? `Add interests in <a href="#/settings">Settings</a> to see events picked for you, or browse all events.`
      : !events.length ? "No events yet. Check back soon."
      : tab === "foryou" ? `No events match these filters yet. Try turning on more interests, or see <button class="link-btn" data-go-all>all events</button>.`
      : "No events match these filters yet.";
    body.innerHTML = `${filtersHTML()}
      <section class="col-main" aria-label="Events" style="gap:20px">
        <div class="small muted">${esc(note)}</div>
        ${[...months].map(([label, evs]) => `<div class="stack" style="gap:12px"><h2 class="ev-month">${esc(label)}</h2>${evs.map(e => cardHTML(e)).join("")}</div>`).join("")}
        ${list.length ? "" : `<div class="card" style="text-align:center;border-style:dashed"><p class="muted">${none}</p></div>`}
      </section>`;
    body.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => { const t = b.dataset.topic; active.has(t) ? active.delete(t) : active.add(t); draw(); });
    body.querySelectorAll("[data-type]").forEach(b => b.onclick = () => { type = b.dataset.type; draw(); });
    body.querySelectorAll("[data-format]").forEach(b => b.onclick = () => { format = b.dataset.format; draw(); });
    body.querySelectorAll("[data-when]").forEach(b => b.onclick = () => { when = b.dataset.when; draw(); });
    const all = body.querySelector("[data-go-all]"); if (all) all.onclick = () => setTab("all");
  }

  // RSVP and save update right away, and undo themselves if the database refuses.
  const onClick = async e => {
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = btn.closest("[data-event]").dataset.event;
    const ev = events.find(x => x.id === id); if (!ev) return;
    const act = btn.dataset.act;
    if (act === "cal") { downloadCalendarFile(ev); return; }
    const set = act === "rsvp" ? marks.going : marks.saved;
    const was = set.has(id);
    was ? set.delete(id) : set.add(id);
    if (act === "rsvp") ev.rsvpCount = Math.max(0, Number(ev.rsvpCount || 0) + (was ? -1 : 1));
    draw();
    try { await (act === "rsvp" ? setRsvp : setSaved)(id, me, !was); }
    catch (err) {
      was ? set.add(id) : set.delete(id);
      if (act === "rsvp") ev.rsvpCount = Math.max(0, Number(ev.rsvpCount || 0) + (was ? 1 : -1));
      draw(); toast(esc(friendlyError(err)));
    }
  };
  body.addEventListener("click", onClick);

  draw();
  const stop = live(["events"], async () => {
    const list = await tabEvents();
    return { list, m: await myMarks(me, list.map(x => x.id)) };
  }, ({ list, m }) => { events = list; marks = m; draw(); },
  err => { body.innerHTML = `<section class="col-main"><div class="card"><p class="error">${esc(friendlyError(err))}</p></div></section>`; });

  return () => { stop(); body.removeEventListener("click", onClick); };
}

function skeleton() {
  return Array.from({ length: 3 }, () => `<div class="card row" aria-hidden="true"><div class="skeleton" style="width:60px;height:72px;border-radius:10px"></div><div class="stack" style="gap:8px;flex:1"><div class="skeleton" style="width:50%;height:14px"></div><div class="skeleton" style="width:70%;height:10px"></div></div></div>`).join("");
}
