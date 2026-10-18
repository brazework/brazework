// Public landing page.
import { db, addDoc, collection, serverTimestamp } from "../firebase.js";
import { esc, EMAIL_RE, TOPICS, friendlyError } from "../util.js";

const FREE_MAIL = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "icloud.com", "aol.com", "proton.me", "protonmail.com"];

const icon = {
  company: `<svg width="32" height="32" viewBox="0 0 28 28" fill="none" stroke="var(--accent)" stroke-width="1.6" aria-hidden="true"><rect x="4" y="9" width="12" height="15"/><rect x="16" y="4" width="8" height="20"/><path d="M8 13 H12 M8 17 H12 M19 8 H21 M19 12 H21 M19 16 H21"/></svg>`,
  school: `<svg width="32" height="32" viewBox="0 0 28 28" fill="none" stroke="var(--accent)" stroke-width="1.6" aria-hidden="true"><path d="M3 11 L14 5 L25 11 L14 17 Z"/><path d="M8 14 V20 C8 22 20 22 20 20 V14"/><path d="M25 11 V18"/></svg>`,
  cnc: `<svg width="120" height="90" viewBox="0 0 120 90" fill="none" stroke="var(--track)" stroke-width="1.5" aria-hidden="true"><rect x="10" y="60" width="100" height="18"/><rect x="22" y="20" width="12" height="40"/><rect x="86" y="20" width="12" height="40"/><rect x="22" y="12" width="76" height="10"/><rect x="52" y="22" width="16" height="22"/><path d="M60 44 L60 54"/></svg>`
};

export function render({ view }) {
  let field = TOPICS[0].name;
  view.innerHTML = `
    <section class="lp-hero" id="lp-top">
      <div class="lp-wrap lp-hero-inner">
        <div class="lp-hero-copy rise">
          <div class="kicker">For STEM students &amp; professionals</div>
          <h1>Show what you build.<br>Connect with who builds it.</h1>
          <p class="lp-lead">Forge is the professional network made only for STEM: scientists, engineers, mathematicians, technologists and the students on their way. Showcase your projects, meet people in your discipline, and get noticed for what you can actually do.</p>
          <div class="row">
            <a class="btn primary lp-btn" href="#/signup">Create your free account</a>
            <button class="btn lp-btn" data-scroll="lp-features">See how it works</button>
          </div>
          <p class="small faint">Free for students and professionals. Students verify with a university email.</p>
        </div>
        <aside class="lp-sample rise" style="animation-delay:.12s" aria-label="Example profile">
          <div class="lp-mono faint">Sample profile</div>
          <div class="row" style="gap:14px">
            <span class="avatar md" style="width:52px;height:52px;font-size:18px">IC</span>
            <div class="stack" style="gap:2px"><strong>Ian C.</strong><span class="small muted">Mechanical Engineer · Robotics</span></div>
          </div>
          <div class="lp-sample-project">
            <div class="lp-sample-media">${icon.cnc}</div>
            <div class="stack" style="gap:10px;padding:16px">
              <strong>Desktop 3-axis CNC router</strong>
              <div class="row" style="gap:6px"><span class="tag">CAD</span><span class="tag">Firmware</span><span class="tag">BOM</span></div>
              <span class="small faint">12 updates · 9 critiques · 1.2K followers</span>
            </div>
          </div>
          <div class="row"><span class="btn primary" style="flex:1 1 0;pointer-events:none" aria-hidden="true">Connect</span><span class="btn" style="flex:1 1 0;pointer-events:none" aria-hidden="true">Follow project</span></div>
        </aside>
      </div>
    </section>

    <section class="lp-wrap lp-section" id="lp-features">
      <div class="lp-head">
        <div class="kicker">One place for your work</div>
        <h2>A résumé tells people what you did. Forge shows them.</h2>
      </div>
      <div class="lp-grid3">
        ${[
          ["01 / Showcase", "Build a portfolio that proves it", "Post projects with CAD files, schematics, code, test data and write-ups. Keep a build log as you go, so your profile becomes a living record of real work."],
          ["02 / Connect", "Network by discipline, not by noise", "Follow researchers, engineers, labs and teams in your field. Ask technical questions, find collaborators and meet people who actually know the work."],
          ["03 / Grow", "Get better, together", "Get structured critiques from people in your field, join communities around what you build, and find events and opportunities matched to your interests."]
        ].map(([k, h, b]) => `<article class="card lp-feature"><span class="lp-mono faint">${k}</span><h3>${h}</h3><p class="muted">${b}</p></article>`).join("")}
      </div>
    </section>

    <section class="lp-band" id="lp-disciplines">
      <div class="lp-wrap lp-section" style="padding-top:88px;padding-bottom:88px">
        <div class="lp-head">
          <div class="kicker">Communities</div>
          <h2>Find your people.</h2>
          <p class="muted lp-sub">Every discipline gets its own space, with feeds and project galleries that stay on topic. Pick a field to see what's inside.</p>
        </div>
        <div class="row" role="group" aria-label="Fields" id="lp-fields" style="gap:10px"></div>
        <div class="card stack" id="lp-field-detail" aria-live="polite"></div>
      </div>
    </section>

    <section class="lp-wrap lp-section lp-why" id="lp-why">
      <div class="lp-head" style="flex:1 1 360px">
        <div class="kicker">Why Forge</div>
        <h2>General networks weren't made for STEM.</h2>
      </div>
      <ul class="lp-list" style="flex:1 1 480px">
        ${[
          ["Less clutter", "No viral posts or recruiter spam. Your feed is projects, questions and work from your field, and messages from strangers wait in a separate request inbox."],
          ["Work over titles", "Profiles are built around what you've made, so students and senior professionals alike are judged on the work."],
          ["Protect your ideas", "Keep a project private and share only a summary. People ask for access, and you decide who sees the details."],
          ["Verified members", "Students verify with a university email and organizations with their work domain, so you know who you're talking to."]
        ].map(([h, b]) => `<li><span class="lp-arrow" aria-hidden="true">→</span><div class="stack" style="gap:4px"><strong>${h}</strong><span class="muted">${b}</span></div></li>`).join("")}
      </ul>
    </section>

    <section class="lp-band" id="lp-orgs">
      <div class="lp-wrap lp-section" style="padding-top:88px;padding-bottom:88px">
        <div class="lp-head">
          <div class="kicker">For organizations</div>
          <h2>Companies and schools have a home here too.</h2>
          <p class="muted lp-sub">Organization accounts open soon and are verified through a work email. Register your interest and we'll reach out when they're ready.</p>
        </div>
        <div class="lp-grid2">
          <article class="card stack lp-org">${icon.company}<h3>For companies</h3><p class="muted">Find engineers and scientists by what they've actually built. Post openings and internships, sponsor student projects and host events.</p></article>
          <article class="card stack lp-org">${icon.school}<h3>For schools</h3><p class="muted">Give your students a verified place to show their work. Share career events, highlight student projects and connect them with employers.</p></article>
        </div>
        <form class="card stack" id="lp-org-form" novalidate style="max-width:760px">
          <h3 style="font-size:20px">Register your organization's interest</h3>
          <div class="row" role="group" aria-label="Organization type" id="lp-org-type">
            <button type="button" class="chip" data-type="company" aria-pressed="true">Company</button>
            <button type="button" class="chip" data-type="school" aria-pressed="false">School</button>
          </div>
          <div class="row" style="align-items:flex-start">
            <div class="field" style="flex:1 1 240px"><label for="lp-org-name">Organization name</label><input id="lp-org-name" class="input" maxlength="120" autocomplete="organization"></div>
            <div class="field" style="flex:1 1 240px"><label for="lp-org-contact">Your name</label><input id="lp-org-contact" class="input" maxlength="80" autocomplete="name"></div>
          </div>
          <div class="row" style="align-items:flex-start">
            <div class="field" style="flex:1 1 240px"><label for="lp-org-email">Work email</label><input id="lp-org-email" class="input" type="email" maxlength="120" autocomplete="email"></div>
            <div class="field" style="flex:1 1 240px"><label for="lp-org-role">Your role</label><input id="lp-org-role" class="input" maxlength="80" placeholder="e.g. Engineering recruiter"></div>
          </div>
          <div id="lp-org-msg" role="status"></div>
          <div><button class="btn primary" type="submit" id="lp-org-submit">Register interest</button></div>
        </form>
      </div>
    </section>

    <section class="lp-cta">
      <div class="lp-wrap stack" style="align-items:center;text-align:center;gap:22px;padding:104px 24px">
        <h2>Join the STEM community on Forge.</h2>
        <p class="muted lp-sub" style="margin:0 auto">Sign up with your university or work email, pick the fields you care about, and share what you're building.</p>
        <a class="btn primary lp-btn" href="#/signup">Create your free account</a>
      </div>
    </section>

    <footer class="lp-footer">
      <div class="lp-wrap row" style="justify-content:space-between;padding:28px 24px">
        <span class="small faint">© ${new Date().getFullYear()} Forge. Built for the STEM community.</span>
        <div class="row small" style="gap:20px"><a href="#/login" class="muted">Log in</a><a href="#/signup" class="muted">Sign up</a><button class="btn ghost small" data-scroll="lp-top" style="min-height:28px;padding:0">Back to top ↑</button></div>
      </div>
    </footer>`;

  // Smooth scrolling for in-page links (the address bar is reserved for page routing).
  const reduce = () => document.documentElement.getAttribute("data-motion") === "reduce" || matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollTo = id => { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: reduce() ? "auto" : "smooth", block: "start" }); };
  const onScrollClick = e => { const t = e.target.closest("[data-scroll]"); if (t) { e.preventDefault(); scrollTo(t.dataset.scroll); } };
  document.addEventListener("click", onScrollClick);

  // Discipline explorer.
  const fieldsEl = view.querySelector("#lp-fields"), detail = view.querySelector("#lp-field-detail");
  const drawFields = () => {
    fieldsEl.innerHTML = TOPICS.map(t => `<button class="chip" data-field="${esc(t.name)}" aria-pressed="${t.name === field}">${esc(t.name)}</button>`).join("");
    const g = TOPICS.find(t => t.name === field);
    detail.innerHTML = `<div class="row" style="justify-content:space-between"><h3 style="font-size:18px">${esc(g.name)}</h3><a href="#/signup" class="small">Join ${esc(g.name)} on Forge →</a></div>
      <div class="row" style="gap:8px">${g.topics.map(t => `<span class="tag">${esc(t)}</span>`).join("")}</div>`;
    fieldsEl.querySelectorAll("[data-field]").forEach(b => b.onclick = () => { field = b.dataset.field; drawFields(); });
  };
  drawFields();

  // Organization interest form.
  let orgType = "company";
  view.querySelectorAll("#lp-org-type [data-type]").forEach(b => b.onclick = () => {
    orgType = b.dataset.type;
    view.querySelectorAll("#lp-org-type [data-type]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  });
  view.querySelector("#lp-org-form").onsubmit = async e => {
    e.preventDefault();
    const $ = id => view.querySelector(id).value.trim();
    const msg = view.querySelector("#lp-org-msg");
    const fail = t => { msg.className = "error"; msg.textContent = t; };
    const name = $("#lp-org-name"), contact = $("#lp-org-contact"), email = $("#lp-org-email").toLowerCase(), role = $("#lp-org-role");
    if (!name || !contact) return fail("Enter your organization's name and your name.");
    if (!EMAIL_RE.test(email)) return fail("Enter a valid work email.");
    if (FREE_MAIL.includes(email.split("@")[1])) return fail("Please use your work email, not a personal address.");
    const btn = view.querySelector("#lp-org-submit");
    btn.disabled = true; btn.textContent = "Sending…";
    try {
      await addDoc(collection(db, "orgInterest"), { type: orgType, name, contact, email, role, createdAt: serverTimestamp() });
      view.querySelector("#lp-org-form").innerHTML = `<h3 style="font-size:20px">Thanks, ${esc(contact.split(" ")[0])}.</h3><p class="muted">We've noted ${esc(name)}'s interest and will reach out at ${esc(email)} when organization accounts open.</p>`;
    } catch (err) {
      btn.disabled = false; btn.textContent = "Register interest";
      fail(friendlyError(err));
    }
  };

  return () => document.removeEventListener("click", onScrollClick);
}
