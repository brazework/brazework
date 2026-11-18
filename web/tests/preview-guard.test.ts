// Previews never run against production's database (web/src/lib/preview-guard.ts, Linear FIX-83).
// Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { PRODUCTION_SUPABASE_REF, previewGuard } from "../src/lib/preview-guard";

const PROD = `https://${PRODUCTION_SUPABASE_REF}.supabase.co`;

test("a preview pointing at production's database is stopped, with a message that says how to fix it", () => {
  const why = previewGuard({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: PROD });
  assert.ok(why);
  assert.match(why, /preview deployment/);
  assert.match(why, new RegExp(PRODUCTION_SUPABASE_REF));
  assert.match(why, /Environment Variables/);
});

test("the check doesn't care about case or a trailing path", () => {
  assert.ok(previewGuard({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: `${PROD.toUpperCase()}/` }));
});

test("production itself builds against production's database", () => {
  assert.equal(previewGuard({ VERCEL_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: PROD }), null);
});

test("a preview on another database, CI and local builds all go ahead", () => {
  assert.equal(previewGuard({ VERCEL_ENV: "preview", NEXT_PUBLIC_SUPABASE_URL: "https://tmrbdrygwyprzwnyhyjg.supabase.co" }), null);
  assert.equal(previewGuard({ VERCEL_ENV: "preview" }), null);
  assert.equal(previewGuard({ NEXT_PUBLIC_SUPABASE_URL: "https://ci-placeholder.supabase.co" }), null);
  assert.equal(previewGuard({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" }), null);
});
