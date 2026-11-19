// The in-chat milestone card (lib/mcp-card.ts, MCP Apps): one self-contained document that reaches
// nothing outside, writes text only as text, and speaks the spec's handshake. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { CARD_HTML, CARD_MIME, CARD_URI, cardMeta } from "@/lib/mcp-card";

test("the card is named the way the MCP Apps spec says", () => {
  assert.match(CARD_URI, /^ui:\/\//);
  assert.equal(CARD_MIME, "text/html;profile=mcp-app");
  assert.equal(cardMeta.ui.resourceUri, CARD_URI, "the nested form, not the deprecated ui/resourceUri");
});

test("it loads nothing from outside and never writes markup from data", () => {
  assert.match(CARD_HTML, /^<!doctype html>/);
  assert.doesNotMatch(CARD_HTML, /<(script|link|img|iframe)[^>]+(src|href)=/i, "no outside scripts, styles or images");
  assert.doesNotMatch(CARD_HTML, /\b(fetch|XMLHttpRequest|WebSocket|innerHTML|outerHTML|insertAdjacentHTML|eval)\b/, "no network, no markup from data");
  assert.match(CARD_HTML, /e\.source !== parent/, "only listens to its host");
});

test("it does the handshake: ui/initialize, then initialized; reads tool input and result; opens links through the host", () => {
  for (const m of ["ui/initialize", "ui/notifications/initialized", "ui/notifications/tool-input", "ui/notifications/tool-result", "ui/open-link", "ui/notifications/size-changed"]) assert.ok(CARD_HTML.includes(m), m);
});
