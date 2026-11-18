// Sign-in with Google, GitHub and LinkedIn: the parts that decide things (lib/oauth.ts). The round
// trip itself needs the real providers; e2e/y-oauth.cjs covers what the local stack can.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { PROVIDERS, callbackUrl, enabledFrom, fromPage, isProvider, namesFrom, oauthMessage, oauthProblem, providerLabel, safeNext } from "../src/lib/oauth";

test("buttons show only for providers switched on in Supabase, in a fixed order", () => {
  assert.deepEqual(enabledFrom({ external: { email: true, github: true, google: true, linkedin_oidc: false, apple: true } }), ["google", "github"]);
  assert.deepEqual(enabledFrom({ external: { linkedin_oidc: true } }), ["linkedin_oidc"]);
  assert.deepEqual(enabledFrom({ external: { google: "true" } }), [], "only a real true counts");
  assert.deepEqual(enabledFrom(null), []);
  assert.deepEqual(enabledFrom({ message: "Invalid API key" }), [], "an error reply means no buttons, not a crash");
  assert.deepEqual(PROVIDERS.map((p) => p.id), ["google", "github", "linkedin_oidc"]);
});

test("only known providers start a sign-in", () => {
  assert.ok(isProvider("google") && isProvider("github") && isProvider("linkedin_oidc"));
  assert.ok(!isProvider("linkedin") && !isProvider("azure") && !isProvider(null) && !isProvider("__proto__"));
  assert.equal(providerLabel("linkedin_oidc"), "LinkedIn");
  assert.equal(providerLabel(undefined), "your sign-in provider");
});

test("?next= stays on this site", () => {
  assert.equal(safeNext("/c/abc?x=1"), "/c/abc?x=1");
  assert.equal(safeNext("//evil.example"), "/feed");
  assert.equal(safeNext("/\\evil.example"), "/feed", "browsers read /\\ as another site");
  assert.equal(safeNext("https://evil.example"), "/feed");
  assert.equal(safeNext(undefined), "/feed");
  assert.equal(fromPage("signup"), "signup");
  assert.equal(fromPage("anything"), "login");
});

test("the provider sends people back to /auth/callback on the site they started on", () => {
  const u = new URL(callbackUrl("https://brazework.com", "/c/rocketry", "signup"));
  assert.equal(u.origin + u.pathname, "https://brazework.com/auth/callback");
  assert.equal(u.searchParams.get("flow"), "oauth");
  assert.equal(u.searchParams.get("from"), "signup");
  assert.equal(u.searchParams.get("next"), "/c/rocketry");
  assert.equal(new URL(callbackUrl("http://localhost:3200", "/feed", "login")).searchParams.has("next"), false, "the default isn't spelled out");
});

test("what went wrong at the provider becomes a short code with a plain message", () => {
  const p = (q: string) => oauthProblem(new URLSearchParams(q));
  assert.equal(p("code=abc"), null, "a good return is not a problem");
  assert.equal(p("error=access_denied&error_description=The+user+denied+the+request"), "cancelled");
  assert.equal(p("error=access_denied&error_code=provider_email_needs_verification&error_description=Unverified+email+with+github.+A+confirmation+email+has+been+sent+to+your+github+email"), "unverified");
  assert.equal(p("error=server_error&error_description=Error+getting+user+email+from+external+provider"), "no-email");
  assert.equal(p("error=validation_failed&error_description=Unsupported+provider:+provider+is+not+enabled"), "unavailable");
  assert.equal(p("error=server_error&error_description=Something+else"), "failed");
  for (const c of ["cancelled", "unverified", "no-email", "expired", "failed", "unavailable"]) assert.ok(oauthMessage(c).length > 10, c);
  assert.equal(oauthMessage("<script>"), "", "unknown codes show nothing");
  assert.equal(oauthMessage(undefined), "");
});

test("names start from what the provider shared", () => {
  assert.deepEqual(namesFrom({ given_name: "Ada", family_name: "Lovelace", full_name: "Ada King" }), { firstName: "Ada", lastName: "Lovelace" }, "Google and LinkedIn");
  assert.deepEqual(namesFrom({ full_name: "Mary Ann  Evans" }), { firstName: "Mary Ann", lastName: "Evans" }, "the last word is the last name");
  assert.deepEqual(namesFrom({ name: "octocat" }), { firstName: "octocat", lastName: "" }, "GitHub with a one-word name");
  assert.deepEqual(namesFrom({ user_name: "octocat" }), { firstName: "", lastName: "" }, "a username isn't a name");
  assert.deepEqual(namesFrom({ full_name: "someone@gmail.com" }), { firstName: "", lastName: "" }, "an email isn't a name");
  assert.deepEqual(namesFrom(null), { firstName: "", lastName: "" });
  assert.equal(namesFrom({ given_name: "x".repeat(200) }).firstName.length, 80, "trimmed to the profile's limit");
});
