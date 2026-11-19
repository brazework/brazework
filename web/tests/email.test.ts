// Email never goes out without real keys, and Resend gets exactly what it needs. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { mailer, resendProvider } from "@/lib/email";

const e = { to: "josh@forge.test", subject: "Hi", text: "Hello", html: "<p>Hello</p>" };

test("with no keys, email is off and sending says so", async () => {
  const m = mailer({});
  assert.equal(m.enabled, false);
  const r = await m.send(e);
  assert.equal(r.ok === false && r.reason, "off");
});

test("a key without a from address doesn't call Resend", async () => {
  let called = false;
  const r = await resendProvider({ RESEND_API_KEY: "re_x" }, async () => { called = true; return { ok: true, json: async () => ({}) }; }).send(e);
  assert.equal(called, false);
  assert.equal(r.ok === false && r.reason, "off");
});

test("Resend gets from, to, subject, text and html; its id comes back", async () => {
  let sent: Record<string, unknown> = {};
  let auth = "";
  const p = resendProvider({ RESEND_API_KEY: "re_x", FORGE_EMAIL_FROM: "Brazework <hello@forge.test>" }, async (url, init) => {
    assert.equal(url, "https://api.resend.com/emails");
    sent = JSON.parse(String(init.body));
    auth = (init.headers as Record<string, string>).Authorization;
    return { ok: true, json: async () => ({ id: "em_1" }) };
  });
  assert.deepEqual(await p.send(e), { ok: true, id: "em_1" });
  assert.equal(auth, "Bearer re_x");
  assert.deepEqual(sent, { from: "Brazework <hello@forge.test>", to: ["josh@forge.test"], subject: "Hi", text: "Hello", html: "<p>Hello</p>" });
});

test("a Resend error is reported", async () => {
  const p = resendProvider({ RESEND_API_KEY: "re_x", FORGE_EMAIL_FROM: "hello@forge.test" }, async () => ({ ok: false, json: async () => ({ message: "Domain not verified" }) }));
  const r = await p.send(e);
  assert.equal(r.ok === false && r.message, "Domain not verified");
});

test("the local outbox runs only when asked for, against a local database, never on Vercel or production", async () => {
  const { outboxOn, mailer } = await import("@/lib/email");
  const local = { BRAZEWORK_LOCAL_OUTBOX: "1", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54331" };
  assert.equal(outboxOn(local), true);
  assert.equal(outboxOn({ ...local, NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321" }), true);
  assert.equal(outboxOn({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" }), false, "not asked for: npm run e2e still tests email off");
  assert.equal(outboxOn({ ...local, NEXT_PUBLIC_SUPABASE_URL: "https://uwiwkjoonculpxjmzsfj.supabase.co" }), false, "never against a real project");
  assert.equal(outboxOn({ ...local, NEXT_PUBLIC_SUPABASE_URL: "http://localhost.evil.com" }), false);
  assert.equal(outboxOn({ ...local, VERCEL: "1" }), false, "never on Vercel");
  assert.equal(mailer({ ...local }).name, "local-outbox");
  assert.equal(mailer({ ...local, RESEND_API_KEY: "re_x", FORGE_EMAIL_FROM: "a@b.co" }).name, "resend", "a real provider wins");
  assert.equal(mailer({}).name, "off");
});

test("the local outbox keeps each email as one line in its file", async () => {
  const { localOutbox } = await import("@/lib/email");
  const { mkdtemp, readFile } = await import("node:fs/promises");
  const { tmpdir } = await import("node:os");
  const file = `${await mkdtemp(`${tmpdir()}/outbox-`)}/out.jsonl`;
  const r = await localOutbox({ BRAZEWORK_OUTBOX_FILE: file }).send({ to: "e.ruiz@stateu.edu", subject: "Sign Priya's milestone", text: "Open https://localhost/v/abc", html: "" });
  assert.equal(r.ok, true);
  const line = JSON.parse((await readFile(file, "utf8")).trim());
  assert.equal(line.to, "e.ruiz@stateu.edu");
  assert.ok(line.text.includes("/v/abc") && line.at);
});
