#!/usr/bin/env node
// Creates Brazework's GitHub App from infra/github-app.json (Linear FIX-92, phase 3), with GitHub's
// app-manifest flow, and keeps its keys off the web and out of chat:
//
//   node infra/github-app.mjs create [--org brazework]
//     Opens GitHub's "Create GitHub App" page, pre-filled from the manifest. You click Create; GitHub
//     sends a one-time code back to this script (on localhost), which swaps it for the App's
//     credentials and saves them to your macOS Keychain ("Brazework GitHub App"). Only the App's id
//     and name are printed.
//
//   node infra/github-app.mjs push-to-vercel [--dir <a folder linked to the forge-app project>] [--replace]
//     Copies the credentials from the Keychain into Vercel's Production environment variables
//     (vercel env add, value on stdin). Redeploy afterwards.
//
//   node infra/github-app.mjs status
//     What's in the Keychain (names only, no values).
//
// https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const KEYCHAIN = { service: "Brazework GitHub App", account: "credentials" };
const PORT = 3434;

/** The manifest GitHub receives: the repo's settings plus where to send the one-time code. */
export function buildManifest(base, redirectUrl) {
  return { ...base, redirect_url: redirectUrl };
}

/** Vercel variable names for the credentials GitHub returns. The private key is base64 (one line). */
export function vercelVars(c) {
  for (const k of ["id", "slug", "client_id", "client_secret", "webhook_secret", "pem"]) {
    if (!c[k]) throw new Error(`GitHub's answer has no ${k}`);
  }
  return {
    GITHUB_APP_ID: String(c.id),
    GITHUB_APP_SLUG: c.slug,
    GITHUB_APP_CLIENT_ID: c.client_id,
    GITHUB_APP_CLIENT_SECRET: c.client_secret,
    GITHUB_APP_WEBHOOK_SECRET: c.webhook_secret,
    GITHUB_APP_PRIVATE_KEY: Buffer.from(c.pem).toString("base64"),
  };
}

/** The page that posts the manifest to GitHub (an auto-submitting form, as GitHub's docs show). */
export function startPage(org, manifest, state) {
  const target = org ? `https://github.com/organizations/${encodeURIComponent(org)}/settings/apps/new` : "https://github.com/settings/apps/new";
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<!doctype html><meta charset="utf-8"><title>Create the Brazework GitHub App</title>
<body style="font-family:system-ui;margin:3rem;max-width:36rem">
<h1>Creating the Brazework GitHub App…</h1><p>Taking you to GitHub. Check the settings, then click <b>Create GitHub App</b>.</p>
<form id="f" method="post" action="${target}?state=${encodeURIComponent(state)}"><input type="hidden" name="manifest" value="${esc(JSON.stringify(manifest))}"><button>Continue to GitHub</button></form>
<script>document.getElementById("f").submit()</script></body>`;
}

function keychainRead() {
  try {
    const out = execFileSync("security", ["find-generic-password", "-s", KEYCHAIN.service, "-a", KEYCHAIN.account, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    return JSON.parse(Buffer.from(out, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function keychainWrite(creds) {
  const value = Buffer.from(JSON.stringify(creds)).toString("base64");
  execFileSync("security", ["add-generic-password", "-U", "-s", KEYCHAIN.service, "-a", KEYCHAIN.account, "-w", value], { stdio: "ignore" });
}

async function create(org) {
  if (keychainRead()) {
    console.error(`An App is already saved in the Keychain ("${KEYCHAIN.service}"). Delete it first if you mean to make a new one.`);
    process.exit(1);
  }
  const base = JSON.parse(readFileSync(join(HERE, "github-app.json"), "utf8"));
  const state = randomBytes(16).toString("hex");
  const manifest = buildManifest(base, `http://localhost:${PORT}/callback`);
  await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      if (url.pathname === "/") {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(startPage(org, manifest, state));
        return;
      }
      if (url.pathname !== "/callback") { res.writeHead(404).end(); return; }
      if (url.searchParams.get("state") !== state) { res.writeHead(400).end("State didn't match: start again."); return; }
      const code = url.searchParams.get("code");
      try {
        const r = await fetch(`https://api.github.com/app-manifests/${encodeURIComponent(code)}/conversions`, { method: "POST", headers: { accept: "application/vnd.github+json" } });
        if (r.status !== 201) throw new Error(`GitHub answered ${r.status}: ${(await r.text()).slice(0, 200)}`);
        const c = await r.json();
        vercelVars(c); // checks every field is there before saving anything
        keychainWrite({ id: c.id, slug: c.slug, client_id: c.client_id, client_secret: c.client_secret, webhook_secret: c.webhook_secret, pem: c.pem, owner: c.owner?.login ?? null, html_url: c.html_url });
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<body style="font-family:system-ui;margin:3rem"><h1>Done</h1><p>The App <b>${c.slug}</b> exists, and its keys are in your Keychain. You can close this tab.</p></body>`);
        console.log(`Created GitHub App "${c.slug}" (id ${c.id}) under ${c.owner?.login ?? "your account"}: ${c.html_url}`);
        console.log(`Its credentials are in the Keychain ("${KEYCHAIN.service}"). Next: node infra/github-app.mjs push-to-vercel`);
        server.close();
        resolve();
      } catch (e) {
        res.writeHead(500).end("Something went wrong: see the terminal.");
        server.close();
        reject(e);
      }
    });
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Opening http://localhost:${PORT}/ (GitHub's Create page for ${org ? `the ${org} organization` : "your account"})…`);
      spawnSync("open", [`http://localhost:${PORT}/`]);
    });
  });
}

function pushToVercel(dir, replace) {
  const creds = keychainRead();
  if (!creds) { console.error("No App in the Keychain yet: run create first."); process.exit(1); }
  const vars = vercelVars(creds);
  const existing = spawnSync("vercel", ["env", "ls", "production"], { cwd: dir, encoding: "utf8" });
  if (existing.status !== 0) { console.error(`vercel env ls failed in ${dir}: is it linked to forge-app (vercel link)?\n${existing.stderr}`); process.exit(1); }
  for (const [name, value] of Object.entries(vars)) {
    const has = new RegExp(`^\\s*${name}\\s`, "m").test(existing.stdout);
    if (has && !replace) { console.log(`${name}: already set, left alone (--replace to overwrite)`); continue; }
    if (has) spawnSync("vercel", ["env", "rm", name, "production", "-y"], { cwd: dir, stdio: "ignore" });
    const r = spawnSync("vercel", ["env", "add", name, "production"], { cwd: dir, input: value, encoding: "utf8" });
    console.log(`${name}: ${r.status === 0 ? "added" : `failed (${(r.stderr || "").trim().split("\n").pop()})`}`);
  }
  console.log("Redeploy production for the app to pick them up.");
}

function status() {
  const c = keychainRead();
  if (!c) { console.log("No App in the Keychain."); return; }
  console.log(`App "${c.slug}" (id ${c.id}), owner ${c.owner ?? "?"}: ${c.html_url}`);
  console.log(`Saved: ${Object.keys(vercelVars(c)).join(", ")} (values not shown)`);
}

// No top-level await: the tests load this file through a transform that doesn't allow it.
async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flag = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : undefined; };
  if (cmd === "create") await create(flag("--org") ?? "brazework");
  else if (cmd === "push-to-vercel") pushToVercel(flag("--dir") ?? process.cwd(), rest.includes("--replace"));
  else if (cmd === "status") status();
  else console.log("usage: node infra/github-app.mjs create [--org brazework] | push-to-vercel [--dir <linked dir>] [--replace] | status");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
