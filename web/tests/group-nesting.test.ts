// Messages → Groups keeps one row per club (FIX-248): team chats fold under their club. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { nestGroups } from "@/lib/group-nesting";

const chat = (id: string, kind: "club" | "event" | "team", community_id: string | null, lastAt: string | null, unread = false) => ({ id, kind, community_id, lastAt, unread });

test("team chats fold under their club, one row per club", () => {
  const rows = nestGroups([
    chat("t-av", "team", "rkt", "2026-11-22T10:00:00Z"),
    chat("club-rkt", "club", "rkt", "2026-11-20T10:00:00Z"),
    chat("ev-1", "event", null, "2026-11-21T10:00:00Z"),
    chat("t-rec", "team", "rkt", "2026-11-19T10:00:00Z"),
    chat("club-rob", "club", "rob", null),
  ]);
  assert.deepEqual(rows.map((r) => r.chat.id), ["club-rkt", "ev-1", "club-rob"]);
  assert.deepEqual(rows[0].teams.map((t) => t.id), ["t-av", "t-rec"], "the club's teams, newest first");
  assert.deepEqual(rows[2].teams, []);
});

test("a club moves up with its newest team message, and shows a team's unread", () => {
  const rows = nestGroups([
    chat("ev-1", "event", null, "2026-11-21T10:00:00Z"),
    chat("club-rkt", "club", "rkt", "2026-11-01T10:00:00Z"),
    chat("t-av", "team", "rkt", "2026-11-22T10:00:00Z", true),
  ]);
  assert.equal(rows[0].chat.id, "club-rkt", "a new team message puts the club first");
  assert.equal(rows[0].teamUnread, true);
  assert.equal(rows[0].chat.unread, false, "the club chat itself is still read");
});

test("a team chat whose club chat isn't in your list stays its own row", () => {
  const rows = nestGroups([chat("t-x", "team", "other", "2026-11-22T10:00:00Z"), chat("club-rkt", "club", "rkt", null)]);
  assert.deepEqual(rows.map((r) => r.chat.id), ["t-x", "club-rkt"]);
});
