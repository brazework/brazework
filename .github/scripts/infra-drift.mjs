// The nightly drift check (.github/workflows/infra-drift.yml, Linear FIX-131). The workflow runs
// infra/check.mjs read-only; when it finds drift (exit 1), this files or updates one "Infra drift"
// issue in Linear with the differences, so a dashboard change nobody recorded is seen by morning.
//
// Run by hand:  node .github/scripts/infra-drift.mjs <file with check.mjs's output>
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { fileOrComment } from "./linear-issue.mjs";

export const TITLE = "Infra drift: production differs from infra/desired.json";

/** The issue text: what drifted, and the two ways to resolve it. */
export function driftBody(output, runUrl = "") {
  return [
    "Production no longer matches `infra/desired.json` (the nightly check, FIX-131).",
    "",
    "- **Changed on purpose?** Run `node infra/check.mjs --capture` and commit the `infra/desired.json` diff in a PR.",
    "- **Not on purpose?** Put the setting back in the dashboard. The next run passes once production matches.",
    "",
    "```",
    output.trim(),
    "```",
    ...(runUrl ? ["", `[The run](${runUrl})`] : []),
  ].join("\n");
}

async function main() {
  const path = process.argv[2];
  if (!path) throw new Error("Pass the file holding infra/check.mjs's output.");
  const run = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";
  await fileOrComment({ prefix: "Infra drift", title: TITLE, body: driftBody(readFileSync(path, "utf8"), run) });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
