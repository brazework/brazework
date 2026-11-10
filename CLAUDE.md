# Notes for Claude in this repo

How we work is in [CONTRIBUTING.md](CONTRIBUTING.md); the docs index is [docs/README.md](docs/README.md). Read both first.

## Keep Linear in step (team Forge, key `FIX`)

- Before starting a piece of work, look for its Linear issue. If there isn't one and the work is bigger than a quick fix, create it in the right project with a Type label, an owner and a milestone.
- Start commit subjects with the issue ID (`FIX-30: Lighthouse budget in CI`). Add a `Fixes FIX-30` line when the commit finishes it.
- Commits with no issue ID are logged in Linear as Done issues by `.github/workflows/linear-sync.yml`, so nothing goes untracked. A linked commit still reads better than an auto-logged one.
- When an issue's plan changes, update the issue (a comment or the description), not just the code.

## Ground rules

- `web/.env.local` points at production. Never run tests or scripts that write against it; use the local stack (`web/e2e/local-supabase.sh up`, `npm run e2e`, `npm run quality`).
- Push to `main` only after the local checks pass, and confirm the CI run on your commit is green before calling it done.
- Never commit `public/js/supabase-config.local.bak` or `scripts/check.mjs`.
