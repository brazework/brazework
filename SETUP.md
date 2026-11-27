# Local setup

How to run Brazework on your computer. The app is the Next.js project in `web/` (Next.js 16.4.5, `web/package.json`).

The GitHub repository is [brazework/brazework](https://github.com/brazework/brazework).

## Prerequisites

- **Node.js 22.** The app needs Node 22, matching CI (`node-version: 22` in `.github/workflows/web.yml`). [CONTRIBUTING.md](CONTRIBUTING.md) asks for Node 22. The version is pinned in `web/package.json` `engines` (`22.x`) once [PR #285](https://github.com/brazework/brazework/pull/285) merges. This repo has no `.nvmrc`.
- **Docker**, running. OrbStack or Docker Desktop. `web/scripts/dev.sh` exits when `docker info` fails. `npm run e2e` needs Docker too.
- **Google Chrome**, for `npm run e2e` (`web/e2e/run.sh`).

## Install

```sh
git clone https://github.com/brazework/brazework
cd brazework/web
npm install
```

CI installs from `web/` with `npm ci` (`.github/workflows/web.yml`), using `web/package-lock.json`.

## Environment

From `web/`, `npm run dev` starts a private database and sets the Supabase URL, anon key, and site URL for that process (`web/scripts/dev.sh`).

Variable names are listed in `web/.env.example`.

`web/.env.local` is production when that file is present. Leave it closed. `npm run dev` sets its own values for the local database. `npm run e2e` uses the private stack in `web/e2e/serve.sh` and does not read `web/.env.local`.

## Run the dev server

From `web/`:

```sh
npm run dev
```

That script starts the local Supabase (`e2e/local-supabase.sh up`) when it is not already up, then runs `npx next dev`. The site is at http://localhost:3000 (`PORT` defaults to 3000 in `web/scripts/dev.sh`). Another port: `PORT=3100 npm run dev`.

Sign in as `maya@forge.test`, `josh@forge.test`, `ben@forge.test`, or `cara@forge.test`. Password: `forge-test-pass-1`. Those are local test members.

Start the database over (test members only):

```sh
npm run dev -- --fresh
```

`npm run dev -- --demo` starts that database over, then loads the demo members (`e2e/demo.sh`).

Stop the local database, from `web/`:

```sh
e2e/local-supabase.sh down
```

`e2e/local-supabase.sh up` applies every step named in `supabase/order.txt`. `supabase/maintenance/` contains `health-check.sql` (read-only), `remove-test-data.sql`, and `advisor-baseline.json`.

## Checks

From `web/`. CI runs the same typecheck, lint, and unit-test commands (`.github/workflows/web.yml`):

```sh
npx next typegen
npx tsc --noEmit
npm run lint
npm test
```

`npm run typecheck` is `next typegen && tsc --noEmit`. `npm test` is `tsx --test tests/*.test.ts`.

End-to-end, still from `web/`:

```sh
npm run e2e
```

That is `bash e2e/run.sh`. It starts the local Supabase, builds the app pointed at it (`e2e/serve.sh`), runs `supabase/tests/*.test.sql`, then the browser specs named in `e2e/run.sh`. It needs Docker and Google Chrome.

Other scripts in `web/package.json`:

| Script | What it runs |
| --- | --- |
| `npm run build` | `next build` |
| `npm start` | `next start` |
| `npm run quality` | `bash e2e/quality.sh` (Docker and Google Chrome) |
| `npm run load` | `bash e2e/load.sh` (Docker) |

The root `package.json` has one script, `build`, which runs `node scripts/build-config.mjs`. Day-to-day local setup uses the scripts in `web/package.json`.

## Where the rules live

- [AGENTS.md](AGENTS.md): how an agent works in this repo, including branch, pull request, and hard rules.
- [docs/team-playbook.md](docs/team-playbook.md): how Rivet, Temper, and Kiln ship, and how agents merge through the merge queue.
- [CONTRIBUTING.md](CONTRIBUTING.md): how Josh and Ian ship, and where code runs (laptop, pull request, production).

## Layout

```
web/                    Next.js app. Scripts in web/package.json. Dev server: web/scripts/dev.sh
web/src/                App routes, server logic, components
web/tests/              Unit tests (npm test)
web/e2e/                End-to-end runner, local Supabase (local-supabase.sh), quality and load
supabase/order.txt      SQL steps, in order. The local stack, CI, and production setup follow this file
supabase/maintenance/   health-check.sql, remove-test-data.sql, advisor-baseline.json
supabase/tests/         SQL rule tests, run by npm run e2e
docs/                   Product and team docs. Index: docs/README.md
scripts/                Root script build-config.mjs (root package.json build)
public/                 Earlier static files, including public/js. Local setup uses web/
ios/                    iPhone app
infra/                  Production settings written down in the repo
AGENTS.md               Agent rules
```
