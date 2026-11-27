# Handoff

## Current

**From DevOps, 2026-11-27.** Design: `.10x/decisions/devops/ship-then-verify.md`.

- Rollback today: Vercel → forge-app → Deployments → the previous production deployment → Instant Rollback. After one, new deployments don't go live until someone promotes them.
- Build order: FIX-81 (faster setup), FIX-314 (verify after deploy and auto-rollback, with a drill), then FIX-315 (fast gate, merge queue off).
- Blocked on people: `VERCEL_TOKEN` repo secret (team FORGE DEV, owned by Ian), Sentry DSN and uptime monitor (FIX-55), and the go-ahead to merge #281, #283 and #280.

## History

(none)
