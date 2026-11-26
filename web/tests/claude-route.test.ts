// How Jig reaches Claude (lib/claude.ts, Linear FIX-15): an Anthropic key goes direct; Vercel AI
// Gateway only when switched on with EMBER_VIA_GATEWAY=1 (on Vercel, or with a gateway key);
// otherwise Jig stays off. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { claudeModel, claudeRoute } from "@/lib/claude";

test("an Anthropic key goes direct, whatever else is set", () => {
  assert.equal(claudeRoute({ ANTHROPIC_API_KEY: "sk-ant-x", EMBER_VIA_GATEWAY: "1", VERCEL: "1" }), "direct");
});

test("the gateway is used only when switched on", () => {
  assert.equal(claudeRoute({ VERCEL: "1" }), "off", "on Vercel, but not switched on");
  assert.equal(claudeRoute({ EMBER_VIA_GATEWAY: "1", VERCEL: "1" }), "gateway", "on Vercel: the deployment's OIDC token");
  assert.equal(claudeRoute({ EMBER_VIA_GATEWAY: "1", AI_GATEWAY_API_KEY: "vck_x" }), "gateway", "elsewhere, with a gateway key");
  assert.equal(claudeRoute({ EMBER_VIA_GATEWAY: "1" }), "off", "switched on, but nothing to sign in with");
  assert.equal(claudeRoute({ EMBER_VIA_GATEWAY: "true", VERCEL: "1" }), "off", "only 1 switches it on");
});

test("with nothing set, Jig is off (CI and the local demo)", () => {
  assert.equal(claudeRoute({}), "off");
  assert.equal(claudeRoute({ ANTHROPIC_API_KEY: "" }), "off");
});

test("the gateway gets provider-named models; direct keeps Anthropic's names", () => {
  assert.equal(claudeModel("claude-sonnet-5", "gateway"), "anthropic/claude-sonnet-5");
  assert.equal(claudeModel("anthropic/claude-sonnet-5", "gateway"), "anthropic/claude-sonnet-5");
  assert.equal(claudeModel("claude-sonnet-5", "direct"), "claude-sonnet-5");
  assert.equal(claudeModel("claude-sonnet-5", "off"), "claude-sonnet-5");
});
