// Settings: appearance, interests and account.
import { sb, run } from "../supabase.js";
import { esc, TOPICS, friendlyError, toast } from "../util.js";
import { applyTheme } from "../theme.js";

const ACCENTS = [["Forge Orange", "#FF7A2F"], ["Circuit Blue", "#3FB6FF"], ["Lab Green", "#3DDC97"], ["Signal Yellow", "#F5C542"], ["Plasma Violet", "#B48CFF"]];
const get = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
const set = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} applyTheme(); };

export function render({ view, state, navigate, refreshProfile }) {
  const p = state.profile;
  const draw = () => {
    const theme = get("forge.theme", "dark"), accent = get("forge.accent", "#FF7A2F"), size = get("forge.textSize", "default"), motion = get("forge.motion", "full");
    const chip = (on) => `aria-pressed="${on}"`;
    view.innerHTML = `
      <div class="page" style="max-width:900px">
        <h1 style="font-size:28px;margin-bottom:20px">Settings</h1>
        <div class="stack" style="gap:20px">
          <section class="card stack">
            <h2 style="font-size:18px">Appearance</h2>
            <div class="stack" style="gap:8px"><span style="font-weight:500">Theme</span>
              <div class="row" role="radiogroup" aria-label="Theme">
                ${[["dark", "Dark"], ["light", "Light"], ["system", "Match device"]].map(([k, l]) => `<button class="chip" data-theme="${k}" role="radio" aria-checked="${theme === k}" ${chip(theme === k)}>${l}</button>`).join("")}
              </div></div>
            <div class="stack" style="gap:8px"><span style="font-weight:500">Accent color</span>
              <div class="row" role="radiogroup" aria-label="Accent color">
                ${ACCENTS.map(([l, c]) => `<button class="chip" data-accent="${c}" role="radio" aria-checked="${accent === c}" style="display:inline-flex;align-items:center;gap:8px;${accent === c ? `border-color:${c}` : ""}"><span style="width:16px;height:16px;border-radius:50%;background:${c}"></span>${l}</button>`).join("")}
              </div></div>
            <div class="row" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:12px">
              <span><strong style="font-weight:500">Text size</strong><br><span class="small muted">Makes text larger across Forge.</span></span>
              <div class="row">${[["default", "Default"], ["large", "Large"]].map(([k, l]) => `<button class="chip" data-size="${k}" ${chip(size === k)}>${l}</button>`).join("")}</div>
            </div>
            <div class="row" style="justify-content:space-between;border-top:1px solid var(--border);padding-top:12px">
              <span><strong style="font-weight:500">Reduce motion</strong><br><span class="small muted">Turns off animations and transitions.</span></span>
              <button class="chip" id="st-motion" role="switch" aria-checked="${motion === "reduce"}" ${chip(motion === "reduce")}>${motion === "reduce" ? "On" : "Off"}</button>
            </div>
          </section>

          <section class="card stack">
            <div class="row" style="justify-content:space-between"><h2 style="font-size:18px">Interests</h2><span class="small muted" id="st-count"></span></div>
            <div class="stack" style="max-height:340px;overflow-y:auto">
              ${TOPICS.map(g => `<div class="stack" style="gap:6px"><h3 style="font-size:13px">${esc(g.name)}</h3><div class="row" style="gap:6px">${g.topics.map(t => `<button class="chip" data-topic="${esc(t)}" aria-pressed="${(p.interests || []).includes(t)}">${esc(t)}</button>`).join("")}</div></div>`).join("")}
            </div>
            <div><button class="btn primary" id="st-save-int">Save interests</button></div>
          </section>

          <section class="card stack">
            <h2 style="font-size:18px">Account</h2>
            <div class="row" style="justify-content:space-between"><span class="muted">Name</span><span>${esc(p.firstName)} ${esc(p.lastName)}</span></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Email</span><span>${esc(state.user.email)} · verified</span></div>
            <div class="row" style="justify-content:space-between"><span class="muted">Account type</span><span>${p.accountType === "student" ? "Student" : "Professional"}</span></div>
            <div><button class="btn" id="st-out" style="color:var(--warn)">Log out</button></div>
          </section>
        </div>
      </div>`;

    view.querySelectorAll("[data-theme]").forEach(b => b.onclick = () => { set("forge.theme", b.dataset.theme); draw(); });
    view.querySelectorAll("[data-accent]").forEach(b => b.onclick = () => { set("forge.accent", b.dataset.accent); draw(); });
    view.querySelectorAll("[data-size]").forEach(b => b.onclick = () => { set("forge.textSize", b.dataset.size); draw(); });
    view.querySelector("#st-motion").onclick = () => { set("forge.motion", get("forge.motion", "full") === "reduce" ? "full" : "reduce"); draw(); };

    const picked = new Set(p.interests || []);
    const count = view.querySelector("#st-count");
    count.textContent = `${picked.size} selected`;
    view.querySelectorAll("[data-topic]").forEach(b => b.onclick = () => {
      const t = b.dataset.topic;
      if (picked.has(t)) picked.delete(t); else picked.add(t);
      b.setAttribute("aria-pressed", String(picked.has(t)));
      count.textContent = `${picked.size} selected`;
    });
    view.querySelector("#st-save-int").onclick = async () => {
      if (picked.size < 3) { toast("Pick at least 3 interests."); return; }
      try { await run(sb.from("profiles").update({ interests: [...picked] }).eq("id", state.user.uid)); await refreshProfile(); toast("Interests saved."); }
      catch (e) { toast(esc(friendlyError(e))); }
    };
    view.querySelector("#st-out").onclick = () => sb.auth.signOut().then(() => navigate("login"));
  };
  draw();
}
