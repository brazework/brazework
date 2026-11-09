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

1. **A club runs on Forge:** roles from owner to helper, join requests, moderation with auto-filters, its own feed and its own events.
2. **Members post the work:** updates, questions, results and projects, tagged by topic, with build logs and write-ups that can stay private.
3. **The right people find it:** verified companies and schools host events, follow builders and message them through a request inbox that keeps strangers out of your way.
4. **Members land opportunities and bring the next club.**

## What's in the product

| | |
|---|---|
| **Feed** | *For you* shows only posts matching your interests, and says why. Plus Latest, Following and your clubs, with topic filters. Forge updates (recent changes and what's coming next) at the top right. Edit your own posts any time; edited posts say so |
| **Search** | One search bar above every page finds people and communities by name, field, headline or club, with people and clubs that share your interests first. Connect or join from the results; `/search` shows everything |
| **Profiles & projects** | Headline, field, interests, and projects with a public summary and a private write-up. Share any project to the feed |
| **Communities** | Public or approval-only clubs with invite links, five roles, held-post review, word filters, link holds for new members, bans, and **club events** |
| **Network** | Connections with notes, follows, invitations, and suggestions from shared interests and field |
| **Messages** | One-to-one. Strangers land in Requests; accept, decline, or block and report. Read status is never shown |
| **Events** | Career fairs, talks and build nights from verified organizations and clubs. RSVP, save, add to calendar |
| **Organizations** | Companies and schools verified by the domain of the email they signed up with |
| **Notifications & analytics** | Likes, comments, follows and requests, plus private profile analytics. Viewer breakdowns only appear once 3 or more different people have viewed you |
| **Everywhere** | Light and dark mode with six accent colours, a sidebar that collapses to icons (remembered per browser), a guided tour for new members, What's new notes, and full use on a phone |

Students verify with a university email. Members must be 18 or older. Everything that matters is enforced by the database's row-level security, not just the app.

## Status

Early access, built by two founders.

- **Live today:** the original app in `public/` (plain JavaScript), deployed on Vercel from `main`.
- **Next:** the rebuilt app in `web/` (Next.js 16, Tailwind CSS 4). It has every screen of the original plus club events, on the same Supabase database. The switch-over plan is in [docs/next-migration.md](docs/next-migration.md).

## Repository

```
web/                  The Next.js app (see web/README.md for how it's built)
public/               The original app, still serving production until the switch-over
supabase/*.sql        Database: tables, row-level security, triggers. Run in order (below)
docs/positioning.md   Market research and positioning, with sources
docs/next-migration.md  Moving production to web/
docs/data-model.md    Every table, who can do what, and known limits
SETUP.md              Putting Forge online with Vercel and Supabase
.github/workflows/    CI: the web app builds and passes checks, every SQL file applies in order, and main redeploys the preview
```

## Run it locally

```sh
cd web
npm install
cp .env.example .env.local   # add your Supabase URL and anon key
npm run dev                  # http://localhost:3000
```

Add `http://localhost:3000/auth/callback` to Supabase → Authentication → URL Configuration → Redirect URLs, or sign-up and reset emails won't come back to your local app. Point local development at a staging project, not production.

## Database

Run these in the Supabase SQL Editor, in this order: `schema.sql`, `messages.sql`, `events.sql`, `activity.sql`, `projects.sql`, `tours.sql`, `club-events.sql`, `media.sql`, `invites.sql`, `post-edits.sql`, `milestones.sql`, `feedback.sql`, `feedback-review.sql`. (`copilot.sql` is optional and can run any time after `invites.sql`.) CI applies all of them to a fresh database on every pull request, so a broken migration fails there and not in production. What each table holds and who can touch it: [docs/data-model.md](docs/data-model.md).

## How we work

Branch → pull request → Vercel preview → review → squash-merge. `main` deploys to production. Details are in CONTRIBUTING.md, on the pipeline branch.
