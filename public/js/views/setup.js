// Shown only until the Firebase settings have been pasted into js/firebase-config.js.
import { LOGO } from "../util.js";

export function render({ view }) {
  document.getElementById("shell").innerHTML = "";
  view.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="row">${LOGO}<strong style="font-size:20px">Forge</strong></div>
      <h1 style="font-size:26px">Almost there: connect Firebase</h1>
      <p class="muted">This copy of Forge isn't connected to a Firebase project yet. Open <code>public/js/firebase-config.js</code>, paste in your project's settings, save, and reload this page.</p>
      <p class="muted">Step-by-step instructions are in <strong>SETUP.md</strong>, step 4.</p>
    </div></div>`;
}
