// The milestone card inside the chat (MCP Apps, extension io.modelcontextprotocol/ui, spec 2026-01-26).
// log_milestone and draft_milestone name this view in their _meta.ui.resourceUri. A host that supports
// MCP Apps (Claude, ChatGPT, VS Code, Goose…) renders it in a sandboxed frame and sends it the tool's
// input and result; any other host shows the text result, which stays complete on its own.
//
// The view is one self-contained HTML document: no network (the host's default CSP allows none), no
// libraries, every value set with textContent. It speaks the spec's postMessage JSON-RPC by hand:
// ui/initialize → ui/notifications/initialized, then tool-input and tool-result; ui/open-link for the
// button; size-changed as it grows. Tested in a real browser against a stand-in host (e2e/lb-mcp-card.cjs).

export const CARD_URI = "ui://brazework/milestone-card";
export const CARD_MIME = "text/html;profile=mcp-app";
/** What a tool carries to name the card (the nested form; the flat "ui/resourceUri" is deprecated). */
export const cardMeta = { ui: { resourceUri: CARD_URI } };
/** What the card's resource says about itself: no outside connections, a border around it. */
export const cardResourceMeta = { ui: { prefersBorder: true } };

export const CARD_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Brazework milestone</title>
<style>
  :root { color-scheme: light dark; --bg: var(--color-background-primary, light-dark(#fbfaf8, #1b1a18)); --fg: var(--color-text-primary, light-dark(#1f1f1d, #f1efe9));
    --muted: var(--color-text-secondary, light-dark(#6b6a65, #a7a49b)); --line: var(--color-border-primary, light-dark(#e6e3dc, #34322d));
    --chip: light-dark(#f1eee7, #2a2824); --ok: light-dark(#167a3e, #4fc27b); --wait: light-dark(#8a5a00, #e0b04d); --font: var(--font-sans, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif); }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 var(--font); }
  .card { padding: 16px 18px; }
  .top { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); }
  .mark { width: 18px; height: 18px; }
  .brand { font-weight: 600; color: var(--fg); }
  .chip { margin-left: auto; border-radius: 999px; padding: 2px 9px; font-size: 11.5px; font-weight: 600; background: var(--chip); }
  .chip.wait { color: var(--wait); } .chip.ok { color: var(--ok); }
  h1 { margin: 10px 0 2px; font-size: 17px; line-height: 1.3; letter-spacing: -0.01em; }
  .detail { margin: 0; color: var(--muted); }
  ul { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 4px; }
  li { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12.5px; color: var(--muted); }
  li::before { content: "↗ "; }
  .next { margin: 12px 0 0; padding: 10px 12px; border-radius: 10px; background: var(--chip); font-size: 13px; }
  .row { display: flex; gap: 8px; margin-top: 12px; }
  button { font: inherit; font-weight: 600; font-size: 13px; border: 1px solid var(--line); background: var(--fg); color: var(--bg); border-radius: 8px; padding: 7px 12px; cursor: pointer; }
  button[hidden] { display: none; }
  .empty { color: var(--muted); }
</style>
</head>
<body>
<div class="card" id="card">
  <div class="top">
    <svg class="mark" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 12 4l8 16H4Z" fill="currentColor"/></svg>
    <span class="brand">Brazework</span><span id="via"></span>
    <span class="chip" id="chip" hidden></span>
  </div>
  <h1 id="title" class="empty">Your milestone</h1>
  <p class="detail" id="detail"></p>
  <ul id="evidence" aria-label="Evidence"></ul>
  <p class="next" id="next" hidden></p>
  <div class="row"><button id="open" type="button" hidden>Open in Brazework</button></div>
</div>
<script>
(function () {
  var parent = window.parent, nextId = 1, pending = {}, openUrl = "";
  function send(msg) { parent.postMessage(msg, "*"); }
  function request(method, params) { var id = nextId++; send({ jsonrpc: "2.0", id: id, method: method, params: params }); return new Promise(function (ok) { pending[id] = ok; }); }
  function notify(method, params) { send({ jsonrpc: "2.0", method: method, params: params || {} }); }
  function $(id) { return document.getElementById(id); }
  function text(id, value) { var el = $(id); el.textContent = value || ""; el.hidden = !value; }
  function theme(ctx) {
    var vars = ctx && ctx.styles && ctx.styles.variables;
    if (vars) for (var k in vars) if (/^--[a-z0-9-]+$/i.test(k) && typeof vars[k] === "string") document.documentElement.style.setProperty(k, vars[k]);
  }
  function showInput(args) {
    if (!args) return;
    if (args.title) { $("title").textContent = String(args.title).slice(0, 120); $("title").className = ""; }
    $("detail").textContent = args.detail ? String(args.detail).slice(0, 600) : "";
    var list = $("evidence"); list.textContent = "";
    (Array.isArray(args.evidence) ? args.evidence : []).slice(0, 8).forEach(function (u) {
      var li = document.createElement("li"); li.textContent = String(u).replace(/^https:\\/\\//, ""); list.appendChild(li);
    });
  }
  function showResult(result) {
    var r = (result && result.structuredContent) || {};
    var chip = $("chip");
    if (result && result.isError) { chip.textContent = "Not saved"; chip.className = "chip wait"; chip.hidden = false; text("next", (result.content && result.content[0] && result.content[0].text) || ""); return; }
    var status = r.status, label = "";
    if (status === "pending" && r.club) label = "Waiting for " + r.club;
    else if (status === "pending" || status === "draft") label = r.duplicate === undefined ? "Waiting for a signature" : "In your drafts";
    else if (status === "waiting") label = "In your drafts";
    else if (status === "verified") label = "Signed";
    if (label) { chip.textContent = label; chip.className = "chip " + (status === "verified" ? "ok" : "wait"); chip.hidden = false; }
    if (r.via) $("via").textContent = " · via " + String(r.via).slice(0, 40);
    text("next", r.next);
    openUrl = typeof r.open === "string" && /^https:\\/\\//.test(r.open) ? r.open : (typeof r.open === "string" && /^http:\\/\\/localhost(:\\d+)?\\//.test(r.open) ? r.open : "");
    $("open").hidden = !openUrl;
  }
  $("open").addEventListener("click", function () { if (openUrl) request("ui/open-link", { url: openUrl }); });
  window.addEventListener("message", function (e) {
    if (e.source !== parent) return;
    var m = e.data; if (!m || m.jsonrpc !== "2.0") return;
    if (m.id !== undefined && pending[m.id]) { var done = pending[m.id]; delete pending[m.id]; done(m); return; }
    if (m.method === "ui/notifications/tool-input") showInput(m.params && m.params.arguments);
    else if (m.method === "ui/notifications/tool-result") showResult(m.params);
    else if (m.method === "ui/notifications/host-context-changed") theme(m.params);
  });
  if ("ResizeObserver" in window) new ResizeObserver(function () {
    var c = $("card"); notify("ui/notifications/size-changed", { width: Math.ceil(c.scrollWidth), height: Math.ceil(c.scrollHeight) });
  }).observe($("card"));
  request("ui/initialize", { protocolVersion: "2026-01-26", appCapabilities: {}, clientInfo: { name: "brazework-milestone-card", version: "1.0.0" } }).then(function (res) {
    theme(res && res.result && res.result.hostContext);
    notify("ui/notifications/initialized", {});
  });
})();
</script>
</body>
</html>
`;
