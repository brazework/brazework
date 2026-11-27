# Status

Updated 2026-11-27.

## DevOps

- **Ship then verify** (FIX-313): decided, rollout not started. Next: merge #281 → #283 and #280, then the safety net (FIX-55, `VERCEL_TOKEN`).
- Deploys today: Vercel deploys `main` (team FORGE DEV, project `forge-app`); database steps apply themselves via `db-migrate.yml` (staging, then production).
