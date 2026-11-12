// The GitHub App's server side (Linear FIX-92, phase 3): its JWT, and the signed state that carries a
// "Connect GitHub" round trip. Run: npm test
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { test } from "node:test";
import { appJwt, githubConfig, signState, verifyState } from "../src/lib/github-app";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs1", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const NOW = Date.parse("2026-11-12T12:00:00Z");

test("the App's JWT is RS256, signed by its key, issued a minute early and valid under GitHub's 10-minute limit", () => {
  const jwt = appJwt("5732173", privateKey, NOW);
  const [h, b, s] = jwt.split(".");
  assert.deepEqual(JSON.parse(Buffer.from(h, "base64url").toString()), { alg: "RS256", typ: "JWT" });
  const claims = JSON.parse(Buffer.from(b, "base64url").toString());
  assert.equal(claims.iss, "5732173");
  assert.equal(claims.iat, NOW / 1000 - 60);
  assert.ok(claims.exp - claims.iat <= 600);
  assert.ok(createVerify("RSA-SHA256").update(`${h}.${b}`).verify(publicKey, Buffer.from(s, "base64url")), "verifies with the App's public key");
});

test("state comes back only as it was signed, for the same project and member, before it expires", () => {
  const st = signState("client-secret", { project: "p1", member: "ben" }, NOW);
  assert.deepEqual(verifyState("client-secret", st, NOW + 60e3), { project: "p1", member: "ben" });
  assert.equal(verifyState("client-secret", st, NOW + 21 * 60e3), null, "expired after 20 minutes");
  assert.equal(verifyState("another-secret", st, NOW), null, "signed with another secret");
  const [body, sig] = st.split(".");
  const swapped = Buffer.from(JSON.stringify({ ...JSON.parse(Buffer.from(body, "base64url").toString()), project: "someone-elses" })).toString("base64url");
  assert.equal(verifyState("client-secret", `${swapped}.${sig}`, NOW), null, "a project swapped in after signing");
  for (const bad of [null, "", "nonsense", "a.b.c", "a.b"]) assert.equal(verifyState("client-secret", bad, NOW), null);
});

test("the App is off until all of its variables are set; its key works as base64 or raw PEM", () => {
  const base = { GITHUB_APP_ID: "1", GITHUB_APP_SLUG: "brazework", GITHUB_APP_CLIENT_ID: "Iv1", GITHUB_APP_CLIENT_SECRET: "s" };
  assert.equal(githubConfig({ ...base }), null);
  const b64 = githubConfig({ ...base, GITHUB_APP_PRIVATE_KEY: Buffer.from(privateKey).toString("base64") })!;
  assert.equal(b64.privateKey, privateKey);
  assert.equal(b64.api, "https://api.github.com");
  assert.equal(githubConfig({ ...base, GITHUB_APP_PRIVATE_KEY: privateKey })!.privateKey, privateKey);
});
