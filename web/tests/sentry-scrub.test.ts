// What leaves Brazework in an error report (Linear FIX-55). The privacy page promises no emails,
// cookies, headers, bodies or query strings; these hold the scrubber to it.
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { maskEmails, scrubBreadcrumb, scrubEvent, stripQuery } from "../src/lib/sentry-scrub";

test("a URL keeps its path and loses its query string and fragment (sign-in links carry tokens there)", () => {
  assert.equal(stripQuery("https://brazework.com/auth/confirm?token_hash=pkce_abc&type=signup"), "https://brazework.com/auth/confirm");
  assert.equal(stripQuery("/join/ABC123?ref=x#top"), "/join/ABC123");
  assert.equal(stripQuery("/feed"), "/feed");
});

test("emails in error text are masked", () => {
  assert.equal(maskEmails("no profile for ada@university.edu (and Bob.Smith+x@mail.co.uk)"), "no profile for [email] (and [email])");
});

test("an event keeps what's needed to fix the bug and nothing personal", () => {
  const out = scrubEvent({
    message: "insert failed for ada@university.edu",
    exception: { values: [{ type: "Error", value: "duplicate key for ada@university.edu" }] },
    request: { url: "https://brazework.com/settings?tab=email&token=secret", query_string: "tab=email&token=secret", cookies: { "sb-access-token": "jwt" }, headers: { authorization: "Bearer x", cookie: "a=b" }, data: { body: "my private message" }, env: { REMOTE_ADDR: "1.2.3.4" } },
    user: { id: "u-123", email: "ada@university.edu", ip_address: "1.2.3.4", username: "ada" },
    extra: { form: { body: "my private message" } },
    tags: { route: "/settings" },
  });
  assert.deepEqual(out.request, { url: "https://brazework.com/settings" }, "only the path survives: no query, cookies, headers, body or IP");
  assert.deepEqual(out.user, { id: "u-123" }, "the member's id only: no email, IP or username");
  assert.equal(out.extra, undefined, "no extra context (it can hold form input)");
  assert.equal(out.message, "insert failed for [email]");
  assert.equal(out.exception?.values?.[0].value, "duplicate key for [email]");
  assert.deepEqual(out.tags, { route: "/settings" }, "everything else is untouched");
  const json = JSON.stringify(out);
  for (const leak of ["ada@", "secret", "jwt", "Bearer", "private message", "1.2.3.4"]) assert.ok(!json.includes(leak), `"${leak}" leaked`);
});

test("breadcrumbs: console output and typing are dropped; URLs lose their query strings", () => {
  assert.equal(scrubBreadcrumb({ category: "console", message: "draft: my private message" }), null);
  assert.equal(scrubBreadcrumb({ category: "ui.input", message: "textarea#create-box" }), null);
  assert.deepEqual(scrubBreadcrumb({ category: "navigation", data: { from: "/login?next=/feed", to: "/auth/confirm?token_hash=abc" } }), { category: "navigation", data: { from: "/login", to: "/auth/confirm" } });
  assert.deepEqual(scrubBreadcrumb({ category: "fetch", data: { url: "https://x.supabase.co/rest/v1/profiles?email=eq.ada@university.edu", method: "GET" } }), { category: "fetch", data: { url: "https://x.supabase.co/rest/v1/profiles", method: "GET" } });
  assert.deepEqual(scrubBreadcrumb({ category: "ui.click", message: "button.like" }), { category: "ui.click", message: "button.like" });
});

test("an event with no user or request passes through without inventing them", () => {
  const input: Parameters<typeof scrubEvent>[0] = { message: "boom" };
  const out = scrubEvent(input);
  assert.equal(out.user, undefined);
  assert.equal(out.request, undefined);
});
