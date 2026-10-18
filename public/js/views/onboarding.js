// Step 3: about you and your interests.
import { db, doc, updateDoc } from "../firebase.js";
import { esc, TOPICS, FIELDS, friendlyError } from "../util.js";

export function render({ view, state, navigate, refreshProfile }) {
  const p = state.profile || {};
  const student = p.accountType === "student";
  const selected = new Set(p.interests || []);
  view.innerHTML = `
    <div class="auth-wrap"><form class="auth-card rise" id="ob-form" novalidate style="max-width:760px">
      <div class="kicker">Create your account · step 3 of 3</div>
      <h1 style="font-size:28px">A bit about you</h1>
      <div class="row" style="align-items:flex-start">
        <div class="field" style="flex:1 1 260px"><label for="ob-role">${student ? "Major" : "Current profession"}</label><input id="ob-role" class="input" placeholder="${student ? "e.g. Mechanical Engineering" : "e.g. Structural Engineer"}" value="${esc(p.headline || "")}"></div>
        <div class="field" style="flex:1 1 260px"><label for="ob-field">Field of expertise</label>
          <select id="ob-field" class="input"><option value="">Choose a field</option>${FIELDS.map(f => `<option ${p.field === f ? "selected" : ""}>${esc(f)}</option>`).join("")}</select></div>
      </div>
      <div class="stack">
        <div class="row" style="justify-content:space-between"><h2 style="font-size:18px">What do you want to see?</h2><span class="small muted" id="ob-count"></span></div>
        <p class="small muted">Pick at least 3. These shape your feed, events and suggestions.</p>
        <div class="stack" style="max-height:420px;overflow-y:auto;padding-right:6px">
          ${TOPICS.map(g => `<div class="stack" style="gap:8px"><h3 style="font-size:14px">${esc(g.name)}</h3><div class="row" style="gap:8px">
            ${g.topics.map(t => `<button type="button" class="chip" data-topic="${esc(t)}" aria-pressed="${selected.has(t)}">${esc(t)}</button>`).join("")}</div></div>`).join("")}
        </div>
      </div>
      <div id="ob-msg" role="alert"></div>
      <button class="btn primary" type="submit" id="ob-submit">Finish and go to my feed</button>
    </form></div>`;

  const count = view.querySelector("#ob-count");
  const showCount = () => count.textContent = `${selected.size} selected`;
  showCount();
  view.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => {
    const t = b.dataset.topic;
    if (selected.has(t)) selected.delete(t); else selected.add(t);
    b.setAttribute("aria-pressed", String(selected.has(t)));
    showCount();
  });

  view.querySelector("#ob-form").onsubmit = async (e) => {
    e.preventDefault();
    const msg = view.querySelector("#ob-msg");
    const role = view.querySelector("#ob-role").value.trim(), field = view.querySelector("#ob-field").value;
    if (!role) { msg.className = "error"; msg.textContent = student ? "Enter your major." : "Enter your current profession."; return; }
    if (!field) { msg.className = "error"; msg.textContent = "Choose your field of expertise."; return; }
    if (selected.size < 3) { msg.className = "error"; msg.textContent = "Pick at least 3 topics."; return; }
    const btn = view.querySelector("#ob-submit");
    btn.disabled = true; btn.textContent = "Saving…";
    try {
      await updateDoc(doc(db, "users", state.user.uid), { headline: role, field, interests: [...selected], onboarded: true });
      await refreshProfile();
      try { sessionStorage.setItem("forge.welcome", "new"); } catch (e2) {}
      navigate("feed");
    } catch (err) {
      btn.disabled = false; btn.textContent = "Finish and go to my feed";
      msg.className = "error"; msg.textContent = friendlyError(err);
    }
  };
}
