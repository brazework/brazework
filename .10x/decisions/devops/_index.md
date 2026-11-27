# DevOps decisions

## Active

| Slug | What | Status |
|---|---|---|
| [ship-then-verify](ship-then-verify.md) | Fast gate before merge, full suite after deploy, auto-rollback. PR to live in ~5–6 min | Decided 2026-11-27, rollout not started (FIX-313) |

## Principles

- **Two people, so the pipeline is the reviewer.** Prefer automation that fails loudly over process that needs a second person.
- **Boring tools we already run:** GitHub Actions, Vercel, Supabase, Linear. No new platform without a measured reason.
- **Database steps only add.** It is what makes app rollback safe. Expand, deploy, contract.
- **Never test against production.** Every e2e run uses its own local stack.
- **Every change has an undo** written down before it ships.
- **The repo is public:** standard GitHub runners don't count against Actions minutes, so parallel jobs are cheap. Recheck if it goes private.
