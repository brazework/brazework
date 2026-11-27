# Verify after deploy (runbook)

Linear FIX-314, part of FIX-313 (ship then verify). Code: `.github/workflows/verify.yml`, `.github/scripts/verify-deploy.mjs`; tests in `web/tests/verify-deploy.test.ts`.

## What happens on every merge

```
merge to main ──► Vercel deploys it (~1–2 min)
              └─► Web (Next.js) runs the full check: build, unit tests, every journey (~6 min)
                    └─► Verify after deploy
                          green → commit marked production/verified (promoted if production is behind)
                          red   → production back on the newest verified commit, revert PR (label "hold"),
                                  Linear issue "Production rolled back: …", red run (GitHub emails us)
```

The full check never runs against production: every journey uses its own local stack on the runner. Only the build and end-to-end jobs decide. A cancelled run does nothing.

Rolling back only moves the app. Database steps stay applied, which is safe because steps only add. **A step that drops or renames something the live app uses breaks this:** expand, deploy, then contract in a later step.

## When production was rolled back

1. Open the Linear issue or the red run: it names the commit, the failing journey and what it did.
2. Fix forward (a new PR) or merge the revert PR. The `hold` label keeps the revert from merging itself; remove it to let it go.
3. The next commit that passes verify is promoted by itself, and production is back on the newest code.

Until then Vercel leaves production where it is. After an instant rollback, new deployments still build but don't go live until one is promoted. That's what keeps a commit built on the broken one off production.

## Setup (once)

1. Create a Vercel token with access to team **FORGE DEV** (vercel.com → Account Settings → Tokens; Ian owns the team). Add it as the `VERCEL_TOKEN` repository secret:
   ```sh
   gh secret set VERCEL_TOKEN -R brazework/brazework
   ```
   The nightly drift check (`infra-drift.yml`) uses the same secret.
2. Dry-run it against production's real state (it reads, changes nothing): Actions → **Verify after deploy** → Run workflow → the newest commit on `main`, mode `dry-run`, verdict `red`. The summary says which commit production serves and what it would roll back to.
3. Mark the commit production is serving as known-good, so the first red has somewhere to go back to: Run workflow → that commit's SHA, mode `mark-verified`. After that, every green run marks its own commit.

Without `VERCEL_TOKEN` it still marks commits and fails on red (and GitHub emails us), but it can't touch production. Roll back by hand: Vercel → forge-app → Deployments → the last good one → Instant Rollback.

## The drill (do once after setup, then each quarter)

1. Open a PR that breaks one journey on purpose (for example, change a button label a journey clicks). Mark it with the `drill` label so nobody is surprised.
2. Merge it. Note the time.
3. Expect, within ~6 minutes of the merge: production back on the previous commit (Vercel → Deployments shows the rollback), a revert PR labelled `hold`, a Linear issue, and a red "Verify after deploy" run.
4. Merge the revert. The next green run promotes it and production is current again.
5. Write the times in FIX-314 (or a new drill issue).

## How it breaks

| Failure | Signal | What to do |
|---|---|---|
| `VERCEL_TOKEN` expired or lost access | Verify runs fail with `Vercel GET …: 401/403` | New token, `gh secret set VERCEL_TOKEN` |
| No verified commit in the last 50 | "no verified deployment to go back to" | Roll back by hand, then `mark-verified` the good commit |
| A journey is flaky | Production rolled back for nothing | Fix the flake first: a flaky suite makes ship-then-verify noisy. Re-run the Web run; a green re-run promotes the commit |
| The bad commit changed a workflow | "Revert pull request: skipped" | Revert by hand (this job's token can't push workflow files) |
| Turn it off | — | Disable the workflow (Actions → Verify after deploy → ⋯ → Disable). Merging stays as it is |
