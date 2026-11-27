# Ship then verify

Status: **decided 2026-11-27 (Josh)**, rollout not started. Linear: FIX-313 (parent), FIX-81, FIX-314, FIX-315; prerequisites FIX-309, FIX-310, FIX-311, FIX-55.

## Problem

From PR open to live took 40–60 minutes. The e2e suite (51 browser journeys, run one after another) took ~20 min and ran three times per change: on the PR, in the merge queue, and on the push to `main`. Measured on run 46024574177: setup ~2.5 min (npm ci 46 s, local Supabase 56 s, build 46 s), SQL tests 7 s, browser journeys ~17 min.

Sharding (FIX-311, #283) brings one run to ~6 min. With the merge queue that is still ~12–15 min to live. The team wants faster.

## Decision

Production may receive a commit before the full browser suite has passed, provided a failure rolls production back by itself.

```
PR ──► Fast gate (~3–4 min, required)
        typecheck · lint · unit · build · SQL rule tests · ~6 must-not-break journeys
   ──► merge (merge queue off) ──► Vercel deploys          ← live in ~5–6 min
   ──► Verify on main (~4 min): all journeys, sharded, on a local stack (never production)
        red → production back to the last verified deployment, a revert PR, a Linear issue
   ──► Watching production: Sentry, uptime, nightly drift
```

## Why this is safe here

- **Database steps only add.** The app runs against the database before and after each step (`web/src/lib/db-features.ts`), so rolling the app back never needs a database rollback. This rule is now load-bearing: a step that drops or renames something the live app uses breaks rollback. Expand, deploy, then contract in a later step.
- **Vercel Pro instant rollback** swaps production back in seconds.
- **The full suite still runs on every commit**, just after the deploy instead of before.

## Options considered

| | PR → live | Risk | Effort |
|---|---|---|---|
| **A. Ship then verify (chosen)** | ~5–6 min | A bad commit is live up to ~5 min before rollback | ~2–3 days over 4 PRs |
| B. Full suite gates, no merge queue, faster setup | ~8–10 min | Nothing untested reaches production | ~1 day |
| C. Playwright runner rewrite, isolated tests | ~5 min gated | Lowest | Weeks (52 specs) |
| D. Run only tests affected by the change | varies | Missed dependencies slip through silently | Medium, fragile |

B's setup speedups are part of A anyway (FIX-81).

## Rollout (each step its own PR, each undone by reverting it)

0. Merge #281 (FIX-309), #283 (FIX-311), #280 (FIX-310).
1. Safety net: Sentry DSN and an uptime monitor (FIX-55); `VERCEL_TOKEN` repo secret for team FORGE DEV.
2. FIX-81: Postgres image with every step applied (GHCR, keyed on a hash of `supabase/`), one app build shared by every shard. Full suite target < 3.5 min.
3. FIX-314: `verify.yml` on push to `main`. Green records the deployment as last verified (and promotes it if production is rolled back). Red rolls back to the last verified deployment, opens a revert PR and a Linear issue. Proven by a drill.
4. FIX-315: `Fast gate` becomes the required check; merge queue off; docs updated. Only after 1 and 3 are live.

## Rollback of this design

Put `End-to-end (database rules + browser journeys)` back as the required check and turn the merge queue back on (GitHub settings, a person does it). `verify.yml` can stay; it only adds safety.

## Risks

- **Bad commit live for ~5 min.** The fast gate covers the journeys where that would hurt most.
- **Two merges close together.** Rollback goes to the last *verified* deployment; a good commit on top of a bad one waits for its own verify.
- **Vercel freezes auto-promotion after an instant rollback.** `verify.yml` promotes the next green deployment, so production never stays stuck.
- **Tests never run against production**: journeys write data. Verify runs on a local stack for the same commit.
