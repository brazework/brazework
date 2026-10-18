// Choose a new password, after following the link in a password reset email.
import { sb } from "../supabase.js";
import { esc, friendlyError } from "../util.js";

export function render({ view, state, navigate }) {
  view.innerHTML = `
    <div class="auth-wrap"><form class="auth-card rise" id="rs-form" novalidate>
      <h1 style="font-size:28px">Choose a new password</h1>
      <p class="muted">For ${state.user ? esc(state.user.email) : "your account"}.</p>
      <div class="field"><label for="rs-pass">New password</label><input id="rs-pass" class="input" type="password" autocomplete="new-password" minlength="8"><span class="small faint">At least 8 characters.</span></div>
      <div class="field"><label for="rs-pass2">Type it again</label><input id="rs-pass2" class="input" type="password" autocomplete="new-password" minlength="8"></div>
      <div id="rs-msg" role="alert"></div>
      <button class="btn primary" type="submit" id="rs-submit">Save new password</button>
    </form></div>`;

  const $ = s => view.querySelector(s);
  $("#rs-pass").focus();
  $("#rs-form").onsubmit = async e => {
    e.preventDefault();
    const msg = $("#rs-msg");
    const pass = $("#rs-pass").value, again = $("#rs-pass2").value;
    if (pass.length < 8) { msg.className = "error"; msg.textContent = "Choose a password with at least 8 characters."; return; }
    if (pass !== again) { msg.className = "error"; msg.textContent = "The two passwords don't match."; return; }
    const btn = $("#rs-submit"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const { error } = await sb.auth.updateUser({ password: pass });
      if (error) throw error;
      state.recovery = false;
      try { sessionStorage.setItem("forge.welcome", "reset"); } catch (e2) {}
      navigate("feed");
    } catch (err) {
      btn.disabled = false; btn.textContent = "Save new password";
      msg.className = "error"; msg.textContent = friendlyError(err);
    }
  };
}
