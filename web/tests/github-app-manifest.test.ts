// Brazework's GitHub App, as code (Linear FIX-92, phase 3): infra/github-app.json is what GitHub
// creates, so these hold it to least privilege, and check how infra/github-app.mjs hands it over and
// names the keys. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { buildManifest, startPage, vercelVars } from "../../infra/github-app.mjs";

const manifest = JSON.parse(readFileSync(join(__dirname, "..", "..", "infra", "github-app.json"), "utf8"));

test("the App only reads: every permission is read, and only the ones the build log needs", () => {
  assert.deepEqual(Object.keys(manifest.default_permissions).sort(), ["checks", "contents", "deployments", "metadata", "pull_requests"]);
  for (const [perm, level] of Object.entries(manifest.default_permissions)) assert.equal(level, "read", `${perm} must be read-only`);
});

test("installing asks the member to sign in with GitHub (how Brazework proves they have access to the repo)", () => {
  assert.equal(manifest.request_oauth_on_install, true);
  assert.deepEqual(manifest.callback_urls, ["https://brazework.com/api/github/callback"]);
});

test("webhooks go to production over https, for the events the build log shows", () => {
  assert.equal(manifest.hook_attributes.url, "https://brazework.com/api/github/webhook");
  assert.equal(manifest.hook_attributes.active, true);
  assert.deepEqual([...manifest.default_events].sort(), ["check_suite", "deployment_status", "pull_request", "push", "release"]);
});

test("the one-time code comes back to this machine, and the manifest is escaped inside the form", () => {
  const m = buildManifest({ ...manifest, description: `Say "hi" & <b>` }, "http://localhost:3434/callback");
  assert.equal(m.redirect_url, "http://localhost:3434/callback");
  const html = startPage("brazework", m, "abc123");
  assert.match(html, /action="https:\/\/github\.com\/organizations\/brazework\/settings\/apps\/new\?state=abc123"/);
  // The hidden field holds the manifest escaped: nothing in it can close the attribute or open a tag,
  // and it decodes back to exactly what GitHub should receive.
  const value = /name="manifest" value="([^"]*)"/.exec(html)?.[1] ?? "";
  assert.ok(value.length > 0 && !value.includes("<"), "escaped inside the attribute");
  assert.deepEqual(JSON.parse(value.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&amp;/g, "&")), m);
  assert.match(startPage(undefined, m, "s"), /action="https:\/\/github\.com\/settings\/apps\/new\?state=s"/);
});

test("the keys get the names the app reads, the private key as one line, and nothing is missing", () => {
  const pem = "-----BEGIN RSA PRIVATE KEY-----\nabc\n-----END RSA PRIVATE KEY-----\n";
  const v = vercelVars({ id: 123, slug: "brazework", client_id: "Iv1.x", client_secret: "cs", webhook_secret: "ws", pem });
  assert.deepEqual(Object.keys(v).sort(), ["GITHUB_APP_CLIENT_ID", "GITHUB_APP_CLIENT_SECRET", "GITHUB_APP_ID", "GITHUB_APP_PRIVATE_KEY", "GITHUB_APP_SLUG", "GITHUB_APP_WEBHOOK_SECRET"]);
  assert.equal(v.GITHUB_APP_ID, "123");
  assert.ok(!v.GITHUB_APP_PRIVATE_KEY.includes("\n"));
  assert.equal(Buffer.from(v.GITHUB_APP_PRIVATE_KEY, "base64").toString(), pem);
  assert.throws(() => vercelVars({ id: 1, slug: "x", client_id: "c", client_secret: "s", webhook_secret: "", pem }), /webhook_secret/);
});
