// Step 2: confirm the email address before using Forge.
import { auth, reload, sendEmailVerification, signOut } from "../firebase.js";
import { esc, friendlyError } from "../util.js";

export function render({ view, state, navigate }) {
  const email = state.user ? state.user.email : "";
  view.innerHTML = `
    <div class="auth-wrap"><div class="auth-card rise">
      <div class="kicker">Create your account · step 2 of 3</div>
      <h1 style="font-size:26px">Check your inbox</h1>
      <p class="muted">We sent a verification link to <strong style="color:var(--text)">${esc(email)}</strong>. Click it, then come back here.</p>
      <div id="v-msg" role="status"></div>
      <div class="row">
        <button class="btn primary" id="v-done">I've verified my email</button>
        <button class="btn" id="v-resend">Resend link</button>
      </div>
      <p class="small faint">Wrong address? <button class="btn ghost small" id="v-out" style="min-height:28px;padding:0">Log out and start again</button></p>
    </div></div>`;

  const msg = view.querySelector("#v-msg");
  view.querySelector("#v-done").onclick = async () => {
    try {
      await reload(auth.currentUser);
      // Refresh the sign-in token so the database sees the verified status right away.
      await auth.currentUser.getIdToken(true);
      state.user = auth.currentUser;
      if (state.user.emailVerified) navigate("onboarding");
      else { msg.className = "error"; msg.textContent = "Not verified yet. Click the link in the email, then try again."; }
    } catch (e) { msg.className = "error"; msg.textContent = friendlyError(e); }
  };
  view.querySelector("#v-resend").onclick = async () => {
    try { await sendEmailVerification(auth.currentUser); msg.className = "success"; msg.textContent = "A new link is on its way. Check spam if you don't see it."; }
    catch (e) { msg.className = "error"; msg.textContent = friendlyError(e); }
  };
  view.querySelector("#v-out").onclick = () => signOut(auth).then(() => navigate("signup"));
}
