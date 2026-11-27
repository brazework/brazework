---
name: verify
description: Run the local checks from web/ (tsc, lint, unit tests, and the end-to-end specs the change touches) and report what passed, failed, and was not run. Use before every push and when a pull request needs its check results.
---

# Verify

Run the checks below from `web/`. Stop at the first failure. Report every command, including the ones you did not run. Never point a command at production or at `web/.env.local`. Never add a skip flag, delete a test, or edit a workflow to get a pass.

## 1. Types, lint, unit tests

```sh
cd web
npx next typegen
npx tsc --noEmit && npm run lint && npm test
```

CI runs `npx next typegen` and then `npx tsc --noEmit` (`.github/workflows/web.yml`). On a fresh checkout, typegen has to come first so the generated `PageProps` and `RouteContext` types exist. Don't commit what typegen writes. If `npx tsc --noEmit` fails before typegen, report that, run typegen, and run tsc again. A missing generated type is not a reason to edit app code.

Run lint and unit tests only after tsc passes. If one command fails, stop and report it.

## 2. End-to-end specs the change touches

The suite is the `e2e/*.cjs` files listed in `web/e2e/run.sh`. The documented command is:

```sh
cd web
npm run e2e
```

It needs Docker and Chrome. It builds a private database and never reads `web/.env.local`.

- When the diff touches a page, member data, auth, or `supabase/`, run `npm run e2e`. In the report, name the spec files that cover the change.
- A single `node e2e/<file>.cjs` only works once that same local stack and app server are up. Prefer `npm run e2e` unless the stack is already up and you know that spec talks to it.
- When the diff is docs or agent config only, and it touches no app, database, or e2e file, do not start the suite. Say that, and why.

When the change touches layout, scripts, or headers, also run `npm run quality` from `web/` (Lighthouse budgets and the OWASP ZAP scan).

## 3. Report

Use this shape:

- `npx tsc --noEmit`: pass or fail. On fail, the first error.
- `npm run lint`: pass or fail. On fail, the first error.
- `npm test`: pass or fail. On fail, the failing test name.
- End-to-end: command, pass or fail, or not run and why. Name the specs the change touches.
- `npm run quality`: pass, fail, or not run and why.
- Production: not used. `web/.env.local` was not opened.

Put this report in the pull request body under what was tested and what was not.
