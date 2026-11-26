# Docs

## Start here

- [today.md](today.md): **Brazework today (26 Nov).** What it is, everything that's live, who pays, how it runs, and what's next, on one page. Start here.
- [overview.md](overview.md): **Brazework in plain language.** What it is, how it works, how we know it's working, where everything lives. For anyone.
- [architecture.md](architecture.md): **the technical version.** System diagram, tech stack, code map, security model, environments, delivery. For engineers.
- [plan.md](plan.md): what's built, phase by phase (✅ / 🟡 / ⬜), and the decisions behind it.
- [mcp-workflows.md](mcp-workflows.md): **your tools fill in your record.** Set up an AI assistant with Brazework in 2 minutes, the slash commands, drafts and GitHub Actions, signatures, and a section for each of the 20 fields.

## The company

- [strategy.md](strategy.md): who pays, go-to-market (starting with NSBE at UHart), what YC wants to see.
- [pilot-adopt-a-project.md](pilot-adopt-a-project.md): the four-week, no-code pilot that decides whether "adopt a project" gets built.
- [positioning.md](positioning.md): market research, with sources.
- [naming.md](naming.md): the new name, Brazework (pending a trademark check), with what was checked and the fallbacks.
- [accounts.md](accounts.md): every account and service we run on, who owns it, what it costs, and what's missing (including the company itself).
- [yc-readiness.md](yc-readiness.md): built and tested, not built yet, and what needs the real world.
- [demo.md](demo.md): the 3-minute demo of the loop, on local demo data.

## Running it

- [operating.md](operating.md): **running the company week to week.** Shipping, testing the school side, demos and the Reel, the weekly rhythm, and what to watch.
- [demo-university.md](demo-university.md): a whole demo school (dean, professor, students, a capstone course) for sales calls, locally today and hosted once there's a domain.
- [launch.md](launch.md): the launch runbook for Sunday, November 22 (past; kept for the checklists). What's live, what only a founder can do, the days before and after, go/no-go checks, rollback, and every launch link in one list.
- [product-hunt.md](product-hunt.md): the Product Hunt launch kit (tagline, first comment, gallery, demo script, answers, launch-day checklist).
- [explainer/](explainer/): the launch pages behind the videos and posts (test script, social plan, explainers) and the social account kit ([explainer/social/](explainer/social/)).
- [next-migration.md](next-migration.md): every database step with a one-line description. The order itself is [`supabase/order.txt`](../supabase/order.txt).
- [github-org-move.md](github-org-move.md): moving the repo into the `brazework` GitHub organization (before, the move, the check script, undo).
- [../infra/README.md](../infra/README.md): production's settings (Supabase, Vercel, DNS) written down in the repo, and `infra/check.mjs`, which reports any drift (read-only).
- [slo.md](slo.md): reliability targets (available and responsive), their error budgets, and what we do when one is spent.
- [automation.md](automation.md): what runs by itself (CI, scans, deploys, Linear sync), what needs a person, and what to add next.
- [data-model.md](data-model.md): the tables and how they relate.
- [../CONTRIBUTING.md](../CONTRIBUTING.md): how we ship (checks, tests, migrations, secrets, Linear), and the switch to pull requests when the team grows.
- [../CLAUDE.md](../CLAUDE.md): working from the Linear board in Claude Code (`/next`, `/ship`, `/standup`).
- Database checks: [`supabase/maintenance/health-check.sql`](../supabase/maintenance/health-check.sql) (read-only) and [`remove-test-data.sql`](../supabase/maintenance/remove-test-data.sql).

## History

- [history.md](history.md): how Brazework got here, week by week from 7 to 26 November, and the decisions that shaped it.
- [current-state.md](current-state.md): the codebase map from 2026-11-09, before the nine-phase build. Kept for reference; plan.md is current.
