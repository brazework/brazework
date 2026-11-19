// The MCP server's identity (lib/mcp-identity.ts): its own icons and website, from this site, so an
// assistant shows the current logo. Run: npm test
import assert from "node:assert/strict";
import { test } from "node:test";
import { mcpServerInfo } from "@/lib/mcp-identity";

test("the server names itself and points to its own icons on this site, PNG and SVG", () => {
  const info = mcpServerInfo("https://brazework.com/");
  assert.equal(info.name, "brazework");
  assert.equal(info.title, "Brazework");
  assert.equal(info.websiteUrl, "https://brazework.com", "no trailing slash");
  assert.deepEqual(info.icons.map((i) => i.src), ["https://brazework.com/app-icon/512", "https://brazework.com/app-icon/192", "https://brazework.com/icon.svg"]);
  for (const i of info.icons) {
    assert.ok(i.src.startsWith("https://"), "absolute https, as the standard asks");
    assert.match(i.mimeType, /^image\/(png|svg\+xml)$/);
    assert.ok(i.sizes.length > 0);
  }
});

test("a local site gives local icons, so the demo never points at production", () => {
  assert.ok(mcpServerInfo("http://localhost:3104").icons.every((i) => i.src.startsWith("http://localhost:3104/")));
});
