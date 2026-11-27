# Ship Bot: push and it ships

Linear FIX-316, part of FIX-313 (ship then verify).

Push a branch and it ships: Ship Bot opens the pull request if there isn't one and turns auto-merge on. The required checks then merge it, Vercel deploys it and the database steps apply themselves. Nobody runs `gh pr create` or `gh pr merge`.

```
git push origin fix-30-short-topic
  → Ship Bot opens the PR (title: the branch's first commit) with auto-merge on
  → required checks pass → merged → Vercel deploys → database steps apply
```

## What it won't ship

| Case | What happens | How to ship it anyway |
|---|---|---|
| Branch named `wip/…` | Nothing: back up half-done work here | Rename the branch, or open the PR yourself |
| `dependabot/…`, `cursor/…`, `codex/…` | Nothing: those keep their own review rules | Merge by hand |
| Draft pull request | Auto-merge stays off | Mark it ready for review |
| `hold` label | Auto-merge turned off, now or whenever the label is added | Remove the label |
| Changes `.github/` or `infra/` | Opens the PR, leaves auto-merge off and says why on the PR, once | `gh pr merge <n> --auto --squash` after a look |
| The branch's last PR was closed without merging | Nothing: someone closed it on purpose | Reopen it |

Change the skipped branches with the repository variable `SHIP_BOT_SKIP` (space-separated globs; replaces the default `wip/* dependabot/* cursor/* codex/*`).

## Why a GitHub App

GitHub Actions' own token can't do this job: a pull request it opens doesn't start CI, and a merge it enables doesn't start `main`'s workflows. The database steps and the Linear sync would quietly stop running. An App's token doesn't have that limit.

## Set it up (once, an owner of the `brazework` GitHub organization, about 5 minutes)

1. Go to github.com → the `brazework` organization → Settings → Developer settings → GitHub Apps → **New GitHub App**.
   - Name: `Brazework Ship Bot`. Homepage: `https://brazework.com`.
   - Webhook: untick **Active**.
   - Repository permissions: **Contents: Read and write**, **Pull requests: Read and write**. Metadata stays Read-only. Nothing else.
   - Where can this App be installed: **Only on this account**. Create it.
2. On the App's page, note the **App ID**, then **Generate a private key** (a `.pem` downloads).
3. **Install App** → `brazework` → Only select repositories → `brazework`.
4. Add the two secrets, then delete the `.pem`:
   ```sh
   gh secret set SHIP_BOT_APP_ID -R brazework/brazework          # paste the App ID
   gh secret set SHIP_BOT_PRIVATE_KEY -R brazework/brazework < ~/Downloads/brazework-ship-bot.*.private-key.pem
   rm ~/Downloads/brazework-ship-bot.*.private-key.pem
   ```
5. Check: push a small branch. Actions → Ship Bot should open its PR with auto-merge on.

Until the secrets are set, every run says "Ship Bot is off" and passes.

## How it breaks

| Failure | Signal | Fix |
|---|---|---|
| Private key leaked | — | Revoke it on the App's page, generate a new one, `gh secret set` again |
| App uninstalled or permissions cut | Ship Bot runs fail on "Open the pull request" | Reinstall with the permissions above |
| Something half-done ships | It's on production | Revert it (or let FIX-314's check after deploy roll it back). Use `wip/` next time |
| Undo the whole thing | — | Delete the two secrets: the bot goes quiet. Everything else works as before |

Code: `.github/workflows/ship-bot.yml`, `.github/scripts/ship-bot.mjs`; tests in `web/tests/ship-bot.test.ts`.
