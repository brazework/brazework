# Forge

**Proof of work beats a résumé.**

Forge is the professional network for STEM, built around what people actually make. Engineers, scientists and the students on their way post their projects, results and questions. They run their clubs on Forge, and they get noticed by the companies, labs and alumni who care about that work. There's no recruiter spam, no AI-written thought leadership, and no feed built for going viral.

We're starting with **university STEM clubs**: robotics, rocketry, ACM and IEEE chapters, hackathon teams, SWE, NSBE and SHPE. One club on Forge is useful on day one. Its posts, roles and events live in one place instead of a Discord server, a Google Form and a group chat, and every member's work becomes part of their profile.

## Why it matters

- **Hiring trust is broken.** Recruiters see about 3x the applications per role compared with 2021, and most have caught candidates misrepresenting themselves. Real work that someone else saw happen still cuts through.
- **The entry level is the hardest it's been.** Students need visible work and real relationships more than a polished résumé.
- **General networks weren't built for builders.** LinkedIn optimizes for reach, Handshake for career centers, GitHub for code only. Nobody gives a hardware, bio or chemistry project, or the club behind it, a lasting home.

The research, with sources, is in [docs/positioning.md](docs/positioning.md).

## How it works

1. **A club runs on Forge:** roles from owner to helper, join requests, moderation, its own feed, events and group chat.
2. **Members post the work:** updates, questions, results and projects, with photos and video, tagged by topic.
3. **The club vouches for it:** a member asks their club to verify a project milestone; an officer checks it. Verified milestones are the *proof* in "proof of work". They show on the profile, the résumé and in the feed.
4. **The right people find it:** companies, labs and alumni search and follow builders, host events and message them through a request inbox that keeps strangers out of your way.

## What's in the product

| | |
|---|---|
| **Feed** | *For you* ranks posts from your clubs, people you follow and your interests, plus verified milestones, and says why each is there; your new post shows first. Latest, Following and Clubs tabs, kind filters (questions, results, videos…), Best / Newest / Oldest. Answer questions inline, @mention people (they're notified), save and send posts. Forge updates and STEM headlines on the side |
| **Video & photos** | Videos play as you scroll (sound on, one at a time) and pause when you scroll past; tap to pause, speed and fullscreen on tap. Preview before posting. Photo callouts and before/after |
| **Profiles** | Proof timeline of verified milestones, projects with a "Built with" stack, what you're open to (internships, research, co-founding…), links, profile strength, what you share with a visitor, and a one-click printable résumé |
| **Clubs** | Public or approval-only, invite links, five roles, held-post review and word filters, a logo and accent colour, club events, a club chat with officer announcements, and Discord announcements |
| **Events** | Club and organization events with a map, directions, RSVP, calendar files and an attendee chat |
| **Messages** | One-to-one with a request inbox for strangers; group chats for clubs, events and teams. Reactions, replies, unsend within 15 minutes. On the desktop feed, a collapsible dock to answer without leaving the page. Read status is never shown |
| **Ember (AI)** | An AI teammate that knows Forge and your profile: finds clubs, events and people, writes posts and project write-ups, and prepares actions (join, RSVP, message, ask a club to verify) for you to confirm. Chats you can come back to, with tap-to-ask follow-ups |
| **AI tools (MCP)** | Personal tokens let Claude, Cursor or any MCP client read your Forge: profile, clubs, events, projects, search, notifications (read-only) |
| **Everywhere** | Light and dark with six accents, iPhone-ready (safe areas, add to Home Screen, a floating tab bar), a guided tour, What's new, and a landing that pages through on a phone |

Students verify with a university email. Members must be 18 or older. Everything that matters is enforced by the database's row-level security, not just the app.

## Status

**MVP complete; production switch-over waiting on three steps.** The Next.js app in `web/` is the product (the original `public/` app stays in the repo until production is confirmed on `web/`). Every feature above runs on https://forge-preview-eight.vercel.app and passes the end-to-end suite.

Production needs (Ian's account; full steps in [docs/next-migration.md](docs/next-migration.md)):

1. Run the newer SQL files in the Supabase SQL Editor (steps 5 to 20). Until then the app hides those features instead of breaking.
2. Turn off Vercel Deployment Protection for production so the site is public.
3. Add `ANTHROPIC_API_KEY` to switch on Ember.

## Where we go next

1. **Launch with pilot clubs.** Five clubs at one university, onboarded in person. Success is weekly active members per club, and verified milestones per month. That's the signal schools and companies pay for.
2. **iOS app.** Native SwiftUI on the same Supabase backend: feed, clubs, messages, notifications, with push notifications. That's what the web app can't do well on iPhone, and it's what brings members back.
3. **Retention loops.** Push and email digests (your club's week, unanswered questions in your field), event check-in by QR that counts toward proof.
4. **The paying side.** Free for students and clubs, always. Organizations pay to host events, sponsor clubs and search verified work by skill and school.
5. **AI tools, more.** Sign in with OAuth so Forge works in claude.ai and ChatGPT, then a few write actions with a confirmation step (post an update, RSVP).

## Repository

```
web/                    The Next.js app (see web/README.md for how it's built)
web/e2e/                End-to-end tests on a local Supabase in Docker (see web/e2e/README.md)
supabase/*.sql          Database: tables, row-level security, triggers. Run in order (below)
public/                 The original app, kept until production is confirmed on web/
docs/positioning.md     Market research and positioning, with sources
docs/next-migration.md  Moving production to web/ (the checklist)
docs/data-model.md      Every table, who can do what, and known limits
SETUP.md                Putting Forge online with Vercel and Supabase
.github/workflows/      CI: the app builds and passes checks, every SQL file applies in order, main redeploys the preview
```

## Run it locally

```sh
cd web
npm install
cp .env.example .env.local   # add your Supabase URL and anon key
npm run dev                  # http://localhost:3000
```

Don't point local development at production: anything you do writes real data. Use a staging project, or the local stack the tests use (`web/e2e/local-supabase.sh up`, Docker, no account needed).

```sh
npm run e2e   # builds the app, starts a local Supabase, runs every journey (sign-up to verified proof, chat, the dock), tears it down
```

## Database

The SQL files are additive and run in this order (the same order CI applies to a fresh database on every push):

`schema` → `messages` → `events` → `activity` → `projects` → `tours` → `club-events` → `media` → `invites` → `post-edits` → `copilot` → `milestones` → `feedback` → `feedback-review` → `integrations` → `group-chats` → `project-stack` → `club-profile` → `mentions` → `copilot-chats` → `profile-extras` → `mcp` → `chat-extras` → `reports` → `project-posts` → `verification` → `club-handoff` → `public-stats` → `account` → `challenges` → `admin-metrics` → `rate-limits`

The app checks which ones have run and hides features whose tables don't exist yet (`web/src/lib/db-features.ts`). What each table holds and who can touch it: [docs/data-model.md](docs/data-model.md).

## How we work

Two founders, small changes straight to `main`: lint, type check and `npm run e2e` pass locally first, CI applies every SQL file to a fresh database, and `main` redeploys the preview. Fetch and rebase on each other's work before pushing; never force-push.
