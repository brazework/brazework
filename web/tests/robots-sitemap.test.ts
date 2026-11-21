// /robots.txt and /sitemap.xml (app/robots.ts, app/sitemap.ts). Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

function withEnv(v: string | undefined, fn: () => void) {
  const was = process.env.VERCEL_ENV;
  if (v === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = v;
  try { fn(); } finally { if (was === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = was; }
}

test("preview and staging copies ask every crawler to stay out", () => {
  withEnv("preview", () => {
    const r = robots();
    assert.deepEqual(r.rules, { userAgent: "*", disallow: "/" });
    assert.equal(r.sitemap, undefined);
  });
});

test("production is open, keeps crawlers off machinery, and points at the sitemap", () => {
  withEnv("production", () => {
    const r = robots();
    const rule = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    assert.equal(rule.allow, "/");
    for (const p of ["/api/", "/auth/", "/vouch/", "/dev/"]) assert.ok((rule.disallow as string[]).includes(p), p);
    assert.match(String(r.sitemap), /\/sitemap\.xml$/);
  });
});

test("the sitemap lists only pages anyone can read, each once", () => {
  const urls = sitemap().map((e) => new URL(e.url).pathname);
  assert.equal(new Set(urls).size, urls.length);
  assert.ok(urls.includes("/") && urls.includes("/pricing"));
  for (const u of urls) assert.ok(!/^\/(feed|u|projects|messages|settings|api|vouch)\b/.test(u), u);
});
