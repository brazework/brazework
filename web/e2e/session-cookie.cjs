// Logs in as a seeded member and writes the session as a Cookie header, so Lighthouse can measure
// logged-in pages the way a member sees them. Run against the local stack only (e2e/serve.sh).
const fs = require("fs");
const path = require("path");
const { browser, as } = require("./lib.cjs");
(async () => {
  const b = await browser();
  const page = await as(b, process.argv[2] || "josh@forge.test");
  const cookies = await page.context().cookies("http://localhost:3200");
  const out = path.join(__dirname, ".results", "lh-cookie.txt");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, cookies.map((c) => `${c.name}=${c.value}`).join("; "));
  console.log(`session saved (${cookies.length} cookies)`);
  await b.close();
})().catch((e) => { console.error(e.message); process.exit(1); });
