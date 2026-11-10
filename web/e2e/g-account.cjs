// Your data: download everything, then delete the account (and it's really gone).
const fs = require("fs");
const { BASE, step, browser, as, go, summary } = require("./lib.cjs");
(async () => {
  const K = fs.readFileSync(`${__dirname}/.anon-key`, "utf8").trim();
  const email = `leaving${Date.now() % 100000}@mit.edu`;
  // A fresh member (the local stack confirms emails at once), onboarded.
  const r = await fetch("http://localhost:54321/auth/v1/signup", { method: "POST", headers: { apikey: K, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "forge-test-pass-1", data: { firstName: "Lee", lastName: "Leaving", birthday: "2004-01-01", accountType: "student" } }) });
  const j = await r.json();
  await fetch(`http://localhost:54321/rest/v1/profiles?id=eq.${j.user.id}`, { method: "PATCH", headers: { apikey: K, authorization: `Bearer ${j.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ headline: "Mechanical engineering", field: "Engineering", interests: ["Aerospace", "Mechanical Design", "Embedded Systems"], onboarded: true }) });
  const stamp = Date.now() % 100000;
  await fetch(`http://localhost:54321/rest/v1/posts`, { method: "POST", headers: { apikey: K, authorization: `Bearer ${j.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ body: `Leaving soon ${stamp}`, kind: "update" }) });

  const b = await browser();
  const me = await as(b, email);
  await step("Download my data has your posts", async () => {
    const res = await me.request.get(`${BASE}/api/export`);
    if (!res.ok()) throw new Error(`export ${res.status()}`);
    if (!/attachment; filename="forge-export-/.test(res.headers()["content-disposition"] ?? "")) throw new Error("not a download");
    const data = await res.json();
    if (data.account?.email !== email) throw new Error("wrong account");
    if (!data.posts?.some((p) => p.body === `Leaving soon ${stamp}`)) throw new Error("post missing from export");
  }, me);
  await step("delete needs DELETE typed, then deletes the account", async () => {
    await go(me, "/settings#data");
    const btn = me.getByRole("button", { name: "Delete my account" });
    if (await btn.isEnabled()) throw new Error("delete should be disabled until DELETE is typed");
    await me.fill("#delete-confirm", "DELETE");
    await btn.click();
    await me.waitForURL((u) => u.pathname === "/", { timeout: 20000 });
  }, me);
  await step("the account is gone: logging in fails", async () => {
    const t = await fetch("http://localhost:54321/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: K, "content-type": "application/json" }, body: JSON.stringify({ email, password: "forge-test-pass-1" }) });
    if (t.ok) throw new Error("login still works");
  }, me);
  console.log("page errors:", me.errs.slice(0, 3));
  summary(); await b.close();
})();
