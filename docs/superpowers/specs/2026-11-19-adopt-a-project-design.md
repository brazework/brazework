# Adopt a project

Date: 2026-11-19. From a brainstorm with Josh: make clubs collaborative for students and professionals,
with a moment that makes both say "wow". The pick: a professional adopts one student project and
follows it as it's built, and the signatures go both ways.

## Intent

Today a student and a professional meet once: the student shows up with finished work and asks for a
signature, or a company searches. Neither is collaboration, and the professional's time leaves nothing
on their own record, so they never come back. Adopting a project fixes both. A professional follows
one project for a few weeks, comments on its updates, and signs its milestones as someone who watched
them get built. The team signs back that this person mentored them, and that lands in the
professional's review packet. Students get the strongest evidence Brazework can produce; professionals
get signed proof of their mentoring at review time; sponsors get a reason for their engineers to show
up; and each graduating class becomes the next class's mentors.

## The flow

1. A project team (owner or admin) opens **Find a mentor** on the project and either invites someone by
   email or link, or marks the project **open to mentors** with one line on what help they want.
2. A professional sees the invite, or finds the project in **Projects looking for a mentor** (their
   disciplines first, like `pro_review_queue()`), and adopts it. The team accepts.
3. Every week the project's updates appear in the adopter's digest and on their Home. They comment on
   update posts (existing comment threads).
4. When the team submits a milestone, the adopter can sign it. The signature reads "Signed by Dana
   Reyes, Senior Engineer · Pratt & Whitney, who followed this project for 8 weeks."
5. When the adoption ends (the team or adopter closes it, or the project wraps), the team is asked to
   sign back: what the adopter helped with, in their own words. It shows on the adopter's profile and
   in their review packet as "Mentored the avionics team at UHart NSBE, 8 weeks · signed by 4".
6. A student who graduates and becomes a professional adopts next year's project. Nothing new is needed
   for this: it's the same flow from the other side.

## Gate: a 4-week pilot before building (Phase 0)

The riskiest assumption is that professionals give about 20 minutes a week for several weeks. Test it
with what exists before writing code:

- At UHart, recruit 3 professionals by hand: 1 recent alum and 2 engineers from a hoped-for sponsor.
- Each follows one project for 4 weeks: they follow the team members (`follows`), read and comment on
  update posts, and sign a milestone with a vouch (`request_vouch`, relationship `mentor`).
- Count the weeks each one showed up. Ask each: "Would a signed 'mentored' line on your record keep you
  going?" Ask the teams whether the comments changed what they built.

**Go** if at least 2 of 3 show up in 3 or more of the 4 weeks. Otherwise rethink before building
(mentor a person instead of a project, or a shorter commitment).

## Goals

1. **Professionals come back weekly.** Of active adopters, 60% open or comment on their project in 3 of
   any 4 weeks (stretch: 75%).
2. **Adopted projects ship more.** Adopted projects post updates in more weeks than comparable
   unadopted ones in the same clubs (target: +50%).
3. **Stronger signatures.** By the end of the first semester, 30% of verified milestones on adopted
   projects are signed by their adopter.
4. **Signatures go both ways.** 70% of adoptions that end get a signed "mentored" record from the team.
5. **Sponsors have something to show.** At least one sponsor pilot includes adopting projects, and its
   report counts adoptions and adopter-signed milestones.

## Non-goals (v1)

- **Mentoring people instead of projects.** A project produces signable milestones; a relationship
  doesn't. Revisit if the pilot says professionals prefer it.
- **Messaging or video calls inside adoption.** Requests and comments already exist; meetings happen
  wherever the team already meets.
- **Linking sponsorships to adopters in the database.** v1 sells "your engineers adopt projects" as
  part of a sponsorship by hand; the link is P2.
- **Matching by Ember.** Ember suggesting adopters from signed work is P1, after the basic flow proves
  people use it.
- **Paid adoption or a Plus gate.** Adopting and being adopted are free. The review packet's mentoring
  section follows whatever the packet's own access is (`canUse("reviewPacket")`).

## User stories

**Student team**
- As a project owner, I want to invite a professional I know to follow our project, so the person who
  signs our work has seen it built.
- As a project owner with no contacts, I want to mark our project open to mentors with what we need,
  so a professional in that field can find us.
- As a team member, I want to sign back what our adopter helped with, so their help is on their record
  and not just in our thanks.
- As an owner, I want to end an adoption that isn't working, without a fuss and without a public trace.

**Professional**
- As an engineer, I want to find student projects in my discipline that want help, so I can spend 20
  minutes a week where it matters.
- As an adopter, I want the project's updates in my weekly email, so following it takes no new habit.
- As an adopter, I want to sign a milestone I watched get built, saying how long I followed it.
- As an adopter, I want my mentoring in my review packet, signed by the students, for my own review.

**Club officer and sponsor**
- As an officer, I want to see which of our projects have adopters, so I can find mentors for the rest.
- As a sponsor admin, I want to see that our engineers adopted the chapter's projects, so the
  sponsorship report shows more than a logo.

## Requirements

### P0: must ship

1. **Adoptions, kept apart from the team.** A new table `project_adopters` (project, adopter, status
   `invited | requested | active | ended`, started_at, ended_at, ended_by, a short `ask`). An adopter is
   never a `project_members` row: `on_project_team()` counts every member, viewers included, and would
   stop the adopter from signing.
   - Who can adopt: a pro (`profiles.pro_org_id` set through `become_pro`, so the employer is a verified
     company) or someone with a confirmed school email who isn't on the team. Never a team member.
   - Caps: 3 active adoptions per adopter, 2 per project.
   - Acceptance: an invite turns active when the adopter accepts; a request turns active when an owner
     or admin accepts. Either side can end it at any time, and only the two sides see that it ended.
2. **Open to mentors.** A project owner or admin sets `projects.mentor_ask` (one line, 140 characters).
   **Projects looking for a mentor** lists public projects with an ask and fewer than 2 adopters,
   matching the viewer's `pro_disciplines` first.
3. **Adopters can read the project.** `can_read_project` also allows an active adopter, so they can
   follow private capstones. This changes a core policy: the database step's test proves an ended
   adopter loses access and an adopter still can't post, edit or add people.
4. **The adopter's week.** The digest (`loadWeekFor` and `buildDigest`) and Home add "Projects you
   adopted": each project's updates from the last 7 days and its milestones waiting for a signature.
5. **Adopter signs a milestone.** A new function `adopter_sign_milestone(p_milestone, p_note)`:
   - Allowed for an active adopter, on a `pending` milestone of that project, adopted at least 14 days.
   - Sets it `verified` with `reviewer_id` = adopter, `reviewer_role` = `mentor`, and logs it in
     `verification_events` like every other signature, so revoke and dispute work unchanged.
   - The signature line adds "followed this project for N weeks", from `started_at`.
   - The club's own verification rules (`verifiers_required`) still apply to club milestones: an
     adopter's signature counts as one verifier.
6. **The team signs back.** When an adoption ends (or from the project at any time after 4 weeks), each
   team member can sign a `mentor_records` row: adopter, project, weeks, what they helped with (40+
   characters, like `pro_reviews`), frozen once written. One per team member per adoption.
7. **It shows up.**
   - The adopter's profile gets a **Mentoring** section: project, club, weeks, number of signers, quotes.
   - The review packet (`web/src/lib/review-packet.ts`) adds a **Mentoring** section from
     `mentor_records` in the date range. Today it only holds the user's own work.
   - `my_signatures()` includes milestones signed as an adopter.
8. **Database step `project-adopters`** (the next free number; open PR #84 adds `function-access`
   first), with the usual recipe: the file, a line in
   `supabase/order.txt`, `supabase/tests/project-adopters.test.sql`, a row in block 1 of
   `supabase/maintenance/health-check.sql` (`project_adopters_ready()`), and a line in
   `docs/next-migration.md`. Additive only.

**Acceptance (checklist)**
- [ ] An owner invites a pro by email; the pro accepts; the project shows "Adopted by Dana Reyes".
- [ ] A pro requests a project with a mentor ask; an admin accepts; a plain member can't.
- [ ] A team member, including a viewer, can't adopt their own project.
- [ ] A fourth active adoption and a third adopter on one project are refused with a clear message.
- [ ] An active adopter reads a private project; once ended, they can't.
- [ ] The adopter's digest lists the project's updates from the week and milestones waiting.
- [ ] An adopter of 10 days can't sign; at 14 days they can, and the signature says "for 2 weeks".
- [ ] An adopter's signature is revoked and disputed exactly like an officer's.
- [ ] Each team member signs back once; the record can't be edited; it appears in the adopter's packet.
- [ ] An adopter who isn't a pro and has no confirmed school email can't adopt.

### P1: fast follows

- **Ember suggests adopters**: when an update says the team is stuck, Ember drafts an ask to a pro whose
  signed work is in that area. The team sends it; Ember never does.
- **Officer view**: the club page shows adopted and unadopted projects, and `club_brief` lists them.
- **iOS**: adopt, the adopter's week on Home, sign, and sign back.
- **MCP tools**: `my_adoptions`, and `adopt_project` / `sign_back` as drafts the member approves.
- **Push and email nudges**: "Your adopted project posted" (respecting `email_prefs`), and a reminder
  when a milestone has waited 3 days for its adopter.

### P2: design for, don't build

- **Sponsorship link**: a sponsorship row ties a company to a chapter, and adoptions by that company's
  pros (`pro_org_id`) count in its report. Keep `project_adopters` keyed so this is a join, not a
  migration.
- **Alumni**: a graduated member who adopts their old club's project shows "alum". Needs an alumni
  state, which doesn't exist (`grad_year` only).
- **Network view**: national organizations see adoption across chapters.

## Success metrics

| | Metric | Target | How |
|---|---|---|---|
| Leading | Pros who adopt in the first 30 days of a club going live | 3 per active club | `project_adopters` |
| Leading | Weeks active per adopter (opened the week or commented) | 3 of 4 for 60% | digest opens, `comments` |
| Leading | Invites accepted | 50% | `project_adopters` status |
| Lagging | Adopted projects' weeks with an update vs unadopted | +50% | `posts` by project |
| Lagging | Milestones on adopted projects signed by the adopter | 30% | `milestones.reviewer_role` |
| Lagging | Ended adoptions with a signed record | 70% | `mentor_records` |
| Lagging | Companies that looked at adopted projects' members | 2× unadopted | `viewers_for` |

Evaluate at 4 weeks (leading) and at the end of the semester (lagging).

## Open questions

- **Product (Josh and Ian), blocking:** is 14 days the right wait before an adopter can sign, or should
  it be "commented on at least 2 updates"? The point is that the signer actually followed it.
- **Product, blocking:** can a school-email adopter (a professor, a grad student) sign club milestones
  too, or only pros? Professors already vouch by email.
- **Trust and safety, blocking:** adults following minors' projects. Brazework is 18 and older today,
  so this holds only as long as that rule does; write it down in the step's comments.
- **Design, non-blocking:** where "Find a mentor" lives on the project page, and how quiet "ended" is.
- **Data, non-blocking:** how to pick the "comparable unadopted projects" for goal 2 (same club, same
  semester, same number of updates before adoption).
- **Sales, non-blocking:** would sponsors pay more for "your engineers adopt projects", or is it what
  makes the $2,500 easy to say yes to?

## Phasing

- **Phase 0 (4 weeks, no code):** the pilot above. It decides whether Phase 1 is built.
- **Phase 1 (one database step and about three PRs):**
  1. Step `project-adopters`: tables, `can_read_project`, `adopter_sign_milestone`, `mentor_records`,
     and tests.
  2. Web: find a mentor, open to mentors, accept and end, the adopter's week on Home and in the digest.
  3. Web: sign and sign back, Mentoring on the profile, in the review packet and in `my_signatures()`.
- **Phase 2:** P1 items, iOS first if the pilot's adopters live on their phones.
- **Phase 3:** the sponsorship link and the sponsor report.

## Calls made in writing this

- **Adopters aren't project members.** `on_project_team()` counts viewers, so any membership role would
  block signing. A separate table also keeps "who built it" and "who watched it" apart on the record.
- **A new signing function, not a reused one.** `pro_review_milestone` only adds to milestones that are
  already verified, and vouches are tied to an email and a 14-day link. An adopter is a signed-in
  account signing a pending milestone, so it gets its own path into the same `verification_events` log.
- **The record belongs to the adopter but is written by the students**, the same way a milestone
  belongs to the builder but is signed by someone else. That's what makes it worth putting in a
  review packet.
