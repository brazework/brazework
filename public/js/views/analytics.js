// Your analytics (only you can see it): profile views over 7, 30, 90 days or 12 months,
// engagement on your posts, who's viewing (as totals), career progression and the role benchmark.
import { esc, friendlyError, icon } from "../util.js";
import { analytics } from "../activity.js";

const RANGES = [["7d", "7 days"], ["30d", "30 days"], ["90d", "90 days"], ["1y", "12 months"]];
const CAPTION = { "7d": "Daily views, last 7 days", "30d": "Daily views, last 30 days", "90d": "Weekly views, last 90 days", "1y": "Monthly views, last 12 months" };
const STATS = [["views", "Profile views"], ["likes", "Likes on your posts"], ["comments", "Comments on your posts"], ["followers", "New followers"], ["connections", "New connections"]];
const fmt = n => Number(n || 0).toLocaleString("en-US");

function delta(now, before) {
  now = Number(now || 0); before = Number(before || 0);
  if (now === before) return { text: "No change", sign: 0 };
  if (!before) return { text: `+${fmt(now)}`, sign: 1 };
  const pct = Math.round((now - before) / before * 100);
  return { text: `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`, sign: Math.sign(now - before) };
}

const bucketDate = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
function bucketLabel(s, unit, long) {
  const d = bucketDate(s);
  if (unit === "month") return d.toLocaleDateString("en-US", { month: long ? "long" : "short", year: "numeric" });
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return unit === "week" ? (long ? `Week of ${day}` : day) : (long ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : day);
}
const niceMax = v => { if (v <= 4) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p; return 10 * p; };

// Bars rounded only at the data end, sitting on the baseline.
function bar(x, y, w, h) {
  if (h <= 0) return "";
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function chartSVG(series, unit, width) {
  const H = 220, L = 36, R = 8, T = 12, B = 28;
  const pw = Math.max(80, width - L - R), ph = H - T - B;
  const max = niceMax(Math.max(0, ...series.map(s => s.views)));
  const slot = pw / series.length, gap = Math.max(2, Math.min(10, slot * 0.25)), bw = Math.max(2, slot - gap);
  const y = v => T + ph - (v / max) * ph;
  const grid = [0, max / 2, max].map(v => `
    <line x1="${L}" x2="${L + pw}" y1="${y(v)}" y2="${y(v)}" stroke="var(--divider)" stroke-width="1"/>
    <text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="var(--faint)" font-family="var(--mono)">${fmt(v)}</text>`).join("");
  const bars = series.map((s, i) => {
    const x = L + i * slot + gap / 2, top = y(s.views);
    return `<path d="${bar(x, top, bw, T + ph - top)}" fill="var(--accent)"/>
      <rect class="an-hit" data-i="${i}" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" fill="transparent"/>`;
  }).join("");
  const first = series[0], last = series[series.length - 1];
  return `<svg width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-label="Bar chart of profile views. The table below has the numbers.">
    ${grid}
    <line x1="${L}" x2="${L + pw}" y1="${T + ph}" y2="${T + ph}" stroke="var(--border-strong)" stroke-width="1"/>
    ${bars}
    <text x="${L}" y="${H - 8}" font-size="11" fill="var(--faint)">${esc(bucketLabel(first.bucket, unit))}</text>
    <text x="${L + pw}" y="${H - 8}" font-size="11" fill="var(--faint)" text-anchor="end">${esc(bucketLabel(last.bucket, unit))}${unit === "day" ? "" : " (so far)"}</text>
  </svg>`;
}

export function render({ view, state }) {
  const p = state.profile;
  let range = "30d", data = null, error = "", seq = 0, ro = null;

  view.innerHTML = `
    <div class="page" style="max-width:1000px">
      <p style="margin-bottom:12px"><a class="link-btn" href="#/profile">← Back to profile</a></p>
      <div class="row" style="justify-content:space-between;align-items:flex-end;margin-bottom:20px;gap:12px">
        <div class="stack" style="gap:6px">
          <div class="kicker">Analytics</div>
          <h1 style="font-size:28px">Your analytics</h1>
          <span class="small muted row" style="gap:6px">${icon("lock", 14)}Only you can see this page</span>
        </div>
        <div class="row" role="radiogroup" aria-label="Time range" style="gap:6px">
          ${RANGES.map(([k, l]) => `<button class="chip sm" data-range="${k}" role="radio">${l}</button>`).join("")}
        </div>
      </div>
      <div id="an-body" class="stack" style="gap:20px"></div>
    </div>`;
  const body = view.querySelector("#an-body");

  const drawChart = () => {
    const wrap = body.querySelector("#an-chart"); if (!wrap || !data) return;
    const width = Math.floor(wrap.clientWidth) || 600;
    wrap.innerHTML = chartSVG(data.series, data.unit, width) + `<div class="an-tip" hidden></div>`;
    const tip = wrap.querySelector(".an-tip");
    wrap.querySelectorAll(".an-hit").forEach(h => {
      const s = data.series[Number(h.dataset.i)];
      const show = () => {
        tip.hidden = false;
        tip.innerHTML = `<span class="faint">${esc(bucketLabel(s.bucket, data.unit, true))}</span><strong>${fmt(s.views)}</strong> ${s.views === 1 ? "view" : "views"}`;
        const x = Number(h.getAttribute("x")) + Number(h.getAttribute("width")) / 2;
        tip.style.left = Math.min(Math.max(x, 70), width - 70) + "px";
      };
      h.addEventListener("pointerenter", show);
      h.addEventListener("pointerleave", () => { tip.hidden = true; });
    });
  };

  const draw = () => {
    view.querySelectorAll("[data-range]").forEach(b => { const on = b.dataset.range === range; b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-checked", String(on)); });
    if (error) { body.innerHTML = `<div class="card"><p class="error">${esc(error)}</p></div>`; return; }
    if (!data) {
      body.innerHTML = `<div class="an-grid">${STATS.map(() => `<div class="skeleton" style="height:104px;border-radius:14px"></div>`).join("")}</div><div class="skeleton" style="height:300px;border-radius:14px"></div>`;
      return;
    }
    const cur = data.current || {}, prev = data.previous || {};
    const totalViews = data.series.reduce((a, s) => a + s.views, 0);
    const b = data.breakdown;
    const types = b ? Object.entries(b.accountTypes || {}) : [];
    const typesTotal = types.reduce((a, [, n]) => a + n, 0);

    body.innerHTML = `
      <div class="an-grid">
        ${STATS.map(([k, l]) => { const d = delta(cur[k], prev[k]); return `
          <div class="card an-stat">
            <span class="small muted">${l}</span>
            <strong class="an-num">${fmt(cur[k])}</strong>
            <span class="small faint">${d.sign > 0 ? "▲ " : d.sign < 0 ? "▼ " : ""}${esc(d.text)} vs. previous period</span>
          </div>`; }).join("")}
      </div>

      <section class="card stack">
        <div class="row" style="justify-content:space-between"><h2 style="font-size:18px">Profile views</h2><span class="small faint">${CAPTION[range]}</span></div>
        <div id="an-chart" class="an-chart"></div>
        ${totalViews ? "" : `<p class="small muted">No profile views in this period yet. A view counts once per person per day, and your own visits don't count.</p>`}
        <details class="small"><summary class="muted" style="cursor:pointer">Show as a table</summary>
          <table class="an-table"><thead><tr><th scope="col">${data.unit === "month" ? "Month" : data.unit === "week" ? "Week of" : "Day"}</th><th scope="col">Views</th></tr></thead>
          <tbody>${data.series.map(s => `<tr><td>${esc(bucketLabel(s.bucket, data.unit, true))}</td><td>${fmt(s.views)}</td></tr>`).join("")}</tbody></table>
        </details>
      </section>

      <div class="cols" style="gap:20px">
        <section class="card stack" style="flex:1 1 300px">
          <h2 style="font-size:18px">Who viewed your profile</h2>
          <p class="small muted">${fmt(cur.viewers)} ${Number(cur.viewers) === 1 ? "person" : "different people"} in this period.</p>
          ${b ? `
            <div class="stack" style="gap:10px">
              ${types.map(([t, n]) => { const pct = Math.round(n / typesTotal * 100); return `
                <div class="stack" style="gap:4px"><div class="row" style="justify-content:space-between"><span>${t === "student" ? "Students" : "Professionals"}</span><span class="small muted">${pct}%</span></div>
                <div class="an-meter"><span style="width:${pct}%"></span></div></div>`; }).join("")}
              ${(b.fields || []).length ? `<p class="small muted">Top fields: ${b.fields.map(f => esc(f.field)).join(", ")}</p>` : ""}
            </div>`
          : `<p class="small faint">A breakdown appears once at least 3 different people have viewed your profile in this period. Names are never shown.</p>`}
        </section>
        <section class="card stack" style="flex:1 1 300px">
          <h2 style="font-size:18px">Your top posts</h2>
          ${(data.topPosts || []).length ? data.topPosts.map(t => `
            <a href="#/post/${esc(t.id)}" class="an-post">
              <span style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.body)}</span>
              <span class="small faint">${fmt(t.likes)} ${t.likes === 1 ? "like" : "likes"} · ${fmt(t.comments)} ${t.comments === 1 ? "comment" : "comments"}${t.communityName ? ` · ${esc(t.communityName)}` : ""}</span>
            </a>`).join("")
          : `<p class="small faint">No likes or comments from others in this period yet.</p>`}
        </section>
      </div>

      <section class="card stack">
        <h2 style="font-size:18px">Career progression</h2>
        <p class="small muted">Built from your experience, education, projects and verified skills.</p>
        <ol class="an-timeline">
          <li><span class="an-dot on"></span><span class="stack" style="gap:2px"><span class="small faint">${esc(new Date(p.createdAt || Date.now()).getFullYear())}</span><strong>Joined Forge</strong><span class="small muted">${esc(p.field || "")}${p.headline ? ` · ${esc(p.headline)}` : ""}</span></span></li>
        </ol>
        <p class="small faint">Experience, education and projects aren't on profiles yet. Your timeline fills in here as you add them.</p>
      </section>

      <section class="card stack an-locked" aria-disabled="true">
        <div class="row" style="justify-content:space-between"><h2 style="font-size:18px">Career benchmark</h2><span class="soon">Soon</span></div>
        <p class="small muted">Pick a target role and see how your skills compare with Forge's knowledge standard for it and with peers aiming for the same job. This turns on once skill levels have a way to be measured.</p>
      </section>`;
    drawChart();
  };

  const load = async () => {
    const mine = ++seq;
    data = null; error = ""; draw();
    try { const d = await analytics(range); if (mine === seq) { data = d; draw(); } }
    catch (e) { if (mine === seq) { error = friendlyError(e); draw(); } }
  };

  view.querySelectorAll("[data-range]").forEach(b => b.onclick = () => { if (range !== b.dataset.range) { range = b.dataset.range; load(); } });
  if (window.ResizeObserver) {
    let last = 0;
    ro = new ResizeObserver(() => { const w = body.clientWidth; if (Math.abs(w - last) > 8) { last = w; drawChart(); } });
    ro.observe(body);
  }
  load();
  return () => { seq++; if (ro) ro.disconnect(); };
}
