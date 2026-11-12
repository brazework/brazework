// Layout, checked (Linear FIX-87). Opens the key pages at iPhone and laptop size and fails if:
// - the page scrolls sideways, or something sticks out past the screen's edge (a carousel or a
//   table that scrolls inside its own box is fine)
// - a bar that should be one row wraps (the landing header, the app's top and bottom bars on a phone)
// - on a phone, a button is too small to tap: under 24x24 CSS px with another target within reach
//   (WCAG 2.2, 2.5.8 target size, with its spacing exception; a checkbox counts its label)
// Rules rather than pixel diffs: they pass or fail the same on a Mac and on CI's Linux, whatever the
// fonts, timestamps or animation frame. Every page is also screenshotted to e2e/.results/layout/,
// which CI keeps for each run, so a person can look at what changed.
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
const SHOTS = path.join(__dirname, ".results", "layout");
fs.mkdirSync(SHOTS, { recursive: true });

const VIEWPORTS = [
  ["iphone", { width: 390, height: 844 }, { deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
  ["laptop", { width: 1440, height: 900 }, {}],
];
const ben = process.env.BEN_ID || execSync("docker exec forge-e2e-db psql -U postgres -h localhost -d postgres -tAc \"select id from auth.users where email='ben@forge.test'\"").toString().trim();
const SIGNED_OUT = [["landing", "/"], ["login", "/login"], ["signup", "/signup"]];
const SIGNED_IN = [["home", "/feed"], ["project", "/projects/p1"], ["club", "/c/rkt"], ["profile", `/u/${ben}`], ["clubs", "/communities"],
  ["projects", "/projects"], ["events", "/events"], ["messages", "/messages"], ["notifications", "/notifications"], ["settings", "/settings"], ["tools", "/settings/tools"]];
// Bars that must stay one row, and how tall one row is at most (padding and the safe area included).
const BARS = [['header > nav[aria-label="Main"]', 72, "the landing header"], ["header.glass.fixed.top-0", 72, "the app's top bar"], ['nav[aria-label="Main"].fixed', 96, "the app's tab bar"]];

// Runs in the page: what sticks out, which bars wrapped, which buttons are too small.
function inspect({ bars, phone }) {
  const W = document.documentElement.clientWidth;
  const shown = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0 && r.width > 0 && r.height > 0; };
  // Inside a box that clips or scrolls sideways (a carousel, a code block): its own business.
  const contained = (el) => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if (o !== "visible") return true; } return false; };
  const name = (el) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40) || el.tagName.toLowerCase();
  const where = (el) => `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${name(el)}"`;

  const sideways = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - W;
  const out = [];
  for (const el of document.body.querySelectorAll("*")) {
    if (out.length >= 5) break;
    const r = el.getBoundingClientRect();
    if ((r.right > W + 1 || r.left < -1) && r.width > 0 && shown(el) && !contained(el) && getComputedStyle(el).position !== "fixed") out.push(`${where(el)} spans ${Math.round(r.left)}..${Math.round(r.right)}px of ${W}`);
  }
  const wrapped = [];
  for (const [sel, max, label] of bars) for (const el of document.querySelectorAll(sel)) if (shown(el) && el.getBoundingClientRect().height > max) wrapped.push(`${label} is ${Math.round(el.getBoundingClientRect().height)}px tall (one row is at most ${max})`);
  // WCAG 2.5.8: a target is at least 24x24, or has room around it (a 24px circle on its centre
  // touches no other target). A checkbox's target includes its label: tapping the label toggles it.
  const small = [];
  if (phone) {
    const targets = [...document.querySelectorAll('button, [role="button"], [role="tab"], a[class*="inline-flex"], a[class*="grid"], input[type="checkbox"], input[type="radio"], [role="switch"]')]
      .filter((el) => shown(el) && !el.closest("[aria-hidden=true], .sr-only"))
      .map((el) => {
        const rs = [el.getBoundingClientRect(), ...[...(el.labels || [])].filter(shown).map((l) => l.getBoundingClientRect())];
        const box = { left: Math.min(...rs.map((r) => r.left)), top: Math.min(...rs.map((r) => r.top)), right: Math.max(...rs.map((r) => r.right)), bottom: Math.max(...rs.map((r) => r.bottom)) };
        return { el, box, w: box.right - box.left, h: box.bottom - box.top };
      });
    const near = (t, o) => { // distance from t's centre to o's box, under 12px = the circle touches it
      const cx = (t.box.left + t.box.right) / 2, cy = (t.box.top + t.box.bottom) / 2;
      const dx = Math.max(o.box.left - cx, 0, cx - o.box.right), dy = Math.max(o.box.top - cy, 0, cy - o.box.bottom);
      return Math.hypot(dx, dy) < 12;
    };
    for (const t of targets) {
      if (t.w >= 24 && t.h >= 24) continue;
      const crowded = targets.find((o) => o !== t && !o.el.contains(t.el) && !t.el.contains(o.el) && near(t, o));
      if (crowded) small.push(`${where(t.el)} is ${Math.round(t.w)}x${Math.round(t.h)}, too close to ${where(crowded.el)}`);
    }
  }
  return { sideways, out, wrapped, small: [...new Set(small)] };
}

async function check(page, vp, name) {
  await page.waitForTimeout(800); // entrance animations settle
  await page.screenshot({ path: path.join(SHOTS, `${vp}-${name}.png`) });
  const r = await page.evaluate(inspect, { bars: BARS, phone: vp === "iphone" });
  const problems = [
    ...(r.sideways > 1 ? [`the page scrolls sideways by ${r.sideways}px`] : []),
    ...r.out.map((s) => `sticks out: ${s}`),
    ...r.wrapped,
    ...r.small.slice(0, 5).map((s) => `too small to tap: ${s}`),
  ];
  if (problems.length) throw new Error(`${name} on ${vp}: ${problems.join("; ")}`);
}

(async () => {
  const b = await browser();
  // The browser tab shows the Brazework logo, not a blank globe: setting metadata.icons by hand once
  // dropped the tab icon's <link> entirely, and /favicon.ico was a 404.
  await step("the tab shows the Brazework logo: pages link icon.svg, and /favicon.ico answers", async () => {
    const html = await (await fetch(BASE + "/login")).text();
    const icon = html.match(/<link[^>]*rel="icon"[^>]*href="([^"]+)"/)?.[1];
    if (!icon) throw new Error("no <link rel=\"icon\"> in the page");
    const svg = await fetch(BASE + icon);
    if (!svg.ok || !/svg/.test(svg.headers.get("content-type") || "")) throw new Error(`${icon}: ${svg.status} ${svg.headers.get("content-type")}`);
    if (!/<link[^>]*rel="apple-touch-icon"/.test(html)) throw new Error("no apple-touch-icon (Home Screen)");
    const ico = await fetch(BASE + "/favicon.ico");
    const bytes = Buffer.from(await ico.arrayBuffer());
    if (!ico.ok || bytes.readUInt16LE(2) !== 1) throw new Error(`/favicon.ico: ${ico.status}, not an icon`);
  });
  for (const [vp, size, opts] of VIEWPORTS) {
    const anon = await (await b.newContext({ viewport: size, ...opts, colorScheme: "light" })).newPage();
    for (const [name, p] of SIGNED_OUT) {
      await step(`layout: ${name} on ${vp}`, async () => { await anon.goto(BASE + p, { waitUntil: "networkidle" }); await check(anon, vp, name); }, anon);
    }
    await anon.context().close();
    const page = await as(b, "ben@forge.test", size, { ...opts, colorScheme: "light" });
    for (const [name, p] of SIGNED_IN) {
      await step(`layout: ${name} on ${vp}`, async () => { await go(page, p); await check(page, vp, name); }, page);
    }
    await page.context().close();
  }
  await b.close();
  summary();
})();
