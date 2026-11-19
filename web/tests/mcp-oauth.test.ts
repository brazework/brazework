// One-click connect (lib/mcp-oauth.ts): the metadata names Supabase Auth as the authorization server,
// a sign-in's row hash is keyed (stable for one sign-in, different for any other), and only JWTs take
// the sign-in path. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { looksLikeJwt, resourceMetadata, resourceMetadataUrl, signInHash } from "@/lib/mcp-oauth";

test("the MCP endpoint's metadata points clients to Supabase Auth to sign in", () => {
  const m = resourceMetadata("https://brazework.com/");
  assert.equal(m.resource, "https://brazework.com/api/mcp");
  assert.equal(m.authorization_servers.length, 1);
  assert.match(m.authorization_servers[0], /\/auth\/v1$/);
  assert.deepEqual(m.bearer_methods_supported, ["header"]);
  assert.equal(resourceMetadataUrl("https://brazework.com"), "https://brazework.com/.well-known/oauth-protected-resource/api/mcp");
});

test("a sign-in's hash is stable, secret-keyed, and different for another member, app, session or secret", () => {
  const h = signInHash("k", "u1", "c1", "s1");
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.equal(signInHash("k", "u1", "c1", "s1"), h);
  for (const other of [signInHash("k", "u2", "c1", "s1"), signInHash("k", "u1", "c2", "s1"), signInHash("k", "u1", "c1", "s2"), signInHash("other", "u1", "c1", "s1")]) assert.notEqual(other, h);
});

test("only a JWT takes the sign-in path; forge_ tokens and junk don't", () => {
  assert.ok(looksLikeJwt("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl"));
  assert.ok(!looksLikeJwt("forge_abcdefghijklmnopqrstuvwxyz"));
  assert.ok(!looksLikeJwt("a.b"));
  assert.ok(!looksLikeJwt(""));
});
