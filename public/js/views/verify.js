// Step 2: confirm the email address before using Forge.
// Supabase only lets you sign in once the address is confirmed. Clicking the link signs you in
// automatically in this browser; from another device, you log in afterwards.
import { sb } from "../supabase.js";
import { esc, friendlyError } from "../util.js";

export function render({ view, state, navigate }) {
  const email = state.pendingEmail || (state.user ? state.user.email : "");
  view.innerHTML = `
    <div class="auth-wrap"><div class="auth-card rise">
      <div class="kicker">Create your account · step 2 of 3</div>
      <h1 style="font-size:26px">Check your inbox</h1>
      <p class="muted">We sent a verification link to <strong style="color:var(--text)">${esc(email)}</strong>. Click it and you'll come straight back here, signed in.</p>
      <div id="v-msg" role="status"></div>
      <div class="row">
        <button class="btn primary" id="v-done">I've verified my email</button>
        <button class="btn" id="v-resend">Resend link</button>
      </div>
      <p class="small faint">Wrong address? <button class="btn ghost small" id="v-out" style="min-height:28px;padding:0">Start again</button></p>
    </div></div>`;

  const msg = view.querySelector("#v-msg");
  view.querySelector("#v-done").onclick = () => navigate("login");
  view.querySelector("#v-resend").onclick = async () => {
    try {
      const { error } = await sb.auth.resend({ type: "signup", email, options: { emailRedirectTo: location.origin } });
      if (error) throw error;
      msg.className = "success"; msg.textContent = "A new link is on its way. Check spam if you don't see it.";
    } catch (e) { msg.className = "error"; msg.textContent = friendlyError(e); }
  };
  view.querySelector("#v-out").onclick = async () => {
    state.pendingEmail = "";
    if (state.user) await sb.auth.signOut();
    navigate("signup");
  };
}
