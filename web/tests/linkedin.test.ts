// A professional account's LinkedIn link has one shape (Linear FIX-214). The database holds the
// rule (supabase/linkedin-required.sql, tested in supabase/tests/linkedin-required.test.sql); the
// app's check must agree with it, case for case. Run: npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { cleanLinkedin, LINKEDIN_BAD } from "../src/lib/linkedin";

const url = (s: unknown) => { const r = cleanLinkedin(s); return r.ok ? r.url : "refused"; };

test("what people paste becomes one clean link", () => {
  assert.equal(url("linkedin.com/in/pat-okoro"), "https://www.linkedin.com/in/pat-okoro");
  assert.equal(url("  https://www.linkedin.com/in/pat-okoro/  "), "https://www.linkedin.com/in/pat-okoro");
  assert.equal(url("https://uk.linkedin.com/in/Pat_Okoro-91?utm_source=share&trk=x"), "https://www.linkedin.com/in/Pat_Okoro-91");
  assert.equal(url("HTTP://LinkedIn.com/in/r%C3%A9mi-b#about"), "https://www.linkedin.com/in/r%C3%A9mi-b");
  assert.equal(url("m.linkedin.com/in/pat-okoro"), "https://www.linkedin.com/in/pat-okoro");
});

test("empty means none, which is for the caller to allow or not", () => {
  for (const v of ["", "   ", null, undefined, 42]) assert.equal(url(v), null);
});

test("anything that isn't a personal profile on linkedin.com is refused", () => {
  for (const v of [
    "https://www.linkedin.com/company/acme", "https://evil.example/linkedin.com/in/pat-okoro", "https://linkedin.com.evil.example/in/pat-okoro",
    "https://www.linkedin.com/in/pat-okoro/overlay/contact-info", "javascript:alert(1)//linkedin.com/in/pat", "pat okoro", "linkedin.com/in/ab",
    "https://www.linkedin.com/in/", "notlinkedin.com/in/pat-okoro", "https://www.linkedin.com/in/pat okoro",
  ]) {
    const r = cleanLinkedin(v);
    assert.equal(r.ok, false, v);
    if (!r.ok) assert.equal(r.message, LINKEDIN_BAD);
  }
});

test("the app and the database use the same pattern", () => {
  const sql = readFileSync(join(__dirname, "..", "..", "supabase", "linkedin-required.sql"), "utf8");
  const src = readFileSync(join(__dirname, "..", "src", "lib", "linkedin.ts"), "utf8");
  const inSql = /regexp_match\(s, '([^']+)', 'i'\)/.exec(sql)?.[1];
  const inApp = /const PROFILE = \/(.+)\/i;/.exec(src)?.[1].replace(/\\\//g, "/");
  assert.ok(inSql && inApp, "both patterns must be found");
  assert.equal(inApp, inSql);
});

test("the link is private: no grant lets members read or write the column", () => {
  const sql = readFileSync(join(__dirname, "..", "..", "supabase", "linkedin-required.sql"), "utf8");
  assert.ok(!/grant\s+(select|update)[^;]*linkedin_url/i.test(sql), "linkedin_url must not be granted to anyone");
});
