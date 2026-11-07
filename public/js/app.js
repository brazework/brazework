// Forge app entry: keeps track of who's signed in, decides which page to show,
// and runs the shared shell (top bar, side menu, theme, page transitions).
import { isConfigured, sb, one, toUser, PROFILE_COLS } from "./supabase.js";
import { toast, esc } from "./util.js";
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
import * as messages from "./views/messages.js";
import * as soon from "./views/soon.js";
import * as setup from "./views/setup.js";
import * as reset from "./views/reset.js";

// "hold" pauses automatic redirects while a page finishes something (like the log-in welcome).
// "pendingEmail" is the address waiting to be confirmed after sign-up; "recovery" is set by a password reset link.
export const state = { user: null, profile: null, authReady: false, hold: false, pendingEmail: "", recovery: false };

const PUBLIC = new Set(["", "login", "signup"]);
const ROUTES = {
  "": landing, login, signup, verify, reset, onboarding, feed, profile, u: profile, settings,
  communities, c: community, network, messages, events: soon, saved, analytics: soon, marketplace: soon
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
  state.profile = await one(sb.from("profiles").select(PROFILE_COLS).eq("id", state.user.uid));
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
  if (state.recovery && u) return "reset";
  if (!u) return PUBLIC.has(name) || (name === "verify" && state.pendingEmail) ? name : "login";
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
  // Links in Supabase's emails come back with ?flow=reset (password reset), or an error if the link is bad.
  const qs = new URLSearchParams(location.search);
  if (qs.get("flow") === "reset") state.recovery = true;
  const linkError = qs.get("error_description");
  if (qs.has("flow") || linkError) {
    ["flow", "error", "error_code", "error_description"].forEach(k => qs.delete(k));
    const rest = qs.toString();
    history.replaceState(null, "", location.pathname + (rest ? "?" + rest : "") + location.hash);
  }
  if (linkError) setTimeout(() => toast(esc(/expired|invalid/i.test(linkError) ? "That link has expired or was already used. Ask for a new one." : linkError), 8000), 400);
  // A link from an email signs you in only in the browser you used to ask for it. Opened anywhere else
  // (for example inside an email app), the email still counts as confirmed, so explain what to do next.
  const fromEmailLink = qs.has("code");

  sb.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") state.recovery = true;
    if (event === "INITIAL_SESSION" && fromEmailLink && !session) {
      const wasReset = state.recovery;
      state.recovery = false;
      setTimeout(() => toast(wasReset
        ? "Open the reset link in the same browser where you asked for it, or ask for a new one below."
        : "<strong>Your email is confirmed.</strong> Log in to continue.", 9000), 400);
      if (!location.hash.startsWith("#/login")) location.hash = "#/login";
    }
    const next = toUser(session && session.user);
    const sameUser = state.authReady && (state.user && state.user.uid) === (next && next.uid);
    state.user = next;
    if (sameUser && event !== "USER_UPDATED" && event !== "PASSWORD_RECOVERY") return; // e.g. a token refresh
    // Supabase asks that its own calls aren't awaited inside this callback.
    setTimeout(async () => {
      try { await refreshProfile(); } catch (e) { state.profile = null; console.error(e); }
      state.authReady = true;
      route();
    }, 0);
  });
}
