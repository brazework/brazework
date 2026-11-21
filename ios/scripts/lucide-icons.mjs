#!/usr/bin/env node
// The web's Lucide icons as template vector images for the iPhone app (Forge/Design/Icons.swift).
// Reads the Lucide names from Icons.swift's `twin` table and the drawings from the web's own
// lucide-react, so both apps show the same icon at the same version. "name.fill" is the filled
// variant (a liked heart, a saved bookmark, play). From ios/: node scripts/lucide-icons.mjs
import fs from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const ios = path.resolve(here, "..");
const lucide = path.resolve(ios, "../web/node_modules/lucide-react/dist/esm/icons");
const out = path.join(ios, "Forge/Resources/Assets.xcassets/Lucide");
const table = fs.readFileSync(path.join(ios, "Forge/Design/Icons.swift"), "utf8").split("static let twin")[1].split("]\n")[0];
const wanted = [...new Set([...table.matchAll(/:\s*"([a-z0-9.-]+)"/g)].map((m) => m[1]))].sort();

if (!fs.existsSync(lucide)) { console.error(`No lucide-react at ${lucide}: run npm ci in web/ first.`); process.exit(1); }
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "Contents.json"), JSON.stringify({ info: { author: "xcode", version: 1 } }, null, 2) + "\n");

const attr = (o) => Object.entries(o).filter(([k]) => k !== "key").map(([k, v]) => `${k.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase())}="${v}"`).join(" ");
const missing = [];
for (const name of wanted) {
  const filled = name.endsWith(".fill");
  const icon = filled ? name.slice(0, -5) : name;
  const file = path.join(lucide, `${icon}.mjs`);
  if (!fs.existsSync(file)) { missing.push(icon); continue; }
  // Renamed icons re-export the new name (trash-2 → trash): follow it.
  const alias = fs.readFileSync(file, "utf8").match(/export \{ default \} from '\.\/(.+)\.mjs'/)?.[1];
  const { node } = (await import(alias ? path.join(lucide, `${alias}.mjs`) : file)).__iconData;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${filled ? "#000" : "none"}" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${node.map(([tag, a]) => `<${tag} ${attr(a)}/>`).join("")}</svg>\n`;
  const asset = `lc.${name}`;
  const dir = path.join(out, `${asset}.imageset`);
  fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, `${asset}.svg`), svg);
  fs.writeFileSync(path.join(dir, "Contents.json"), JSON.stringify({ images: [{ filename: `${asset}.svg`, idiom: "universal" }], info: { author: "xcode", version: 1 }, properties: { "preserves-vector-representation": true, "template-rendering-intent": "template" } }, null, 2) + "\n");
}
if (missing.length) { console.error(`Not in lucide-react: ${missing.join(", ")}`); process.exit(1); }
console.log(`${wanted.length} icons from lucide-react ${JSON.parse(fs.readFileSync(path.resolve(lucide, "../../../package.json"), "utf8")).version}`);
