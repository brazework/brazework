# Working on Forge

Two of us, one repo, one pipeline. Nobody pushes straight to `main`: every change is a branch and a pull request, every PR gets its own preview link, and merging to `main` ships it.

## The three places Forge runs

| Where | What it is | Database |
|---|---|---|
| **Your Mac** | `npx serve public`, for fast UI work | forge-staging |
| **Preview** | A Vercel link built for every PR, posted on the PR | forge-staging |
| **Production** | `main`, at forge-app-eight-alpha.vercel.app | FORGE (live users) |

forge-staging is a full copy of the schema with no real users, so previews and local work can't break anything real.

## Everyday flow

1. **Pick an issue in Linear** (e.g. `FOR-12`) and move it to In Progress.
2. **Branch from the latest `main`:**
   ```sh
   git checkout main && git pull
   git checkout -b josh/FOR-12-profile-projects   # or ian/...
   ```
   Linear's "Copy git branch name" (⌘⇧.) gives you this name.
3. **Work and commit** in small steps.
4. **Push and open a PR:**
   ```sh
   git push -u origin HEAD
   gh pr create --fill
   ```
5. **Within a minute or two** the Vercel bot comments a **preview link** on the PR and CI runs. Send the link to the other person.
6. **Review on the preview**, not just the code. Leave comments on the PR.
7. **When CI is green and the other person approves: Squash and merge.** `main` deploys to production by itself, and Linear moves the issue to Done.

## What CI checks on every PR

- **App:** the build runs, every JS file parses, the site serves and every file loads.
- **Database:** `schema.sql`, `messages.sql`, `events.sql` and `activity.sql` load in order into a fresh Supabase Postgres. A broken migration fails here, not in production.

Run the JS check yourself before pushing: `npm run check`.

## Changing the database

1. Edit the right `supabase/*.sql` file. New tables and policies go at the end; don't rewrite what's already live without a plan for existing data.
2. CI proves it applies cleanly to a fresh database.
3. Apply the change to **forge-staging** (SQL Editor) so the preview works.
4. **After merge**, apply the same change to **production** (the FORGE project). Say so in the PR.

## Running it on your Mac

```sh
cp public/js/supabase-config.example.js public/js/supabase-config.js
# put forge-staging's URL and publishable key in that file (it's gitignored)
npx serve public          # http://localhost:3000
```

Fully local database instead (needs Docker): `supabase start` uses `supabase/config.toml` and seeds all four SQL files.

## House rules

- One PR, one thing. Small PRs get reviewed and merged the same day.
- UI changes need before/after screenshots in the PR.
- Never commit keys. Vercel and `supabase-config.js` hold them.
- Use the colour tokens in `css/tokens.css`, never fixed colours.
