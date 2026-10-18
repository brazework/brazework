// Shown only until the Supabase settings are in js/supabase-config.js.
import { LOGO } from "../util.js";

export function render({ view }) {
  document.getElementById("shell").innerHTML = "";
  view.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="row">${LOGO}<strong style="font-size:20px">Forge</strong></div>
      <h1 style="font-size:26px">Almost there: connect Supabase</h1>
      <p class="muted">This copy of Forge isn't connected to a Supabase project yet. On Vercel, connect a Supabase database to the project and redeploy. To run it on your computer, copy <code>public/js/supabase-config.example.js</code> to <code>supabase-config.js</code> and fill it in.</p>
      <p class="muted">Step-by-step instructions are in <strong>SETUP.md</strong>.</p>
    </div></div>`;
}
