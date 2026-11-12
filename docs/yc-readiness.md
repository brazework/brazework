# YC readiness (updated 2026-11-10)

Where Brazework stands against the loop: **join a club → post what you're building → your club verifies it → proof on your profile → companies find you.** See [plan.md](plan.md) for the phase checklist and [launch.md](launch.md) for turning it on in production.

## Built and tested

Every row runs in `npm run e2e` (a fresh local Supabase, real sign-ups, Chrome) and/or the SQL and unit tests.

| Area | What works | Proof |
|---|---|---|
| Navigation | Five places (Home, Clubs, Projects, Messages, Profile); ⌘K palette to jump anywhere or ask Ember | e2e |
| First five minutes | Checklist on Home: club → project → update → ask to verify → verified | e2e (a) |
| Your week | Home's rail: what's waiting on you, what happened in your clubs, one next step (a quiet project) | `week.test.ts`, e2e (c) |
| Projects at the center | Workbench on Projects; composer asks "Which project?" first; GitHub import with Ember | e2e (c) |
| Verification | Evidence required; officers only, never their own team's project; 1–2 verifiers; badge with verifier, role, club, date; revoke with reason; disputes (club owner → Brazework admins); weekly cap and outlier flags; append-only log; verified-club badge | `verification.test.sql`, e2e (c) |
| Clubs | Officer to-do list; end-of-term handoff; roles, invites, moderation, events, club chat, announcements; calendar import (.ics) | `handoff.test.sql`, `ics.test.ts`, e2e (b) |
| Events | Week strip, from-your-clubs filter, connections going, host menu, "Plan it with Ember" | e2e (b) |
| Companies | Work-domain verification (free email refused); Find builders by club-verified public work; sponsored challenges (draft → sponsored → open → judging → winners); wins on profiles | `talent.test.ts`, `challenges.test.sql`, e2e (d, h) |
| Billing | Stripe Checkout behind a provider interface (off until keys are set); signature-checked webhook marks sponsorships paid; pilot approvals by Brazework admins | `billing.test.ts`, `stripe-webhook.test.ts`, e2e (h) |
| Ember | Approve-first cards; never writes on its own; never verifies; milestone drafts need real evidence; tools for builders and challenges | `ember-approve-first.test.ts` |
| Trust and safety | Sign-up rules in the database (school email, minimum age, listed schools, "Request my school"); rate limits; reports on posts, people, projects, challenges; blocking; request inbox; data export; account deletion; privacy page | `signup-rules.test.sql`, `school-requests.test.sql`, `rate-limits.test.sql`, `reports.test.sql`, `account.test.sql`, e2e (a, g, h) |
| Admin | `/admin`: the loop as a funnel, weekly active, time to verify, clubs and handoffs, companies and challenges; sponsorship approvals, school requests, reports, review queue | `challenges.test.sql`, e2e (h) |
| Landing | Live traction (zeros hidden), one CTA per audience, checked sources, labelled examples | phone layout checked in WebKit |
| iPhone app | Native SwiftUI on the same backend: feed, clubs, chat, events, search, settings, sign-up | ForgeKit tests (31) |

## Not built yet

- **Email:** weekly digest and member invites by email list need an email provider (e.g. Resend). In-app nudges exist.
- **Discord:** removed (FIX-92). Work flows in from GitHub (import today, live sync next) and members' AI tools (MCP).
- **Duplicate-club review:** the admin queue has the kind; nothing raises it yet.
- **Push notifications and TestFlight** for the iPhone app (need an APNs key and an App Store Connect record).

## Needs the real world

- **Real clubs:** the NSBE chapter at UHart as the design partner (see [strategy.md](strategy.md)); don't claim a partnership until NSBE agrees.
- **Founders section:** fill `FOUNDERS` in `web/src/components/landing/founders.tsx` (it stays hidden until then).
- **Testimonials:** only from real, consenting members.
- **The first sponsor:** one Connecticut employer sponsoring one chapter challenge (a paid pilot or LOI).
- **Production:** everything in [launch.md](launch.md).

## Metrics to show (once live)

All on `/admin`: weekly active members (target 40%+ for 8 weeks), the loop funnel (member → in a club → has a project → has verified work), milestones submitted vs verified and median time to verify, clubs active per week and handoffs, verified companies, live challenges and entries, sponsorships paid and piloted.
