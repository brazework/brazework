# Docs

## Start here

- [plan.md](plan.md): what's built, phase by phase (✅ / 🟡 / ⬜), and the decisions behind it.
- [yc-readiness.md](yc-readiness.md): built and tested, not built yet, and what needs the real world.
- [demo.md](demo.md): the 3-minute demo of the loop, on local demo data.

## Running it

- [launch.md](launch.md): turning it on in production, in order (database, test data, admins, schools, keys, checks).
- [next-migration.md](next-migration.md): every database step with a one-line description. The order itself is [`supabase/order.txt`](../supabase/order.txt).
- [../CONTRIBUTING.md](../CONTRIBUTING.md): how we ship (checks, tests, migrations, secrets) and the switch to pull requests when the team grows.
- [data-model.md](data-model.md): the tables and how they relate.
- Database checks: [`supabase/maintenance/health-check.sql`](../supabase/maintenance/health-check.sql) (read-only) and [`remove-test-data.sql`](../supabase/maintenance/remove-test-data.sql).

## Product and business

- [strategy.md](strategy.md): who pays, go-to-market (starting with NSBE at UHart), what YC wants to see.
- [positioning.md](positioning.md): market research with sources.
- [naming.md](naming.md): the rename shortlist (Signet recommended, pending a trademark check).

## History

- [current-state.md](current-state.md): the codebase map from 2026-11-09, before the nine-phase build. Kept for reference; plan.md is current.
