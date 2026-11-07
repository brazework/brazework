// The shared frame around every page: top bar and the side menu.
import { sb, live } from "./supabase.js";
import { esc, initials, LOGO, icon } from "./util.js";
import { myCommunities, badge } from "./communities.js";
import { pendingCount } from "./network.js";
import { unreadCount } from "./messages.js";

const MENU = [
  { title: "Explore", items: [
    ["feed", "Home feed", "home"], ["profile", "Your profile", "user"], ["communities", "Communities", "groups"],
    ["network", "Network", "network"], ["messages", "Messages", "chat"], ["events", "Events", "calendar"],
    ["saved", "Saved", "saved"]
  ] },
  { title: "Your tools", items: [["org", "Your organization", "groups"], ["analytics", "Analytics", "chart", true], ["marketplace", "Marketplace", "market", true]] },
  { title: "Account", items: [["settings", "Settings", "gear"]] }
];

let menuOpen = false;

// Unread conversations, shown next to Messages. One live subscription for the whole visit,
// since the top bar is redrawn on every page.
let stopUnread = null, unread = 0;
function drawUnread() {
  const b = document.getElementById("nav-msgs"); if (!b) return;
  b.hidden = !unread;
  b.textContent = unread > 99 ? "99+" : String(unread);
  b.setAttribute("aria-label", `${unread} unread ${unread === 1 ? "conversation" : "conversations"}`);
}

export function renderShell({ state, current, navigate }) {
  const shell = document.getElementById("shell");
  const signedInApp = state.user && state.user.emailVerified && state.profile && state.profile.onboarded;

  if (!signedInApp) {
    if (stopUnread) { stopUnread(); stopUnread = null; unread = 0; }
    const authed = !!state.user;
    shell.innerHTML = `
      <header class="topbar"><div class="topbar-inner">
        <a class="brand" href="#/" ${current === "" ? 'data-scroll="lp-top"' : ""}>${LOGO}<span class="brand-name">Forge</span></a>
        <nav class="topnav" aria-label="Main">
          ${!authed && current === "" ? [["lp-features", "Features"], ["lp-disciplines", "Disciplines"], ["lp-why", "Why Forge"], ["lp-orgs", "For organizations"]].map(([id, l]) => `<button class="navlink" data-scroll="${id}">${l}</button>`).join("") : ""}
          ${authed
            ? `<button class="btn ghost" id="shell-signout">Log out</button>`
            : `<a href="#/login" ${current === "login" ? 'aria-current="page"' : ""}>Log in</a><a class="btn primary" href="#/signup" style="min-height:40px">Sign up</a>`}
        </nav>
      </div></header>`;
    const so = document.getElementById("shell-signout");
    if (so) so.onclick = () => sb.auth.signOut().then(() => navigate("login"));
    return;
  }

  const p = state.profile;
  const ini = initials(p.firstName, p.lastName);
  const link = (key, label) => `<a href="#/${key}" ${current === key ? 'aria-current="page"' : ""}>${label}</a>`;
  shell.innerHTML = `
    <header class="topbar"><div class="topbar-inner">
      <button class="icon-btn" id="menu-open" aria-label="Open menu" aria-expanded="false">${icon("menu")}</button>
      <a class="brand" href="#/feed">${LOGO}<span class="brand-name">Forge</span></a>
      <label for="global-search" class="sr-only">Search Forge</label>
      <input id="global-search" class="search" type="search" placeholder="Search people, projects, topics (coming soon)" disabled>
      <nav class="topnav" aria-label="Main">
        ${link("feed", "Feed")}
        ${link("communities", "Communities")}
        <a href="#/network" ${current === "network" ? 'aria-current="page"' : ""}>Network<span class="nav-badge" id="nav-invites" hidden></span></a>
        <a href="#/messages" ${current === "messages" ? 'aria-current="page"' : ""}>Messages<span class="nav-badge" id="nav-msgs" hidden></span></a>
        ${link("events", "Events")}
        ${link("settings", "Settings")}
        <a href="#/profile" class="avatar sm" aria-label="Your profile">${esc(ini)}</a>
      </nav>
    </div></header>`;

  document.getElementById("menu-open").onclick = () => openMenu({ state, current, navigate });

  drawUnread();
  if (!stopUnread) stopUnread = live(["conversations", "conversation_reads"], unreadCount, n => { unread = n; drawUnread(); }, () => {});

  // Pending connection requests, shown as a small number next to Network.
  pendingCount(state.user.uid).then(n => {
    const b = document.getElementById("nav-invites");
    if (b && n) { b.hidden = false; b.textContent = n > 99 ? "99+" : String(n); b.setAttribute("aria-label", `${n} pending invitations`); }
  });
}

function openMenu({ state, current, navigate }) {
  if (menuOpen) return;
  menuOpen = true;
  const p = state.profile;
  const host = document.getElementById("overlay");
  const wrap = document.createElement("div");
  wrap.id = "menu-wrap";
  wrap.innerHTML = `
    <div class="scrim" data-close></div>
    <nav class="drawer" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="drawer-head">
        <span class="brand">${LOGO}<span class="brand-name" style="font-size:19px">Forge</span></span>
        <button class="btn ghost" data-close aria-label="Close menu" style="min-height:40px;padding:0 10px;font-size:22px">×</button>
      </div>
      <a href="#/profile" class="drawer-item" data-go style="margin:0 12px 8px;border:1px solid var(--border);min-height:64px">
        <span class="avatar md">${esc(initials(p.firstName, p.lastName))}</span>
        <span style="display:flex;flex-direction:column"><strong style="color:var(--text)">${esc(p.firstName)} ${esc(p.lastName)}</strong><span class="small faint">View your profile</span></span>
      </a>
      ${MENU.map(g => `
        <div class="drawer-group">
          <div class="drawer-label">${g.title}</div>
          ${g.items.map(([key, label, ic, notYet]) => notYet
            ? `<div class="drawer-item disabled" aria-disabled="true">${icon(ic)}<span>${label}</span><span class="soon">Soon</span></div>`
            : `<a href="#/${key}" class="drawer-item" data-go ${current === key ? 'aria-current="page"' : ""}>${icon(ic)}<span>${label}</span></a>`).join("")}
        </div>`).join("")}
      <div class="drawer-group" id="menu-communities" hidden></div>
      <div style="margin-top:auto;padding:16px 20px 20px;border-top:1px solid var(--divider)">
        <button class="drawer-item" id="menu-logout" style="width:100%;border:none;background:transparent;color:var(--warn);cursor:pointer">${icon("logout")}<span>Log out</span></button>
      </div>
    </nav>`;
  host.appendChild(wrap);
  // Your communities, filled in once they load.
  myCommunities(state.user.uid).then(list => {
    const box = wrap.querySelector("#menu-communities");
    if (!box || !list.length) return;
    box.hidden = false;
    box.innerHTML = `<div class="drawer-label">Your communities</div>` + list.slice(0, 6).map(c =>
      `<a href="#/c/${esc(c.id)}" class="drawer-item" data-go ${current === "c" && location.hash.includes(c.id) ? 'aria-current="page"' : ""}>${badge(c, 24)}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.name)}</span></a>`).join("")
      + (list.length > 6 ? `<a href="#/communities" class="drawer-item small muted" data-go>See all ${list.length}</a>` : "");
    box.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", close));
  }).catch(() => {});
  document.getElementById("menu-open")?.setAttribute("aria-expanded", "true");
  wrap.querySelector(".drawer a, .drawer button")?.focus();

  const close = () => {
    if (!menuOpen) return;
    const instant = document.documentElement.getAttribute("data-motion") === "reduce";
    wrap.classList.add("closing");
    setTimeout(() => { wrap.remove(); menuOpen = false; document.getElementById("menu-open")?.setAttribute("aria-expanded", "false"); }, instant ? 0 : 200);
    document.removeEventListener("keydown", onKey);
  };
  const onKey = e => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  wrap.querySelectorAll("[data-close]").forEach(el => el.onclick = close);
  wrap.querySelectorAll("[data-go]").forEach(el => el.addEventListener("click", close));
  wrap.querySelector("#menu-logout").onclick = () => { close(); sb.auth.signOut().then(() => navigate("login")); };
}
