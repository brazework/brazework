// Résumé verify links (supabase/verify-links.sql): the page says who signed, in what role, whether it
// still stands, and the QR code encodes the link. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { encode } from "uqr";
import { evidenceLinks, qrSvgPath, roleLabel, signerLine, stateLine, verifyUrl, type PublicVerify } from "@/lib/verify-public";

const base: PublicVerify = {
  id: "m1", title: "Static fire at 1.2 kN", detail: "", achieved_on: "2026-11-01", project: "Test stand", state: "valid",
  member: { id: "u1", first: "Ben", last: "Cho", headline: "" },
  signer: { kind: "club", name: "Maya P.", role: "admin", club: "Rocketry Club", vouched_by: "", at: "2026-11-02T15:00:00Z" },
  pro: [], evidence: [], legacy_evidence: "", kept_private: 0, revoked_at: null, checked_at: "2026-11-19T00:00:00Z",
};

test("roles read as words", () => {
  assert.equal(roleLabel("professor"), "professor");
  assert.equal(roleLabel("admin"), "club officer");
  assert.equal(roleLabel("pi"), "lab PI");
  assert.equal(roleLabel(""), "");
});

test("who signed: a club officer, or the person who vouched with their domain", () => {
  assert.equal(signerLine(base), "Maya P., club officer of Rocketry Club");
  assert.equal(signerLine({ signer: { ...base.signer, kind: "vouch", name: "Dr. Priya Lee", role: "professor", club: "", vouched_by: "Dr. Priya Lee, Assistant Professor · utexas.edu" } }),
    "Dr. Priya Lee, Assistant Professor · utexas.edu (professor)");
});

test("the status line says whether it still stands", () => {
  assert.deepEqual(stateLine(base), { tone: "ok", text: "Verified and still valid" });
  assert.equal(stateLine({ ...base, signer: { ...base.signer, kind: "vouch" } }).text, "Signed and still valid");
  assert.deepEqual(stateLine({ ...base, state: "revoked", revoked_at: "2026-11-10T12:00:00Z" }), { tone: "bad", text: "Revoked on November 10, 2026. It no longer counts as proof" });
  assert.equal(stateLine({ ...base, state: "disputed", revoked_at: null }).tone, "warn");
});

test("evidence: the first link, then the other links and commits, each once", () => {
  // Since FIX-238 a milestone can gain links after logging, so the first link always shows too.
  assert.deepEqual(evidenceLinks({ evidence: [{ type: "commit", url: "https://github.com/a/b/commit/1" }, { type: "image", path: "x.webp" }], legacy_evidence: "https://old.example/" }),
    [{ type: "link", url: "https://old.example/", label: "old.example" }, { type: "commit", url: "https://github.com/a/b/commit/1", label: "github.com/a/b/commit/1" }]);
  assert.deepEqual(evidenceLinks({ evidence: [], legacy_evidence: "https://old.example/" }), [{ type: "link", url: "https://old.example/", label: "old.example" }]);
  assert.deepEqual(evidenceLinks({ evidence: [{ type: "link", url: "https://old.example/" }], legacy_evidence: "https://old.example/" }).length, 1, "the same link isn't listed twice");
  assert.deepEqual(evidenceLinks({ evidence: [], legacy_evidence: "" }), []);
});

test("evidence added after signing keeps its mark and date", () => {
  const [late] = evidenceLinks({ evidence: [{ type: "link", url: "https://docs.example/writeup", after_signing: true, added_at: "2026-11-21T10:00:00Z" }], legacy_evidence: "" });
  assert.equal(late.after_signing, true);
  assert.equal(late.added_at, "2026-11-21T10:00:00Z");
});

test("the link and its QR code", () => {
  const url = verifyUrl("https://brazework.com/", "3f1c2b8a-0000-4000-8000-000000000001");
  assert.equal(url, "https://brazework.com/v/3f1c2b8a-0000-4000-8000-000000000001");
  const qr = qrSvgPath(url);
  assert.ok(qr.size >= 25 && qr.size <= 45, `a small code (size ${qr.size})`);
  assert.match(qr.d, /^(M\d+ \d+h\d+v1h-\d+z)+$/);
  // The path draws exactly the dark modules the encoder made for this link.
  const grid = Array.from({ length: qr.size }, () => Array<boolean>(qr.size).fill(false));
  for (const [, x, y, w] of qr.d.matchAll(/M(\d+) (\d+)h(\d+)/g)) for (let i = 0; i < +w; i++) grid[+y][+x + i] = true;
  assert.deepEqual(grid, encode(url, { ecc: "M", border: 2 }).data);
});
