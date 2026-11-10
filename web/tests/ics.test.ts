// Calendar import reads real exports correctly: time zones, all-day events, folded lines, escapes,
// cancelled events, and only what's still ahead. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseIcs, upcoming, zonedToUtc } from "@/lib/ics";

const FILE = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Google Inc//Google Calendar 70.9054//EN",
  "BEGIN:VEVENT",
  "UID:gbm-1@google.com",
  "DTSTART;TZID=America/New_York:20261112T180000",
  "DTEND;TZID=America/New_York:20261112T193000",
  "SUMMARY:General body meeting",
  "LOCATION:Dana Hall 210\\, UHart",
  "DESCRIPTION:Officer updates\\nPizza after.",
  "URL:https://meet.example.com/gbm",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:fair-1@google.com",
  "DTSTART;VALUE=DATE:20261120",
  "DTEND;VALUE=DATE:20261121",
  "SUMMARY:Career fair prep: résumés and a very long title that is folded",
  "  onto the next line",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:utc-1",
  "DTSTART:20261201T230000Z",
  "SUMMARY:Build night",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancel-1",
  "DTSTART:20261202T230000Z",
  "SUMMARY:Cancelled thing",
  "STATUS:CANCELLED",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:past-1",
  "DTSTART:20250101T120000Z",
  "DTEND:20250101T130000Z",
  "SUMMARY:Old event",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

test("time zones become exact moments (New York in November is UTC-5)", () => {
  const [gbm] = parseIcs(FILE, "UTC");
  assert.equal(gbm.title, "General body meeting");
  assert.equal(gbm.starts_at, "2026-11-12T23:00:00.000Z");
  assert.equal(gbm.ends_at, "2026-11-13T00:30:00.000Z");
  assert.equal(gbm.location, "Dana Hall 210, UHart");
  assert.equal(gbm.description, "Officer updates\nPizza after.");
  assert.equal(gbm.link, "https://meet.example.com/gbm");
});

test("daylight saving is respected (New York in July is UTC-4)", () => {
  assert.equal(zonedToUtc(2026, 7, 4, 12, 0, 0, "America/New_York").toISOString(), "2026-07-04T16:00:00.000Z");
});

test("all-day events, folded lines, UTC times and missing ends", () => {
  const ev = parseIcs(FILE, "America/New_York");
  const fair = ev.find((e) => e.uid === "fair-1@google.com")!;
  assert.equal(fair.allDay, true);
  assert.equal(fair.title, "Career fair prep: résumés and a very long title that is folded onto the next line");
  assert.equal(fair.starts_at, "2026-11-20T05:00:00.000Z");
  const build = ev.find((e) => e.uid === "utc-1")!;
  assert.equal(build.starts_at, "2026-12-01T23:00:00.000Z");
  assert.equal(build.ends_at, "2026-12-02T00:00:00.000Z", "no DTEND means an hour");
});

test("cancelled events are skipped; only upcoming ones, soonest first", () => {
  const ev = parseIcs(FILE);
  assert.equal(ev.some((e) => e.uid === "cancel-1"), false);
  const next = upcoming(ev, Date.parse("2026-11-10T00:00:00Z"));
  assert.deepEqual(next.map((e) => e.uid), ["gbm-1@google.com", "fair-1@google.com", "utc-1"]);
});

test("garbage in, nothing out", () => {
  assert.deepEqual(parseIcs("not a calendar"), []);
  assert.deepEqual(parseIcs("BEGIN:VEVENT\nSUMMARY:No start\nEND:VEVENT"), []);
});
