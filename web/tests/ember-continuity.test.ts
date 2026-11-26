// Torch picks up where you left off (lib/ember-continuity.ts, Linear FIX-233): from the chats Torch
// already saves, never anything new. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { CONTINUE_DAYS, continueStep, recentChatLines, type RecentChat } from "@/lib/ember-continuity";

const now = Date.parse("2026-11-21T22:00:00Z");
const DAY = 864e5;
const chat = (id: string, title: string, daysAgo: number): RecentChat => ({ id, title, updated_at: new Date(now - daysAgo * DAY).toISOString() });

test("Torch is told their recent chats, newest first, by title and when", () => {
  const lines = recentChatLines([chat("a", "Plan my health tech applications", 0), chat("b", "Ask Dana to sign the kiosk result", 1), chat("c", "Résumé bullets", 4)], now);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /"Plan my health tech applications" \(today\); "Ask Dana to sign the kiosk result" \(yesterday\); "Résumé bullets" \(4 days ago\)/);
  // It's told these are titles only, so it doesn't claim to remember more than it can see.
  assert.match(lines[0], /only their titles/);
});

test("no chats, or only untitled ones: nothing is said", () => {
  assert.deepEqual(recentChatLines([], now), []);
  assert.deepEqual(recentChatLines([chat("a", "  ", 0)], now), []);
});

test("at most five chats are listed, and long titles are cut", () => {
  const many = Array.from({ length: 8 }, (_, i) => chat(`c${i}`, `Chat ${i} ${"x".repeat(i === 0 ? 120 : 0)}`, i));
  const line = recentChatLines(many, now)[0];
  assert.equal((line.match(/\(today\)|\(yesterday\)|days ago\)/g) ?? []).length, 5);
  assert.match(line, /…/);
});

test("a chat from the last few days is offered first, as a link back to it", () => {
  const s = continueStep([chat("abc", "Plan my health tech applications", 1)], now)!;
  assert.equal(s.id, "continue");
  assert.equal(s.label, "Pick up where you left off: Plan my health tech applications");
  assert.ok("href" in s && s.href === "/copilot?chat=abc");
  assert.match(s.hint, /yesterday/);
});

test("an older chat isn't offered", () => {
  assert.equal(continueStep([chat("old", "Something from last week", CONTINUE_DAYS + 1)], now), null);
  assert.equal(continueStep([], now), null);
});
