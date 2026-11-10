# Forge, in plain language

For anyone: co-founders, advisors, investors, a new teammate. No technical background needed. The engineering version is [architecture.md](architecture.md).

## What it is

**Forge is where STEM students prove what they've built.** A student posts their project. Their club's officers, who saw the work happen, put their name on it ("verified"). Companies looking for builders find students through that verified work, not through résumés anyone can write.

Three kinds of people use it:

| Who | What they get | What they pay |
|---|---|---|
| **Students** | A profile of real, verified work that follows them into their career | Nothing, ever |
| **Club officers** | One place to run the club (members, events, chat, announcements) and to vouch for members' work | Nothing, ever |
| **Companies and schools** | A way to find proven builders, and to sponsor challenges that clubs compete in | The first revenue (challenge sponsorships, then search) |

## How it works, step by step

1. **A club joins.** An officer sets it up and invites members. It's useful on day one: events, chat and a club feed replace a Discord server, a Google Form and a group chat.
2. **Members post their work:** updates, photos, video, results, questions.
3. **They ask the club to verify a milestone,** for example "rocket engine static-fired at 1.2 kN", with evidence such as a photo, a video, a link to the code or a club event.
4. **An officer checks it and verifies it.** Forge records who vouched, when, and the evidence. Officers can't verify their own team's work, and there are limits so nobody can rubber-stamp everything.
5. **It shows on the student's profile** as verified work, with the club and officer behind it.
6. **Companies find them.** A verified company searches by skills and verified work, messages students (who can accept or ignore), and sponsors challenges that clubs enter.

**Ember** is the AI helper built in. It drafts posts and write-ups, plans events and finds clubs and people. It never acts on its own: it prepares, and a person taps Approve.

## Why people can trust it

- **Verified means someone accountable vouched for it,** not an algorithm or a self-report.
- **The rules live in the database itself,** not only in the website. Even if the website had a bug, the database refuses anything a member isn't allowed to see or do.
- **Students sign up with a school email,** members must be 18 or older, and there are limits on spam, reporting for abuse, and blocking that hides people from each other completely.
- **Privacy is plain:** members choose what's public, can download all their data, and can delete their account.

## How we know it's working

The admin dashboard (`/admin`, founders only) tracks the loop:
- **The loop as a funnel:** members, then in a club, then has a project, then has verified work.
- **Weekly active members** and **retention** (of people who joined in a week, how many come back each later week).
- **Verified milestones** and how fast clubs verify.
- **Companies:** how many are verified, live challenges and sponsorships, and the share of company messages students reply to.

## Where everything lives

| What | Where |
|---|---|
| The live site | Vercel (hosting), deployed automatically from the code |
| Accounts, data, photos | Supabase (database and file storage) |
| The code | GitHub (`forge-app`) |
| What we're working on, in order | Linear, team Forge: projects for Launch, Brand, Quality and Product |
| Every account and who owns it | [accounts.md](accounts.md) |
| What runs automatically | [automation.md](automation.md) |
| Strategy, market and naming | [strategy.md](strategy.md), [positioning.md](positioning.md), [naming.md](naming.md) |

## How we build it (the short version)

Every change goes through an automatic checklist before it can go live:
- the code compiles
- about 80 real user journeys pass in a test browser
- pages stay fast and accessible
- a security scanner finds nothing serious
- no passwords or keys slipped into the code

If anything fails, it doesn't ship until it's fixed. Linear updates itself from that work, so the board shows what's done and what's next.

## Where we are (November 2026)

- **Built and tested:** the full loop described above (student, club, verification, company).
- **Next:** switch production on (database upgrades, email, AI and payment keys), clear the new name (Brazework, pending a trademark check) and set the company up on it, then launch with pilot clubs, starting with NSBE at UHart.
