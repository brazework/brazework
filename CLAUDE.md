# Notes for Claude in this repo

How we work is in [CONTRIBUTING.md](CONTRIBUTING.md); the docs index is [docs/README.md](docs/README.md). Read both first.

## Working from the board

The Linear connection is in `.mcp.json`; the first use asks each person to sign in to Linear once. Three skills run the workflow:

- `/next` works the next issue end to end: it picks the lowest open step whose blockers are done, builds, tests, ships, updates and closes it. `/next FIX-30` works that issue.
- `/ship` does the safe release path: checks, a commit with the issue ID on a branch, a pull request with auto-merge, watch CI until it merges, report on the issue.
- `/standup` reports shipped, in progress, next, blocked and CI. `/standup post` also writes each project's weekly update.

## Keep Linear in step (team Forge, key `FIX`)

- Before starting a piece of work, look for its Linear issue. If there isn't one and the work is bigger than a quick fix, create it in the right project with a Type label, an owner and a milestone.
- Start commit subjects with the issue ID (`FIX-30: Lighthouse budget in CI`). Add a `Fixes FIX-30` line when the commit finishes it.
- Commits with no issue ID are logged in Linear as Done issues by `.github/workflows/linear-sync.yml`, so nothing goes untracked. A linked commit still reads better than an auto-logged one.
- When an issue's plan changes, update the issue (a comment or the description), not just the code.

## Ground rules

- `web/.env.local` points at production. Never run tests or scripts that write against it; use the local stack (`web/e2e/local-supabase.sh up`, `npm run e2e`, `npm run quality`).
- `main` is protected: changes go in through a pull request that merges itself when the required checks pass (`CONTRIBUTING.md`). Open it only after the local checks pass, and call it done when it has merged and CI on `main` is green.
- Database steps reach production by themselves after the merge (`.github/workflows/db-migrate.yml`). Never run SQL against production by hand from a session.
- Never commit `public/js/supabase-config.local.bak` or `scripts/check.mjs`.
