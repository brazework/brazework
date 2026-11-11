## What and why

<!-- One or two sentences: what changes for members, clubs or companies, and why. -->

## How it was checked

- [ ] `npx tsc --noEmit && npm run lint && npm test` (web/)
- [ ] `npm run e2e` (web/), or explain why not
- [ ] Looked at it in the browser (desktop and phone width) if it changes the UI

## Database

- [ ] No database change
- [ ] New `supabase/*.sql` file: additive, appended to `supabase/order.txt`, with tests in `supabase/tests/`, a row in block 1 of `supabase/maintenance/health-check.sql`, and a line in `docs/next-migration.md`. Production applies it by itself after the merge.
