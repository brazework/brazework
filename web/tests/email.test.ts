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
