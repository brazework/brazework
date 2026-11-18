// Sign-in with Google, GitHub or LinkedIn (supabase/oauth-signup.sql, app/auth/oauth, app/auth/callback,
// app/onboarding). The local stack has GitHub switched on with a stand-in app (e2e/local-supabase.sh), so:
// the button shows and sends the browser to GitHub with the right app and return address (stopped there:
// nothing leaves this machine); a refused sign-in comes back with a plain message; and a newcomer who
// arrived through a provider (made here the way Supabase makes one: a verified email and the provider's
// profile, no sign-up details) finishes signing up in onboarding under the email form's rules.
const fs = require("fs");
const path = require("path");
const { BASE, step, browser, as, go, hydrated, summary } = require("./lib.cjs");
const SUPABASE = "http://localhost:54321";
const ANON = fs.readFileSync(path.join(__dirname, ".anon-key"), "utf8").trim();
const SERVICE = fs.readFileSync(path.join(__dirname, ".service-key"), "utf8").trim();

// A member new through GitHub, as Supabase Auth leaves them: no profile, a confirmed email. A password
// too, only so the test can sign in as them without a real GitHub round trip.
async function providerNewcomer(email, name) {
  const r = await fetch(`${SUPABASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: ANON, authorization: `Bearer ${SERVICE}`, "content-type": "application/json" },
    body: JSON.stringify({ email, password: "forge-test-pass-1", email_confirm: true, user_metadata: { full_name: name, user_name: "octo", email, email_verified: true }, app_metadata: { provider: "github", providers: ["github"] } }),
  });
  if (!r.ok) throw new Error(`creating ${email}: ${r.status} ${await r.text()}`);
}

(async () => {
  const b = await browser();
  const n = Date.now() % 100000;

  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await step("sign-up and log-in offer the providers switched on in Supabase (GitHub here), not the others", async () => {
    for (const p of ["/signup", "/login"]) {
      await go(page, p);
      await page.getByRole("link", { name: "Continue with GitHub" }).waitFor({ timeout: 15000 });
      if (await page.getByRole("link", { name: /Continue with (Google|LinkedIn)/ }).count()) throw new Error(`${p} shows a provider that isn't on`);
      await page.getByText("or with your email").waitFor();
    }
  }, page);

  // Followed hop by hop over HTTP, so nothing ever reaches GitHub (a browser can't be stopped mid-redirect).
  await step("Continue with GitHub goes to GitHub with Brazework's app, coming back through Supabase", async () => {
    await go(page, "/signup");
    const href = await page.getByRole("link", { name: "Continue with GitHub" }).getAttribute("href");
    if (href !== "/auth/oauth?provider=github&from=signup") throw new Error(`button links to ${href}`);
    // From a club invite link the button carries the code (SignupForm); the start keeps it in a cookie.
    const start = await fetch(`${BASE}${href}&invite=0123456789abcdef`, { redirect: "manual" });
    const toSupabase = new URL(start.headers.get("location") || "");
    if (start.status !== 303 || toSupabase.origin + toSupabase.pathname !== `${SUPABASE}/auth/v1/authorize`) throw new Error(`start went to ${toSupabase} (${start.status})`);
    if (toSupabase.searchParams.get("provider") !== "github" || !toSupabase.searchParams.get("code_challenge")) throw new Error("not a PKCE GitHub sign-in");
    const back = new URL(toSupabase.searchParams.get("redirect_to") || "");
    if (back.origin + back.pathname !== `${BASE}/auth/callback` || back.searchParams.get("flow") !== "oauth" || back.searchParams.get("from") !== "signup") throw new Error(`comes back to ${back}`);
    const cookies = start.headers.getSetCookie();
    if (!cookies.some((c) => /-code-verifier=/.test(c))) throw new Error("no PKCE verifier cookie on the site, so the return couldn't finish");
    if (!cookies.some((c) => c.startsWith("forge_invite=0123456789abcdef"))) throw new Error("the club invite wasn't kept through the provider");
    const atSupabase = await fetch(toSupabase, { redirect: "manual" });
    const gh = new URL(atSupabase.headers.get("location") || "");
    if (gh.origin + gh.pathname !== "https://github.com/login/oauth/authorize") throw new Error(`Supabase sent it to ${gh.origin}${gh.pathname}`);
    if (gh.searchParams.get("client_id") !== "brazework-e2e") throw new Error(`client_id ${gh.searchParams.get("client_id")}`);
    if (gh.searchParams.get("redirect_uri") !== `${SUPABASE}/auth/v1/callback`) throw new Error(`redirect_uri ${gh.searchParams.get("redirect_uri")}`);
    if (!/user:email/.test(gh.searchParams.get("scope") || "")) throw new Error(`scope ${gh.searchParams.get("scope")}`);
  }, page);

  await step("a sign-in refused at the provider comes back to where it started, with a plain message", async () => {
    await go(page, "/auth/callback?flow=oauth&from=signup&error=access_denied&error_description=The+user+denied+the+request");
    await page.waitForURL((u) => u.pathname === "/signup" && u.searchParams.get("oauth") === "cancelled", { timeout: 15000 });
    await page.getByText("Sign-in was cancelled").waitFor({ timeout: 10000 });
    await go(page, "/auth/callback?flow=oauth&from=login&code=not-a-real-code");
    await page.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("oauth") === "expired", { timeout: 15000 });
    await page.getByText("That sign-in expired").waitFor({ timeout: 10000 });
    await go(page, "/auth/oauth?provider=myspace");
    await page.waitForURL((u) => u.pathname === "/login" && u.searchParams.get("oauth") === "unavailable", { timeout: 15000 });
  }, page);
  await ctx.close();

  // A newcomer with a personal email: can't be a student, must be 18, then onboarding as usual.
  const ola = `ola${n}@gmail.com`;
  await providerNewcomer(ola, "Ola Ade");
  const p = await as(b, ola);
  await step("a provider newcomer lands on 'Finish creating your account', names filled in from GitHub", async () => {
    await go(p, "/feed");
    await p.waitForURL(/\/onboarding$/, { timeout: 15000 });
    await p.getByRole("heading", { name: "Finish creating your account" }).waitFor({ timeout: 15000 });
    await p.getByText(`Signed in with GitHub as ${ola}`).waitFor();
    if ((await p.locator('input[name="firstName"]').inputValue()) !== "Ola" || (await p.locator('input[name="lastName"]').inputValue()) !== "Ade") throw new Error("names not prefilled");
  }, p);
  await step("the app is closed until they finish (every app page sends them back)", async () => {
    for (const where of ["/feed", "/communities", "/u/" + "00000000-0000-0000-0000-000000000000"]) {
      await go(p, where);
      await p.waitForURL(/\/onboarding$/, { timeout: 15000 });
    }
  }, p);
  await step("a student account needs a university email, here as on the email form", async () => {
    await hydrated(p.getByRole("button", { name: /Student/ }));
    await p.getByRole("button", { name: /Student/ }).click();
    await p.fill('input[name="birthday"]', "2003-05-01");
    await p.getByRole("button", { name: "Continue" }).click();
    await p.getByText(/Use your university email/).waitFor({ timeout: 15000 });
    await p.locator("#request-school").waitFor();
  }, p);
  await step("and everyone must be 18", async () => {
    await p.getByRole("button", { name: /Professional/ }).click();
    const young = new Date(Date.now() - 16 * 365.25 * 864e5).toISOString().slice(0, 10);
    await p.fill('input[name="birthday"]', young);
    await p.getByRole("button", { name: "Continue" }).click();
    await p.getByText(/at least 18/).waitFor({ timeout: 15000 });
  }, p);
  await step("a professional finishes sign-up, then onboarding, then lands on the feed", async () => {
    await p.fill('input[name="birthday"]', "1994-03-03");
    await p.getByRole("button", { name: "Continue" }).click();
    await p.getByRole("heading", { name: /What do you build/ }).waitFor({ timeout: 20000 });
    await p.fill('input[name="headline"]', "Firmware engineer");
    await Promise.all([p.waitForURL((u) => u.pathname === "/feed", { timeout: 30000 }), p.getByRole("button", { name: "Enter Brazework" }).click()]);
  }, p);
  await p.context().close();

  await step("next time, the same member goes straight in", async () => {
    const again = await as(b, ola);
    await go(again, "/feed");
    if (new URL(again.url()).pathname !== "/feed") throw new Error(`landed on ${again.url()}`);
    await again.context().close();
  });

  // A student whose provider account is their school email.
  const kim = `kim${n}@forge.test`;
  await providerNewcomer(kim, "Kim Lee");
  const k = await as(b, kim);
  await step("a newcomer with a school email finishes as a student and goes on to find their club", async () => {
    await go(k, "/onboarding");
    await hydrated(k.getByRole("button", { name: /Student/ }));
    await k.getByRole("button", { name: /Student/ }).click();
    await k.fill('input[name="birthday"]', "2004-09-09");
    await k.getByRole("button", { name: "Continue" }).click();
    await k.getByRole("heading", { name: /What do you build/ }).waitFor({ timeout: 20000 });
    await k.fill('input[name="headline"]', "Electrical Engineering, sophomore");
    await Promise.all([k.waitForURL(/\/onboarding\/club/, { timeout: 30000 }), k.getByRole("button", { name: "Enter Brazework" }).click()]);
  }, k);

  summary();
  await b.close();
})();
