# Moving the repo into the GitHub organization

`forge-app` lives on Ian's personal account (`ixcoleman123/forge-app`). A personal repo can only have one admin, so Josh can push but can't manage secrets, apps or branch rules. Moving it into the organization **[github.com/brazework](https://github.com/brazework)** makes both founders Owners. Linear: **FIX-54**. It takes about 15 minutes, and either side can undo it.

Nothing in the code points at the old address, so no code changes. GitHub redirects the old URLs, issues, PRs and git remotes to the new place automatically.

## 1. Before (check every box)

- [ ] **Ian is an Owner of the organization.** Accept the invite at github.com/orgs/brazework/invitation. Only someone who can create repos in the organization can transfer one into it.
- [ ] **main is green, and no PRs are open.** Nobody pushes during the move.
- [ ] **Write down the repo's secret and variable names**, if any (forge-app → Settings → Secrets and variables → Actions). The workflows use these:
  - **secrets:** `VERCEL_TOKEN`, `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` for the preview deploy, and `LINEAR_API_KEY` for the Linear sync;
  - **variables:** `LINEAR_LINK_COMMITS`.

  As of 2026-11-10 none of the preview secrets seem to be set. **The preview deploy has skipped itself on every run since at least Nov 9** (its log says "Preview deploy skipped"), so forge-preview-eight.vercel.app isn't updated by CI. Production isn't affected: Vercel's GitHub app deploys it. After the move Josh is an Owner and adds them in step 3.
- [ ] **CI fits the free organization's Actions minutes** (2,000 a month for private repos). Done in commit 83d02a0: a push costs about 12 minutes.

## 2. The move (Ian, about 10 minutes)

1. **Transfer:** github.com/ixcoleman123/forge-app → Settings → General → Danger Zone → **Transfer ownership** → New owner: `brazework` → type `ixcoleman123/forge-app` to confirm.
2. **Vercel** (team FORGE DEV → project `forge-app` → Settings → **Git**):
   - If the connected repository shows `brazework/forge-app`, you're done.
   - If it shows disconnected:
     1. Click **Connect Git Repository**.
     2. When GitHub asks, install the **Vercel** app on the `brazework` organization, with access to **only** `forge-app`.
     3. Pick `brazework/forge-app` and keep **Production Branch: `main`**.
     4. Root Directory stays `web`.
3. **Secrets:** brazework/forge-app → Settings → Secrets and variables → Actions. Anything from step 1 should have come across. Josh (now an Owner) adds the preview's three:
   - `VERCEL_ORG_ID` = `team_207x62MUAiJcoGe88BduMqkq` and `VERCEL_PROJECT_ID` = `prj_n2GVu4ZFBawo9NA0y6eWSoThtZyD`. These are the preview project's IDs from `web/.vercel/project.json`. They're IDs, not secrets.
   - `VERCEL_TOKEN`: Josh makes a new one at vercel.com/account/tokens (scope: his team), then pastes it straight into the secret.
   - Never paste a token into a chat.

## 3. After (Josh runs the check)

```bash
git remote set-url origin https://github.com/brazework/forge-app.git
bash .github/scripts/check-org-move.sh
```

The script checks five things:
- the repo is at `brazework/forge-app`;
- you're an admin;
- the secrets are present;
- your remote points at the new place;
- the latest push to `main` ran CI and the preview deploy (and didn't skip it), and Vercel deployed production.

Anything marked ❌ says what to fix. Then:

1. Run Actions → **Web** → **Run workflow** once, and push one small change to `main`. Check that CI runs and Vercel deploys production from `brazework/forge-app`.
2. **Josh (now an Owner)** can add `LINEAR_API_KEY` (FIX-5), and install Linear's GitHub integration on the organization.
3. Update the docs that say "Ian's personal account": README, CONTRIBUTING, docs/accounts.md and CLAUDE.md.

## Undo

An organization Owner transfers the repo back to `ixcoleman123` the same way, then reconnects Vercel as in step 2. The database, the live app and Linear aren't touched either way.
