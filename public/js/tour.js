// Guided tours: the first-time tour, "What's new" walkthroughs for new features, and replays.
// A tour highlights one thing at a time ([data-tour="name"] on the page) with a short note.
// It can be closed at any moment (×, Esc), steps can go back without closing it, and it
// closes itself after the last step. Finishing or closing counts as seen, so it doesn't come back.
import { sb, run } from "./supabase.js";
import { esc, ms } from "./util.js";
import { RELEASED } from "./updates.js";

const WELCOME = "welcome";
let active = null;          // the tour on screen, if any
const seenHere = new Set(); // marked this visit, so a slow save never shows a tour twice

/* ---------- Remembering what you've seen ---------- */

async function seenKeys() {
  const rows = await run(sb.from("seen_tours").select("key").limit(500));
  const s = new Set(rows.map(r => r.key));
  seenHere.forEach(k => s.add(k));
  return s;
}

function markSeen(keys) {
  keys.forEach(k => seenHere.add(k));
  sb.from("seen_tours").upsert(keys.map(key => ({ key })), { onConflict: "user_id,key", ignoreDuplicates: true })
    .then(() => {}, () => {});
}

/* ---------- What to show ---------- */

function welcomeSteps(p) {
  return [
    { route: "feed", title: `Welcome to Forge, ${p.firstName || "there"}`, body: "Here's a one-minute look at the essentials. Close this at any time, or use Back to see a step again." },
    { route: "feed", target: "feed-tabs", title: "Your feed", body: "For you only shows posts that match your interests, with a note saying why. Latest has every post, Following has the people you follow, and Communities has your groups." },
    { route: "feed", target: "composer", title: "Share your work", body: "Post an update, question, result or project. Add up to 3 topics so it reaches the people interested in them." },
    { route: "feed", target: "interests", title: "Your focus areas", body: "Your interests decide what's in For you and which people and events we suggest. Click one to filter the feed, or change them in Settings." },
    { route: "feed", target: "menu", title: "Everything else", body: "The menu has every page: Network, Communities, Messages, Events, Saved and Settings." },
    { route: "feed", target: "bell", title: "Notifications", body: "Likes, comments, new followers and connection requests show up here." },
    { route: "profile/projects", target: "projects-tab", title: "Your profile and projects", body: "Show what you've built. Projects can be public or private, and you can share them to the feed." },
    { route: "profile", target: "analytics", title: "Your analytics", body: "See how people find your profile and how your posts are doing. Only you can see it." },
    { route: "feed", target: "updates", title: "Forge updates", body: "Click any update to read what changed. When a new feature ships, we'll show you around it." },
    { route: "feed", title: "You're all set", body: "You can replay this tour any time from Settings, under Help." }
  ];
}

const joinedDay = p => { const t = ms(p.createdAt); return t ? new Date(new Date(t).toDateString()).getTime() : 0; };

// Called when the feed opens: the first-time tour, a replay asked for in Settings,
// or a walkthrough of features that shipped since you last signed in.
export async function startToursFor(state) {
  if (active) return;
  let replay = false;
  try { replay = sessionStorage.getItem("forge.tour") === "replay"; sessionStorage.removeItem("forge.tour"); } catch (e) {}
  if (replay) return startWelcome(state);
  let seen;
  try { seen = await seenKeys(); } catch (e) { return; } // never nag if we can't tell
  if (active || !location.hash.startsWith("#/feed")) return;
  if (!seen.has(WELCOME)) return startWelcome(state);
  const since = joinedDay(state.profile);
  const fresh = RELEASED.filter(u => !seen.has(u.id) && (!u.date || Date.parse(u.date + "T00:00:00") >= since));
  if (fresh.length) startWhatsNew(fresh);
}

export function startWelcome(state) {
  // Finishing (or closing) the first tour also covers every update that's out now.
  runTour(welcomeSteps(state.profile), { label: "Tour", onEnd: () => markSeen([WELCOME, ...RELEASED.map(u => u.id)]) });
}

function startWhatsNew(list) {
  const steps = [
    { route: "feed", title: "What's new on Forge", body: list.length === 1 ? "One update since you were last here:" : `${list.length} updates since you were last here:`, list: list.map(u => [u.title, u.summary]) },
    ...list.flatMap(u => u.tour || []),
    { route: "feed", target: "updates", title: "That's what's new", body: "Read any update again by clicking it in Forge updates." }
  ];
  runTour(steps, { label: "What's new", onEnd: () => markSeen(list.map(u => u.id)) });
}

// "Show me" from an update's note.
export function startUpdateTour(u) {
  if (!u.tour || !u.tour.length) return;
  runTour(u.tour, { label: "What's new", onEnd: () => markSeen([u.id]) });
}

/* ---------- The tour itself ---------- */

const onRoute = route => location.hash.replace(/^#\/?/, "").startsWith(route);
const visible = el => { if (!el || !el.isConnected) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };

// Waits for a highlighted element to show up (pages load their content after they open).
function waitFor(sel, timeout = 4000) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const look = () => {
      const el = document.querySelector(sel);
      if (visible(el) && !document.getElementById("view").classList.contains("leaving")) return resolve(el);
      if (Date.now() - t0 > timeout) return resolve(null);
      setTimeout(look, 100);
    };
    look();
  });
}

export function runTour(steps, { label = "Tour", onEnd } = {}) {
  if (active) active.close(false);
  const host = document.getElementById("overlay");
  const root = document.createElement("div");
  root.className = "tour";
  root.innerHTML = `
    <div class="tour-block" aria-hidden="true"></div>
    <div class="tour-hole" aria-hidden="true" hidden></div>
    <div class="tour-pop" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body" tabindex="-1"></div>
    <div class="sr-only" aria-live="polite" id="tour-live"></div>`;
  host.appendChild(root);
  const hole = root.querySelector(".tour-hole"), pop = root.querySelector(".tour-pop"), block = root.querySelector(".tour-block");
  const lastFocus = document.activeElement;
  let i = 0, seq = 0, target = null, sel = "", ended = false;

  const place = () => {
    if (ended) return;
    if (sel && !visible(target)) target = document.querySelector(sel);
    const sheet = innerWidth < 600;
    pop.classList.toggle("sheet", sheet);
    if (!visible(target)) {
      hole.hidden = true; block.classList.add("dim");
      pop.style.left = pop.style.top = "";
      pop.classList.add("center");
      return;
    }
    block.classList.remove("dim"); pop.classList.remove("center");
    const r = target.getBoundingClientRect(), pad = 6;
    hole.hidden = false;
    Object.assign(hole.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + pad * 2 + "px", height: r.height + pad * 2 + "px" });
    if (sheet) { pop.style.left = pop.style.top = ""; return; }
    // Below, above, right or left of the highlight, whichever fits first; otherwise the bottom corner.
    const pw = pop.offsetWidth, ph = pop.offsetHeight, gap = 14, m = 12;
    const clampX = x => Math.min(Math.max(m, x), innerWidth - pw - m), clampY = y => Math.min(Math.max(m, y), innerHeight - ph - m);
    const cx = clampX(r.left + r.width / 2 - pw / 2), cy = clampY(r.top);
    const spots = [
      [r.bottom + gap + ph <= innerHeight - m, cx, r.bottom + gap],
      [r.top - gap - ph >= m, cx, r.top - gap - ph],
      [r.right + gap + pw <= innerWidth - m, r.right + gap, cy],
      [r.left - gap - pw >= m, r.left - gap - pw, cy]
    ];
    const [, left, top] = spots.find(s => s[0]) || [true, innerWidth - pw - m, innerHeight - ph - m];
    pop.style.left = left + "px"; pop.style.top = top + "px";
  };

  // Brings the highlighted thing into view, leaving room for the note.
  const bringIntoView = () => {
    if (!visible(target)) return;
    const r = target.getBoundingClientRect(), sheet = innerWidth < 600;
    const low = sheet ? innerHeight * 0.5 : innerHeight * 0.8;
    if (r.top < 80 || r.bottom > low) window.scrollBy(0, r.top - (sheet ? 90 : Math.min(innerHeight * 0.25, Math.max(80, innerHeight - r.height - 260))));
  };

  const draw = () => {
    const s = steps[i], last = i === steps.length - 1;
    pop.innerHTML = `
      <div class="tour-head"><span class="tour-kicker">${esc(label)} · ${i + 1} of ${steps.length}</span>
        <button class="tour-x" data-t="close" aria-label="Close the ${esc(label.toLowerCase())}">×</button></div>
      <h2 id="tour-title" class="tour-title">${esc(s.title)}</h2>
      <p id="tour-body" class="tour-body">${esc(s.body)}</p>
      ${s.list ? `<ul class="tour-list">${s.list.map(([t, d]) => `<li><strong>${esc(t)}</strong><span class="small muted">${esc(d)}</span></li>`).join("")}</ul>` : ""}
      <div class="tour-foot">
        <div class="tour-dots" aria-hidden="true">${steps.map((_, k) => `<span class="${k === i ? "on" : ""}"></span>`).join("")}</div>
        <div class="row" style="gap:8px;margin-left:auto">
          <button class="btn" data-t="back" ${i === 0 ? "disabled" : ""}>Back</button>
          <button class="btn primary" data-t="next">${last ? "Finish" : "Next"}</button>
        </div>
      </div>`;
    root.querySelector("#tour-live").textContent = `Step ${i + 1} of ${steps.length}: ${s.title}`;
  };

  const show = async k => {
    const mine = ++seq;
    i = Math.max(0, Math.min(steps.length - 1, k));
    const s = steps[i];
    sel = ""; target = null;
    draw();
    pop.classList.add("busy");
    place();
    if (s.route && !onRoute(s.route)) {
      location.hash = "#/" + s.route;
      await new Promise(r => setTimeout(r, 250)); // let the page start changing
    }
    sel = s.target ? `[data-tour="${s.target}"]` : "";
    target = sel ? await waitFor(sel) : null;
    if (mine !== seq || ended) return;
    bringIntoView();
    pop.classList.remove("busy");
    place();
    pop.querySelector('[data-t="next"]').focus({ preventScroll: true });
  };

  const close = (notify = true) => {
    if (ended) return;
    ended = true; seq++;
    clearInterval(timer);
    document.removeEventListener("keydown", onKey, true);
    removeEventListener("resize", place); removeEventListener("scroll", place, true);
    root.remove();
    if (active === api) active = null;
    if (lastFocus && lastFocus.isConnected) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
    if (notify && onEnd) onEnd();
  };

  const onKey = e => {
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === "ArrowRight" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) { e.preventDefault(); i === steps.length - 1 ? close() : show(i + 1); }
    else if (e.key === "ArrowLeft" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || "")) { e.preventDefault(); if (i > 0) show(i - 1); }
    else if (e.key === "Tab") { // keep focus inside the note
      const f = [...pop.querySelectorAll("button:not([disabled])")];
      if (!f.length) return;
      const at = f.indexOf(document.activeElement);
      if (e.shiftKey && at <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (at === -1 || at === f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
  };

  pop.addEventListener("click", e => {
    const b = e.target.closest("[data-t]"); if (!b) return;
    if (b.dataset.t === "close") close();
    else if (b.dataset.t === "back") show(i - 1);
    else if (i === steps.length - 1) close();
    else show(i + 1);
  });
  document.addEventListener("keydown", onKey, true);
  addEventListener("resize", place); addEventListener("scroll", place, true);
  const timer = setInterval(place, 300); // pages keep loading content, so keep the highlight in place

  const api = { close };
  active = api;
  show(0);
  return api;
}
