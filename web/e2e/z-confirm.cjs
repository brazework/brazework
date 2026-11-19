// Confirming the email on any device (app/auth/confirm, the code on /verify, supabase/templates/
// confirm-signup.html). Locally sign-ups are confirmed at once, so an unconfirmed account is made with
// Supabase Auth's admin "generate link", which returns exactly what the email would carry: the
// 6-digit code and the link's token hash.
const fs = require("fs");
const path = require("path");
const { step, browser, go, hydrated, summary } = require("./lib.cjs");
const SUPABASE = "http://localhost:54321";
const ANON = fs.readFileSync(path.join(__dirname, ".anon-key"), "utf8").trim();
const SERVICE = fs.readFileSync(path.join(__dirname, ".service-key"), "utf8").trim();

async function unconfirmed(email) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
    body: JSON.stringify({ type: "signup", email, password: "forge-test-pass-1" }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`generate_link ${email}: ${r.status} ${JSON.stringify(j)}`);
  const p = j.properties ?? j;
  if (!/^\d{6}$/.test(p.email_otp || "") || !p.hashed_token) throw new Error(`no code or token hash: ${JSON.stringify(j).slice(0, 200)}`);
  return { code: p.email_otp, hash: p.hashed_token };
}

(async () => {
  const b = await browser();
  const n = Date.now() % 100000;
  const page = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();

  const kai = `kai${n}@gmail.com`;
  const k = await unconfirmed(kai);
  await step("the 6-digit code confirms the email on the 'Check your inbox' page, and a wrong one says so", async () => {
    await go(page, `/verify?email=${encodeURIComponent(kai)}`);
    const box = page.getByLabel("Or enter the 6-digit code from the email");
    await hydrated(box);
    const wrong = k.code === "000000" ? "111111" : "000000";
    await box.fill(wrong);
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.getByText(/wrong or has expired/).waitFor({ timeout: 15000 });
    await box.fill(k.code);
    await page.getByRole("button", { name: "Confirm" }).click();
    await page.waitForURL(/\/onboarding$/, { timeout: 20000 });
    await page.getByRole("heading", { name: "About you" }).waitFor({ timeout: 15000 });
    await page.getByText(`Signed in as ${kai}`).waitFor();
  }, page);
  await page.context().close();

  const lea = `lea${n}@gmail.com`;
  const l = await unconfirmed(lea);
  // A different device: a browser that never saw the sign-up (no cookies at all).
  const phone = await (await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  const link = `/auth/confirm?token_hash=${encodeURIComponent(l.hash)}&type=email&next=/onboarding`;
  await step("the email's link confirms on another device and carries on to About you", async () => {
    await go(phone, link);
    await phone.waitForURL(/\/onboarding$/, { timeout: 20000 });
    await phone.getByRole("heading", { name: "About you" }).waitFor({ timeout: 15000 });
  }, phone);
  await phone.context().close();

  await step("a link used twice says it was used or expired, on log-in", async () => {
    const fresh = await (await b.newContext()).newPage();
    await go(fresh, link);
    await fresh.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("link") === "expired", { timeout: 15000 });
    await fresh.getByText("That link was already used or has expired").waitFor();
    await fresh.context().close();
  });

  const max = `max${n}@gmail.com`;
  await unconfirmed(max);
  await step("logging in before confirming offers to send a new link", async () => {
    const p = await (await b.newContext()).newPage();
    await go(p, "/login");
    await p.fill('input[name="email"]', max); await p.fill('input[name="password"]', "forge-test-pass-1");
    await p.locator('button[type="submit"]').click();
    await p.getByText(/Confirm your email first/).waitFor({ timeout: 15000 });
    await p.getByRole("button", { name: "Send a new link" }).waitFor();
    if (new URL(p.url()).pathname !== "/login") throw new Error(`moved to ${p.url()}`);
    await p.context().close();
  });

  // Log in with a code instead of a password, then come back to a page that remembers how.
  const ana = `ana${n}@gmail.com`;
  {
    const r = await fetch(`${SUPABASE}/auth/v1/admin/users`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" }, body: JSON.stringify({ email: ana, password: "forge-test-pass-1", email_confirm: true }) });
    if (!r.ok) throw new Error(`creating ${ana}: ${r.status}`);
  }
  const codeCtx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const cp = await codeCtx.newPage();
  await step("log in with an emailed 6-digit code instead of a password", async () => {
    await go(cp, "/login");
    await cp.getByRole("button", { name: "Email me a sign-in code instead" }).click();
    await cp.fill('input[name="email"]', ana);
    await cp.getByRole("button", { name: "Email me a code" }).click();
    await cp.getByLabel("6-digit code").waitFor({ timeout: 15000 });
    await cp.getByText(`If an account uses ${ana}`).waitFor();
    // The code the email carries (locally there's no mail server, so ask Supabase for it).
    const r = await fetch(`${SUPABASE}/auth/v1/admin/generate_link`, { method: "POST", headers: { apikey: ANON, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" }, body: JSON.stringify({ type: "magiclink", email: ana }) });
    const j = await r.json(); const otp = (j.properties ?? j).email_otp;
    if (!/^\d{6}$/.test(otp || "")) throw new Error(`no code: ${JSON.stringify(j).slice(0, 160)}`);
    await cp.getByLabel("6-digit code").fill(otp === "000000" ? "111111" : "000000");
    await cp.getByRole("button", { name: "Log in", exact: true }).click();
    await cp.getByText(/wrong or has expired/).waitFor({ timeout: 15000 });
    await cp.getByLabel("6-digit code").fill(otp);
    await Promise.all([cp.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }), cp.getByRole("button", { name: "Log in", exact: true }).click()]);
  }, cp);
  await step("back on log-in, the page remembers the email and the code method ('Last used')", async () => {
    await codeCtx.clearCookies();
    await go(cp, "/login");
    await cp.getByRole("button", { name: /Email me a code/ }).getByText("Last used").waitFor({ timeout: 10000 });
    if ((await cp.locator('input[name="email"]').inputValue()) !== ana) throw new Error("email not remembered");
    await cp.getByRole("button", { name: "Use a different account" }).click();
    if ((await cp.locator('input[name="email"]').inputValue()) !== "") throw new Error("email not forgotten");
    await cp.locator("#login-password").waitFor();
  }, cp);
  await codeCtx.close();

  await step("asking for a code for an address with no account says the same as for one (no account lookup)", async () => {
    const p = await (await b.newContext()).newPage();
    await go(p, "/login");
    await p.getByRole("button", { name: "Email me a sign-in code instead" }).click();
    await p.fill('input[name="email"]', `nobody${n}@gmail.com`);
    await p.getByRole("button", { name: "Email me a code" }).click();
    await p.getByText(`If an account uses nobody${n}@gmail.com`).waitFor({ timeout: 15000 });
    await p.context().close();
  });

  await step("from a club invite, log-in says so", async () => {
    const p = await (await b.newContext()).newPage();
    await go(p, "/login?next=%2Fjoin%2F0123456789abcdef");
    await p.getByRole("heading", { name: "Log in to join the club" }).waitFor();
    await p.context().close();
  });

  await step("the sign-up page links the privacy page and says what comes next", async () => {
    const p = await (await b.newContext()).newPage();
    await go(p, "/signup");
    await p.getByText("Next: a confirmation email").waitFor();
    if ((await p.getByRole("link", { name: "How we handle your data" }).getAttribute("href")) !== "/privacy") throw new Error("no privacy link");
    await p.context().close();
  });

  summary();
  await b.close();
})();
