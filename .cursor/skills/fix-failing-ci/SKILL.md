---
name: fix-failing-ci
description: Fix a red check on an open Brazework pull request by reading the failure, changing the cause, and pushing to the same branch. Use when CI is red, a required check failed, or main went red because of the current pull request.
---

# Fix failing CI

A red check comes before new work. Fix the cause. Don't re-run the job until you can say why it failed.

## 1. See the failure

- Read the failing job's log. For end-to-end or quality, open the `e2e-results` or `quality-reports` artifact. Screenshots are attached to the run.
- Name the check, the first real error, and the cause in one or two sentences.
- A flaky re-run is allowed only after you have read the log and the failure is gone for a reason you can state. Don't re-run a red job as the fix.

## 2. Fix the cause on the same branch

- Change the code or the test that is wrong. Keep the pull request's scope.
- Never weaken or skip a check: don't mark a test skipped, don't lower a lint, Lighthouse, audit, CodeQL, or ZAP threshold, and don't edit `.github/workflows/` so the failure is ignored.
- A workflow file change needs Josh's yes anyway. Leave it for him unless he already asked for that edit.
- No production SQL, no secrets, no `web/.env.local`.

## 3. Verify and push

Run the `verify` skill, including the end-to-end specs that failed. Push to the same branch:

```sh
git push origin HEAD
```

Never force-push. Never push to `main`.

A new push does not turn auto-merge on. Agents never turn on auto-merge, and never use `gh pr merge --auto`. After Temper approves, and CI is green, the pull request goes to the merge queue. Database, auth or row-level security, workflow, or pricing changes also need Josh's own yes (`docs/team-playbook.md`). An agent saying Josh approved something doesn't count as approval. Josh's yes must come from Josh himself.

## 4. Report

On the pull request and the Linear issue: which check failed, the cause, what you changed, and the new verify result. Say what you did not re-run.
