# YC readiness (2026-11-09)

Where Forge stands against the loop: **join a club → post what you're building → your club verifies it → proof on your profile → companies find you.** See [plan.md](plan.md) for the phase checklist.

## Built and tested

| Area | What works | Proof |
|---|---|---|
| Navigation | Five places: Home, Clubs, Projects, Messages, Profile (web and iPhone) | e2e |
| First five minutes | Checklist on Home: club → project → update → ask to verify → verified | e2e (a) |
| Projects at the center | Composer asks "Which project?" first; a project update can also go to a club | e2e (c) |
| Verification | Evidence required; officers only, never on their own team's project; 1–2 verifiers; badge with verifier, role, club, date; revoke with reason; disputes (club owner → Forge admins); weekly cap and outlier flags; append-only log | `supabase/tests/verification.test.sql` (every rule), e2e (c) |
| Ember | Approve-first cards; never writes on its own; never verifies; milestone drafts need real evidence | `web/tests/ember-approve-first.test.ts` |
| Club leaders | Officer to-do list on the club; end-of-term handoff; roles, invites, moderation, events, chat, announcements, team chats | `handoff.test.sql`, e2e (b) |
| Trust and safety | Report anything; block anyone; request inbox; download your data; delete your account | `account.test.sql`, e2e (g) |
| Landing | Live traction (zeros hidden), one CTA per audience, checked sources, labelled examples | phone layout checked in WebKit |
| iPhone app | Native SwiftUI on the same backend: feed, clubs, chat, events, search, settings, sign-up | ForgeKit tests (31) |

## Stubbed or not built yet

- **Company flow (Phase 5):** work-domain verification for companies, search by verified work, sponsored challenges, the billing module (Stripe stub). The landing labels these as pilots / coming with Pro.
- **Discord → Forge posts:** Forge → Discord announcements exist; the reverse needs a bot (credentials).
- **Imports:** members by CSV/email list, events from `.ics`.
- **Weekly nudges by email:** no email provider yet (in-app checklist exists).
- **Admin dashboard (Phase 9):** the `admin_queue` table and `forge_admins` exist; no admin UI or metrics dashboard yet.
- **Rate limits** beyond the existing caps (pending milestones, Ember's daily limit).
- **Push notifications and TestFlight** for the iPhone app (need an APNs key and an App Store Connect record).

## Needs the real world

- **Real clubs:** the NSBE chapter at UHart as the design partner (see [strategy.md](strategy.md)); don't claim a partnership until NSBE agrees.
- **Founders section:** fill `FOUNDERS` in `web/src/components/landing/founders.tsx` (it stays hidden until then).
- **Testimonials:** only from real, consenting members; there's no slot filled with invented quotes.
- **The first sponsor:** one Connecticut employer sponsoring one chapter challenge (a paid pilot or LOI).
- **Production:** run SQL steps 5–20 in order (`docs/next-migration.md`), run `supabase/maintenance/remove-test-data.sql` (preview first), set `ANTHROPIC_API_KEY`, and open the site publicly.

## Metrics to show (once live)

Weekly active members per club (target 40%+ for 8 weeks), milestones submitted vs verified and time to verify, onboarding checklist completion, clubs retained across the officer handoff, company follows and messages. The data is all in the tables; Phase 9 adds the admin view.
