# Infrastructure as code (Linear FIX-82)

Production's settings, written down in the repo, and a check that production still matches.

**What's in here**
- `desired.json`: the settings the repo owns.
  - **Supabase:** auth (site URL, redirect list, SMTP, email limits, sign-up rules) and the storage file-size limit.
  - **Vercel `forge-app`:** root directory, the cron job, domains, and env var **names** with their environments.
  - **brazework.com DNS:** the email records.
- `check.mjs`: reads the live settings, compares them with `desired.json`, and prints every difference. **It only reads; it never changes production.**
- `diff.mjs`: the comparison rules, unit-tested in `web/tests/infra-diff.test.ts`.

**Never in here: secrets.** Env vars are recorded by name only. The SMTP password, API keys and tokens stay in Supabase, Vercel and Bitwarden.

## Run it

```sh
SUPABASE_ACCESS_TOKEN=$(…) node infra/check.mjs      # 0 = no drift, 1 = drift, 2 = couldn't read
```

- **Supabase:** a personal access token. Locally, the Supabase CLI login in the macOS keychain.
- **Vercel:** `VERCEL_TOKEN` if set, otherwise the logged-in `vercel` CLI (team `ixcoleman123`).

**Changing a setting on purpose:**
1. Change it in production (the dashboard or the API).
2. Run `node infra/check.mjs --capture`.
3. Review `git diff infra/desired.json`.
4. Commit it in a PR, so the change is recorded and reviewed.

## Why

On 2026-11-12 we changed production by hand: the site URL, the redirect list, SMTP, the email limit and templates, env vars, domains and DNS. None of it was recorded anywhere you could review, repeat or recover from. If someone clicks the wrong thing in a dashboard, nothing tells us. Now `check.mjs` does.

## How it breaks

| Failure | What happens | How you'd notice |
|---|---|---|
| **Someone changes a dashboard** | Production no longer matches the repo | The check prints the setting, the repo value and the live value, then exits 1 |
| **A setting we don't own changes** | Nothing; the repo only compares the keys in `desired.json` | Add the key to `check.mjs` if it should be owned |
| **`--capture` used carelessly** | It records an unwanted change as the desired state | That's why a capture goes through a reviewed PR |
| **A token can't read** | The check can't run | Exit 2; never treated as "no drift" |
| **Vercel's own DNS records change** | Nothing: records Vercel creates itself (`creator: system`) aren't ours | — |

## Next (FIX-82)

1. **Nightly in CI:** a read-only drift check using scoped tokens stored as GitHub secrets, which opens a Linear issue on drift.
2. **Apply from the repo:** a reviewed change to `desired.json` is applied after merge, as `db-migrate.yml` does for SQL. Each apply changes only the keys the repo owns.
