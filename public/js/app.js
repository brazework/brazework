// Forge app entry: keeps track of who's signed in, decides which page to show,
// and runs the shared shell (top bar, side menu, theme, page transitions).
import { isConfigured, auth, db, onAuthStateChanged, doc, getDoc } from "./firebase.js";
import { renderShell } from "./shell.js";
import { applyTheme } from "./theme.js";
import * as landing from "./views/landing.js";
import * as login from "./views/login.js";
import * as signup from "./views/signup.js";
import * as verify from "./views/verify.js";
import * as onboarding from "./views/onboarding.js";
import * as feed from "./views/feed.js";
import * as profile from "./views/profile.js";
import * as settings from "./views/settings.js";
import * as saved from "./views/saved.js";
import * as communities from "./views/communities.js";
import * as community from "./views/community.js";
import * as network from "./views/network.js";
import * as soon from "./views/soon.js";
import * as setup from "./views/setup.js";

// "hold" pauses automatic redirects while a page finishes something (like the log-in welcome).
export const state = { user: null, profile: null, authReady: false, hold: false };

const PUBLIC = new Set(["", "login", "signup"]);
const ROUTES = {
  "": landing, login, signup, verify, onboarding, feed, profile, u: profile, settings,
  communities, c: community, network, messages: soon, events: soon, saved, analytics: soon, marketplace: soon
};

let cleanup = null;
let rendering = false;
let pending = false;

export function navigate(path) {
  const target = "#/" + path.replace(/^#?\/?/, "");
  if (location.hash === target) route(); else location.hash = target;
}

export async function refreshProfile() {
  if (!state.user) { state.profile = null; return; }
  const snap = await getDoc(doc(db, "users", state.user.uid));
  state.profile = snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

function parseHash() {
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  return { name: parts[0] || "", params: parts.slice(1) };
}

function reduced() {
  return document.documentElement.getAttribute("data-motion") === "reduce"
    || (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}

// Decides where someone is allowed to be, based on their sign-in progress.
function guard(name) {
  const u = state.user;
  if (!u) return PUBLIC.has(name) ? name : "login";
  if (!u.emailVerified) return name === "verify" ? name : "verify";
  if (!state.profile || !state.profile.onboarded) return name === "onboarding" ? name : "onboarding";
  if (PUBLIC.has(name) || name === "verify" || name === "onboarding") return "feed";
  return ROUTES[name] ? name : "feed";
}

async function route() {
  if (rendering) { pending = true; return; }
  rendering = true;
  try {
    const view = document.getElementById("view");
    if (!isConfigured) { setup.render({ view }); return; }
    if (!state.authReady) return;
    if (state.hold) return;

    const { name, params } = parseHash();
    const allowed = guard(name);
    if (allowed !== name) { rendering = false; navigate(allowed); return; }

    if (!reduced() && view.innerHTML) {
      view.classList.add("leaving");
      await new Promise(r => setTimeout(r, 160));
    }
    if (typeof cleanup === "function") { try { cleanup(); } catch (e) {} }
    cleanup = null;

    renderShell({ state, current: name, navigate });
    view.classList.remove("leaving");
    view.classList.add("entering");
    const mod = ROUTES[name];
    cleanup = await mod.render({ view, state, params, name, navigate, refreshProfile });
    window.scrollTo(0, 0);
    requestAnimationFrame(() => view.classList.remove("entering"));
  } finally {
    rendering = false;
    // If the address changed while we were drawing, show the latest page.
    if (pending) { pending = false; route(); }
  }
}

// ---------- Start ----------
try { window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", applyTheme); } catch (e) {}
window.addEventListener("hashchange", route);
if (!isConfigured) {
  route();
} else {
  onAuthStateChanged(auth, async (user) => {
    state.user = user;
    try { await refreshProfile(); } catch (e) { state.profile = null; console.error(e); }
    state.authReady = true;
    route();
  });
}
