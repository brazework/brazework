// Demo content for LOCAL development and demos only (Formula SAE, rocketry, NSBE examples).
// Refuses to run unless FORGE_DEMO_SEED=1 and the target is the local test stack, so it can never
// write example content into production.
//
//   cd web && e2e/local-supabase.sh up && FORGE_DEMO_SEED=1 node scripts/seed-demo.cjs
const fs = require("fs");
const URL_ = process.env.FORGE_SUPABASE_URL || "http://localhost:54321";
if (process.env.FORGE_DEMO_SEED !== "1") { console.error("Set FORGE_DEMO_SEED=1 to seed demo content (local only)."); process.exit(1); }
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(URL_)) { console.error(`Refusing: ${URL_} is not the local stack.`); process.exit(1); }
const K = fs.readFileSync(`${__dirname}/../e2e/.anon-key`, "utf8").trim();
const H = (t) => ({ apikey: K, authorization: `Bearer ${t}`, "content-type": "application/json", prefer: "return=representation" });

async function as(email) {
  const r = await fetch(`${URL_}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: K, "content-type": "application/json" }, body: JSON.stringify({ email, password: "forge-test-pass-1" }) });
  const j = await r.json(); if (!j.access_token) throw new Error(`sign-in ${email}: ${JSON.stringify(j)}`); return { t: j.access_token, id: j.user.id };
}
async function rest(u, path, body, method = "POST") {
  const r = await fetch(`${URL_}/rest/v1/${path}`, { method, headers: H(u.t), body: JSON.stringify(body) });
  const text = await r.text(); if (!r.ok) throw new Error(`${path}: ${text}`); return text ? JSON.parse(text) : null;
}

(async () => {
  const [josh, maya, ben, cara] = await Promise.all(["josh", "maya", "ben", "cara"].map((n) => as(`${n}@forge.test`)));
  const post = async (u, body, kind, extra = {}) => (await rest(u, "posts", { body, kind, tags: [], ...extra }))[0];
  const a = await post(cara, "Our truss bridge held 45 kg on a 1.2 m span before buckling at the second panel. Load curve and photos in the write-up.", "result");
  const b = await post(maya, "Flight computer now logs IMU + baro at 200 Hz to SD without dropping frames. Double-buffering the writes did it.", "result");
  const c = await post(ben, "How do you check motor casing concentricity before a static fire? Our dial indicator setup feels sketchy.", "question");
  await post(josh, "Shout out to @Maya Patel for walking me through Kalman filters this week. Finally clicked.", "update", { mentions: [{ id: maya.id, name: "Maya Patel" }] });
  await post(ben, "Rocketry Club is recruiting for the spring launch: avionics, recovery and propulsion. No experience needed, come Thursday.", "update", { community_id: "rkt" });
  await rest(josh, "comments", { post_id: b.id, body: "200 Hz is great. Which SD card?" });
  await rest(maya, "comments", { post_id: b.id, body: "SanDisk Industrial 8 GB. Cheap cards stall on write." });
  await rest(cara, "comments", { post_id: c.id, body: "V-blocks and an indicator along the full length; under 0.05 mm runout is our pass." });
  for (const [u, p] of [[josh, a], [ben, a], [josh, b], [cara, b], [ben, b]]) await rest(u, "likes", { post_id: p.id }).catch(() => {});
  console.log("Seeded demo content (local only).");
})().catch((e) => { console.error(e.message); process.exit(1); });
