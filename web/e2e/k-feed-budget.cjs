// The feed's budget, enforced (Linear FIX-77). Seeds 40 more posts (photos at a phone photo's real
// size, two 7 MB videos with posters), opens Home on an iPhone-sized, 3x screen and scrolls. Fails if:
// - the first page (HTML and its data) plus the photos above the fold is over 300 KB
// - any video byte loads before a tap, or a tapped video downloads whole instead of streaming
// - a page of posts costs more than 2 Supabase requests, or anything asks per post (likes, saves,
//   replies, projects, posts)
// - the page keeps every card it has scrolled past (the list must stay virtualized)
// - coming back to Home asks for the pages again (they're cached)
// Supabase requests are counted at the local gateway (GW_LOG, set by run.sh).
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { execSync } = require("child_process");
const { step, browser, as, go, summary } = require("./lib.cjs");
const LOG = process.env.GW_LOG;
const MEDIA = process.env.E2E_MEDIA_DIR || path.join(__dirname, ".media");
const psql = (sql) => execSync("docker exec -i forge-e2e-db psql -U postgres -h localhost -d postgres -v ON_ERROR_STOP=1 -qtA", { input: sql }).toString().trim();
const gw = () => (LOG && fs.existsSync(LOG) ? fs.readFileSync(LOG, "utf8").split("\n").filter(Boolean).map((l) => { const [t, , m, p, bytes, who] = l.split("\t"); return { t: +t, m, p, bytes: +bytes || 0, who }; }) : []);
const KB = 1024;

(async () => {
  // A phone-sized photo (1600x1200 WebP with real-world detail) and a padded 7 MB clip with a poster.
  const sharp = require("sharp");
  const noise = Buffer.alloc(1600 * 1200 * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 2654435761 >>> 24) ^ ((i / 4800) & 255);
  const photo = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } }).blur(1.2).webp({ quality: 80 }).toBuffer();
  const poster = await sharp(noise, { raw: { width: 1600, height: 1200, channels: 3 } }).resize(960, 540).webp({ quality: 80 }).toBuffer();
  const clip = fs.readFileSync(path.join(__dirname, "fixtures", "test-run.mp4"));
  const pad = Buffer.alloc(7 * 1024 * 1024 - clip.length); pad.writeUInt32BE(pad.length, 0); pad.write("free", 4);
  const video = Buffer.concat([clip, pad]);
  const lq = `data:image/webp;base64,${(await sharp(photo).resize(16, 12).webp({ quality: 40 }).toBuffer()).toString("base64")}`;
  const authors = psql("select id from auth.users where email in ('josh@forge.test','maya@forge.test','cara@forge.test') order by email").split("\n");
  const put = (rel, buf) => { fs.mkdirSync(path.dirname(path.join(MEDIA, rel)), { recursive: true }); fs.writeFileSync(path.join(MEDIA, rel), buf); };
  const rows = [];
  for (let i = 0; i < 40; i++) {
    const a = authors[i % 3];
    let media = [];
    if (i === 5 || i === 21) {
      const v = `${a}/${crypto.randomUUID()}.mp4`, p = `${a}/${crypto.randomUUID()}.webp`;
      put(v, video); put(p, poster);
      media = [{ type: "video", path: v, w: 1280, h: 720, bytes: video.length, poster: p, lq }];
    } else if (i % 3 === 0) {
      const f = `${a}/${crypto.randomUUID()}.webp`;
      put(f, photo);
      media = [{ type: "image", path: f, w: 1600, h: 1200, bytes: photo.length, alt: "Test stand", lq }];
    }
    rows.push(`('${a}', 'Budget post ${i + 1}: notes from the bench.', 'update', '{}', '${JSON.stringify(media)}'::jsonb, now() - interval '${(i + 1) * 3} minutes')`);
  }
  psql(`insert into public.posts (author_id, body, kind, tags, media, created_at) values ${rows.join(",")};`);

  const b = await browser();
  const page = await as(b, "ben@forge.test", { width: 390, height: 844 }, { deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const net = [];
  // A streamed video's request never "finishes", so media is recorded as its response arrives.
  page.on("response", (res) => { if (/\.(mp4|mov|webm)(\?|$)/.test(res.url())) net.push({ url: res.url(), type: "media", bytes: 0, status: res.status(), range: res.request().headers().range ?? "" }); });
  page.on("requestfinished", async (r) => { const s = await r.sizes().catch(() => null); const res = await r.response().catch(() => null); net.push({ at: Date.now(), url: r.url(), type: r.resourceType(), bytes: s ? s.responseBodySize + s.responseHeadersSize : 0, status: res?.status() ?? 0, range: r.headers().range ?? "" }); });

  let firstBytes = 0, gwMark = 0;
  await step("the first page and the photos above the fold are under 300 KB", async () => {
    net.length = 0;
    await go(page, "/feed?tab=latest");
    await page.locator("article").first().waitFor({ timeout: 20000 });
    await page.waitForLoadState("networkidle");
    const doc = net.filter((n) => n.type === "document" || (n.type === "fetch" && /\/feed/.test(n.url) && !/feed_page/.test(n.url)));
    const imgs = net.filter((n) => n.type === "image" && n.url.includes("/_next/image"));
    firstBytes = [...doc, ...imgs].reduce((s, n) => s + n.bytes, 0);
    console.log(`  first page: ${Math.round(doc.reduce((s, n) => s + n.bytes, 0) / KB)} KB HTML+data, ${imgs.length} photos ${Math.round(imgs.reduce((s, n) => s + n.bytes, 0) / KB)} KB`);
    if (firstBytes > 300 * KB) throw new Error(`first page is ${Math.round(firstBytes / KB)} KB`);
  }, page);

  await step("no video bytes before a tap: feed videos show a poster and preload nothing", async () => {
    const vids = net.filter((n) => /\.(mp4|mov|webm)(\?|$)/.test(n.url));
    if (vids.length) throw new Error(`video requested before a tap: ${vids.map((v) => v.url.split("/").pop()).join(", ")}`);
  }, page);

  await step("scrolling 30 posts: one Supabase request per page of 12, nothing per post, and the page stays small", async () => {
    gwMark = gw().length;
    const netMark = net.length;
    let maxArticles = 0;
    for (let i = 0; i < 60; i++) {
      await page.mouse.wheel(0, 650);
      await page.waitForTimeout(120);
      maxArticles = Math.max(maxArticles, await page.locator("article").count());
      if (await page.getByText("Budget post 30:").count()) break;
    }
    await page.getByText("Budget post 30:").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const during = gw().slice(gwMark);
    // Pages are the POSTs (a browser may also send one CORS preflight, which it then caches).
    const pages = during.filter((g) => g.p === "/rest/v1/rpc/feed_page" && g.m === "POST").length;
    const perPost = during.filter((g) => /^\/rest\/v1\/(posts|likes|saved|comments|projects|project_details|milestones|profiles)$/.test(g.p));
    const rest = during.filter((g) => g.p.startsWith("/rest/v1") || g.p.startsWith("/auth/v1"));
    const app = net.slice(netMark).filter((n) => n.url.startsWith("http://localhost:3200") && !n.url.includes("/_next/image") && !n.url.includes("/_next/static"));
    if (process.env.DEBUG_FEED || during.some((g) => g.p.startsWith("/auth"))) {
      console.log("  app requests while scrolling:", net.slice(netMark).filter((n) => !n.url.includes("/_next/static")).map((n) => `${n.at} ${n.type} ${n.url.replace("http://localhost:3200", "").slice(0, 90)}`));
      console.log("  gateway while scrolling:", during.filter((g) => g.p.startsWith("/auth")).map((g) => `${g.t} ${g.who} ${g.m} ${g.p}`));
    }
    const tally = {};
    for (const g of rest) tally[`${g.who} ${g.m} ${g.p}`] = (tally[`${g.who} ${g.m} ${g.p}`] || 0) + 1;
    console.log(`  ${pages} pages loaded with ${rest.length} Supabase API requests; at most ${maxArticles} cards in the page`, JSON.stringify(tally));
    if (pages < 2) throw new Error(`expected at least 2 more pages, saw ${pages}`);
    if (perPost.length) throw new Error(`per-post or extra queries while scrolling: ${[...new Set(perPost.map((g) => g.p))].join(", ")}`);
    if (rest.length > pages * 2) throw new Error(`${rest.length} Supabase requests for ${pages} pages (budget: 2 per page)`);
    if (maxArticles > 16) throw new Error(`${maxArticles} cards in the page at once (should stay virtualized)`);
  }, page);

  await step("a tapped video streams (range requests), it doesn't download whole first", async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const v = page.locator("video").first();
    for (let i = 0; i < 40 && !(await v.count()); i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(150); }
    // Bring it to the middle of the screen by script (the virtual list moves cards as it measures them).
    await v.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(600);
    const box = await v.boundingBox();
    if (!box) throw new Error("no video on screen");
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => [...document.querySelectorAll("video")].some((x) => !x.paused && x.currentTime > 0), null, { timeout: 15000 });
    const vids = net.filter((n) => n.type === "media");
    if (!vids.length) throw new Error("the tapped video never loaded");
    if (!vids.every((x) => x.status === 206)) throw new Error(`video answered ${vids.map((x) => x.status).join(",")} (expected 206 partial content)`);
  }, page);

  await step("back to Home reuses the cached pages (no new feed request)", async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const mark = gw().length;
    const link = page.locator("article a[href^='/post/'], article a[href^='/u/']").first();
    await link.click();
    await page.waitForURL((u) => !u.pathname.startsWith("/feed"), { timeout: 15000 });
    await page.goBack();
    await page.waitForURL(/\/feed/, { timeout: 15000 });
    await page.locator("article").first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(1500);
    const again = gw().slice(mark).filter((g) => g.p === "/rest/v1/rpc/feed_page" && g.who === "browser");
    if (again.length) throw new Error(`${again.length} feed pages fetched again after coming back`);
  }, page);

  if (page.errs.length) console.log("page errors:", page.errs.slice(0, 3));
  summary();
  await b.close();
})();
