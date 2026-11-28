# Brazework today (26 November 2026)

What Brazework is, what's live, who pays, how it's run, and what's next, in one page. Checked
against `main` on 26 November 2026 (after #260 and #263). For how we got here, see [history.md](history.md);
for how to run the company week to week, see [operating.md](operating.md).

## What Brazework is

**The record of what you build, signed by the people who saw it.** A student, or anyone who builds,
logs a project and its milestones with evidence. Someone who saw it happen signs it: a professor, a
club officer, a coworker, a mentor. A signature carries the signer's name, role and email domain, and
it can be withdrawn if it wasn't true. The result is proof anyone can check from one link, which
recruiters, grad schools and sponsors can trust more than a résumé line.

Around that record sit the places where the work happens and gets seen: clubs, courses, a school
portal, company search, and Torch, the AI teammate that drafts everything for the member to approve.

## What's live

| Area | What it does | Where in the code |
| --- | --- | --- |
| **Record** | Projects, milestones with evidence, three kinds of proof: **signed** by a person, **verified** by a club or class, **backed** by GitHub. Share cards (`/p/<id>`), verify links (`/v/<id>`), a résumé view, a review packet, the record by year, founding-member badges. Long milestone logs fold on a profile. | `web/src/app/(app)/u/[id]`, `web/src/lib/milestones.ts`, `supabase/verification.sql`, `vouches.sql`, `backed.sql`, `proof-cards.sql` |
| **Signing** | Ask anyone who saw it by email: a one-time link, no account needed. University and work addresses carry the most weight; a company that isn't verified is labelled. Rate limits per milestone, per week and per signer. | `web/src/lib/vouch-email.ts`, `supabase/vouches.sql`, `work-email-signers.sql`, `personal-email-signers.sql` |
| **Clubs** | Clubs, chapters, events, announcements, club chats, club projects, an officer verification queue, a semester report, school-verified clubs. | `web/src/app/(app)/c/[id]` |
| **Courses** (new 26 Nov) | **Phase A** (#254): modules, assignments with rubrics, submissions and a private gradebook; grading a milestone verifies it. **Phase B** (#260): extensions and accommodations, peer evaluation, ABET outcome attainment (quizzes and attendance were taken out on 27 Nov: the school's LMS runs them). | `web/src/app/(app)/c/[id]/course`, `supabase/courses.sql`, `courses-b.sql` |
| **School portal** (new 26 Nov) | A school's view: students, classes, verified work, active clubs, faculty list, ABET evidence by outcome with CSV exports. Students are grouped by their confirmed university email. | `web/src/app/(app)/school`, `supabase/school-portal.sql` |
| **Torch** (the AI, once called Ember) | Asks and answers from the member's real record, drafts cards (posts, milestones, signature asks, goals, projects, events, messages, course work for faculty) that the member approves. Free follow-ups after each paid ask (#263). Asks with tap-to-answer buttons (#258). In the bar on every page and on its own page. | `web/src/lib/copilot*.ts`, `web/src/components/ember/`, `web/src/app/api/copilot/route.ts` |
| **Goals** | "Where you're headed": a goal (internship, job, grad school, lab, competition, funding), a path built from the record, the next step. With #265, Torch sets the goal from your own words and does the next step. | `web/src/lib/goals.ts`, `web/src/components/app/goal-card.tsx` |
| **Companies** | Find builders by signed work (verified companies), messaging into Requests, sponsored challenges and chapter sponsorships. | `web/src/app/(app)/talent`, `challenges` |
| **AI tools (MCP)** | Brazework as a connector for Claude and other assistants: draft milestones from real work, ask for signatures, club tools, OAuth. | `web/src/app/api/mcp`, `web/src/lib/mcp*.ts`, [mcp-workflows.md](mcp-workflows.md) |
| **iPhone app** | SwiftUI app on the same database: the record, Torch, asking someone to sign. Ready for TestFlight. | `ios/` |

## Who pays (from `web/src/lib/pricing.ts`, the source of truth)

- **Builders:** free, always. Torch is 15 credits a day. **Plus** for professionals and independent
  builders, $12/month or $96/year, 50 credits a day; **students never pay**. Plus is on a waitlist until
  paid plans open.
- **Clubs:** free.
- **Schools:** a semester pilot ($1,500, credited to year one); a Department ($6,000/year with 5 faculty
  seats, $600 per extra seat); a Campus from $18,000/year for the first 10 founding schools, locked for
  3 years (list price from $30,000).
- **Companies:** Starter $4,800/year (1 seat); Find builders $15,000/year (2 seats); a chapter
  sponsorship $2,500 per chapter per semester (all to the club) plus a $500 service fee; challenges from
  $5,000 in prizes plus $500.

## How it runs

- **Web:** Next.js 16 on Vercel; deploys `main` on every merge. **Database:** Supabase (Postgres with
  row-level security). Database steps live in `supabase/`, run in the order in `supabase/order.txt`, and
  apply themselves to staging and then production after a merge (`.github/workflows/db-migrate.yml`).
- **Every change** goes through a pull request that merges itself once the required checks pass:
  typecheck, lint, unit tests, build, the full end-to-end suite on a throwaway database, a dependency
  audit and secret scan, plus Lighthouse/ZAP quality scans and CodeQL. See
  [../CONTRIBUTING.md](../CONTRIBUTING.md). That is how the founders ship. Agent-authored pull requests
  follow [team-playbook.md](team-playbook.md).
- **Work tracking:** Linear, team Forge, key `FIX`. Commits name their issue; a nightly sync logs
  untracked commits. **The workspace is at its free plan's issue limit** (26 Nov): new issues are
  refused until the plan is upgraded or old issues are archived.
- **Demo data:** Brazework Demo University ([demo-university.md](demo-university.md)) builds a whole
  school locally for demos; it isn't hosted yet (it needs a separate demo project and a domain).

## What's next

**Building now (open pull requests, 26 Nov):** #265 (goals with Torch) and #257 (landing copy for
Courses) merge themselves once green. #205 (Torch remembers the whole chat) needs re-porting onto the
reworked Torch before it can ship.

**Asked for, not started:**
- Creation flows that feel fast (a project, a club, an event, a course): short steps instead of long
  forms, and Torch able to create anything a member can make by hand.

**Courses, later (from the Courses plan):**
- Scores flowing back from LTI tools into the gradebook.
- A scheduled roster sync.
- An outside accessibility audit (VPAT).
- Courses on the mobile app.
- Hosting Demo University once there's a demo domain.

**Building with pilot schools:** discussion threads in each course; placement data (which employers
viewed and contacted a school's students); student life, career center and admissions views; single
sign-on and roster sync from the student system; importing Canvas and Blackboard courses; LTI for
publisher tools.
