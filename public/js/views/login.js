// Log in, with a short welcome before entering the app.
import { sb, toUser } from "../supabase.js";
import { esc, EMAIL_RE, friendlyError, LOGO } from "../util.js";

export function render({ view, navigate, refreshProfile, state }) {
  view.innerHTML = `
    <div class="auth-wrap"><form class="auth-card rise" id="login-form" novalidate>
      <h1 style="font-size:28px">Log in to Forge</h1>
      <div class="field"><label for="li-email">Email</label><input id="li-email" class="input" type="email" autocomplete="email" required></div>
      <div class="field">
        <div class="row" style="justify-content:space-between"><label for="li-pass">Password</label><button type="button" class="btn ghost small" id="forgot" style="min-height:30px;padding:0">Forgot password?</button></div>
        <input id="li-pass" class="input" type="password" autocomplete="current-password" required>
      </div>
      <div id="li-msg" role="alert"></div>
      <button class="btn primary" id="li-submit" type="submit">Log in</button>
      <p class="small muted" style="border-top:1px solid var(--border);padding-top:18px">New to Forge? <a href="#/signup">Create an account</a></p>
    </form></div>`;

  const form = view.querySelector("#login-form");
  const msg = view.querySelector("#li-msg");
  const btn = view.querySelector("#li-submit");
  const email = view.querySelector("#li-email");

  view.querySelector("#forgot").onclick = async () => {
    if (!EMAIL_RE.test(email.value.trim())) { msg.className = "error"; msg.textContent = "Enter your email above first."; return; }
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: `${location.origin}/?flow=reset` });
      if (error) throw error;
      msg.className = "success"; msg.textContent = "If there's an account for that email, a reset link is on its way.";
    }
    catch (e) { msg.className = "error"; msg.textContent = friendlyError(e); }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    const em = email.value.trim(), pw = view.querySelector("#li-pass").value;
    if (!EMAIL_RE.test(em) || !pw) { msg.className = "error"; msg.textContent = "Enter your email and password."; return; }
    btn.disabled = true; btn.textContent = "Signing in…"; msg.textContent = "";
    state.hold = true;
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email: em, password: pw });
      if (error) {
        // Signed up but never clicked the link: send them to the "check your inbox" step.
        if (error.code === "email_not_confirmed") { state.hold = false; state.pendingEmail = em; navigate("verify"); return; }
        throw error;
      }
      state.user = toUser(data.user);
      await refreshProfile();
      const first = state.profile ? state.profile.firstName : "";
      // Welcome moment, then into the app.
      view.querySelector("#login-form").outerHTML = `
        <div class="auth-card" role="status" style="align-items:center;text-align:center;min-height:320px;justify-content:center">
          <div style="transform:scale(2.4);margin-bottom:18px">${LOGO}</div>
          <h1 style="font-size:26px">Welcome back${first ? ", " + esc(first) : ""}</h1>
          <p class="muted">Getting your feed ready…</p>
          <div style="width:220px;height:4px;border-radius:2px;background:var(--border);overflow:hidden"><div id="li-bar" style="height:100%;width:0;background:var(--accent);transition:width 1.1s cubic-bezier(.4,0,.2,1)"></div></div>
        </div>`;
      requestAnimationFrame(() => { const b = document.getElementById("li-bar"); if (b) b.style.width = "100%"; });
      setTimeout(() => { state.hold = false; navigate("feed"); }, document.documentElement.getAttribute("data-motion") === "reduce" ? 0 : 1300);
    } catch (err) {
      state.hold = false;
      btn.disabled = false; btn.textContent = "Log in";
      msg.className = "error"; msg.textContent = friendlyError(err);
    }
  };
}
