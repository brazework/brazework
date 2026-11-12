# Brazework

**Build it. Prove it. Get found.** The verified work network for STEM.

Students post what they build. Their club's officers, who saw the work happen, verify it. Companies find proven builders through that verified work instead of through résumés anyone can write.

> **Brazework** was called Forge until November 2026 ([why the new name](docs/naming.md); the trademark check is still open). Internal names keep the old one: the repo `forge-app`, tables like `forge_admins`, env vars like `FORGE_EMAIL_FROM` and the Linear team "Forge".

## For everyone

**Who it's for**
- **Students:** a profile of real, verified work that follows them into their career. Free, always.
- **Club officers:** one place to run the club (members, events, chat, announcements) and to vouch for members' work. Free, always.
- **Companies and schools:** find builders by verified work, message them, and sponsor challenges clubs compete in. This is where revenue starts.

**How it works**
1. A club joins and invites its members.
2. Members post their projects: updates, photos, video, results.
3. A member asks the club to verify a milestone, with evidence. An officer who saw it happen verifies it, and Brazework records who vouched and when.
4. It shows on the member's profile, and companies find them through it.

**Ember**, the AI helper built in, drafts posts, plans events and finds clubs and people. It never acts on its own: a person always taps Approve.

**Why it matters now:** AI made résumés free to generate. 91% of recruiters have caught candidate deception (Greenhouse, 2025). Work that someone accountable saw happen still carries signal, and today it's buried in group chats and lab notebooks. Research and sources: [docs/positioning.md](docs/positioning.md).

**Read more**
- [Brazework in plain language](docs/overview.md): how it works, how we know it's working, where everything lives
- [Strategy](docs/strategy.md): who pays, go-to-market (starting with NSBE at UHart), the case for YC
- [Accounts and services](docs/accounts.md): everything the company runs on, and what's missing

## Status (November 2026)

- **Built and tested:** the full loop above, plus clubs, events, messages, challenges and sponsorships, Ember, an admin dashboard with retention, and trust and safety. The details are in [docs/plan.md](docs/plan.md).
- **Next:** switch production on (database upgrades, email, AI and payment keys: the *Launch* project in Linear), confirm the name, then pilot with clubs.
- **Site:** https://brazework.com

---

## For engineers

**Stack:** Next.js 16 (App Router, partial prerendering) · React 19 · TypeScript · Tailwind 4 · Supabase (Postgres with row-level security, Auth, Storage, Realtime) · Anthropic (Ember) · Stripe · Resend · Vercel. The iPhone app is SwiftUI on the same backend. Full picture, with a diagram: **[docs/architecture.md](docs/architecture.md)**.

**The one rule:** the database is the security boundary. Every request runs as the signed-in member, and row-level security, column grants and checked functions decide what's allowed.

### Run it locally

```sh
cd web
npm install
e2e/local-supabase.sh up       # a private Supabase in Docker, with test members (password forge-test-pass-1)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY="$(cat e2e/.anon-key)" npm run dev
                               # http://localhost:3000, signed in as e.g. josh@forge.test
e2e/local-supabase.sh down     # when you're done
```

**Careful:** `web/.env.local` points at **production**, so a plain `npm run dev` talks to real member data. Always pass the local values as above (or use forge-staging), and never run tests or scripts that write against production. For a fresh `.env.local`, copy `web/.env.example`.

### Test it (the same commands CI runs)

```sh
cd web
npx tsc --noEmit && npm run lint && npm test   # types, lint, unit tests (~30 s)
npm run e2e        # every database rule + 8 browser journeys on a local Supabase (~8 min; Docker + Chrome)
npm run quality    # Lighthouse speed/accessibility budgets + an OWASP ZAP security scan (~6 min)
npm run load       # k6: 200 members at once + a sign-up burst (~3 min)
```

### Repository

```
web/                    The Next.js app: src/app (routes), src/lib (server logic), src/components
web/tests/              Unit tests
web/e2e/                End-to-end, quality and load tests, plus the local Supabase stack
supabase/*.sql          The database, one additive file per step, run in supabase/order.txt order
supabase/tests/         SQL rule tests (run as real members, rolled back)
supabase/maintenance/   health-check.sql (read-only) and remove-test-data.sql
ios/                    The iPhone app (SwiftUI; paused)
public/                 The original app, kept until production is confirmed on web/
docs/                   Everything else: start at docs/README.md
.github/workflows/      CI, CodeQL, preview deploy, Linear sync, load test
.claude/skills/         /next, /ship, /standup: working from the Linear board in Claude Code
```

### Database

The SQL files are additive and run in the order in [`supabase/order.txt`](supabase/order.txt), the single list that CI, the local test stack and production setup all follow. The app checks which steps have run and hides features whose tables don't exist yet (`web/src/lib/db-features.ts`). What each step does: [docs/next-migration.md](docs/next-migration.md). Tables and who can touch them: [docs/data-model.md](docs/data-model.md). To check a database: [`supabase/maintenance/health-check.sql`](supabase/maintenance/health-check.sql) (read-only).

### How we work

Two founders, small commits straight to `main`, with CI as the gate: a red check is fixed before anything else. Commits start with their Linear issue ID (`FIX-30: …`), and the Linear sync keeps the board current. The full guide, including the switch to pull requests when the team grows, is in [CONTRIBUTING.md](CONTRIBUTING.md). What runs automatically: [docs/automation.md](docs/automation.md).
