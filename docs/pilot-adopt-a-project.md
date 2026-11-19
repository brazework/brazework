# Pilot: adopt a project (Phase 0)

Four weeks, no new code. It decides whether Phase 1 of
[the adopt-a-project spec](superpowers/specs/2026-11-19-adopt-a-project-design.md) gets built. Written
2026-11-19.

**The question:** will a working professional give about 20 minutes a week, for four weeks, to one
student project they didn't build?

**Go** if at least 2 of the 3 professionals are active in 3 or more of the 4 weeks. "Active" means they
commented on the project's updates that week, or told us they spent 10 or more minutes on it.

## When

Don't run it in the next four weeks. Thanksgiving (Nov 26) and finals would make a quiet week look like
a lost professional, and we couldn't tell which it was.

| When | What |
|---|---|
| Nov 30 – Dec 11, 2026 | Recruit the 3 professionals and pick the 3 projects. Do the setup below. |
| Week 1 of spring classes | Kickoff: each pair meets for 20 minutes (call or in person). |
| Weeks 2–5 of spring classes | The four measured weeks. Confirm the dates against UHart's spring 2027 calendar. |
| The week after | Interviews, then the go or no-go. |

**Before it can start:** the UHart chapter pilot has to be live, with at least 3 projects posting updates
most weeks. If the chapter isn't there yet, this waits for it. Adoption can't add activity to a project
that has none.

## Who

**3 professionals**, all with a work email at a company that's verified on Brazework:

| Slot | Who | Why this slot |
|---|---|---|
| A | A recent NSBE UHart alum, now working in Connecticut | The likeliest to say yes. Tests the "next year's mentors" loop. |
| B | An engineer at a hoped-for sponsor (Pratt & Whitney, Collins, Electric Boat or Sikorsky) | Tests whether sponsors' engineers will do it at all. |
| C | A second engineer from a different hoped-for sponsor | Keeps one company's culture from deciding the result. |

Ask the recruiting or university-relations contact at B and C to introduce an engineer who already
volunteers at NSBE events. Don't cold-email engineers.

**3 projects**, one per professional:
- Built by a team of 2 or more, so there's someone to sign back.
- Public, not private: a professional who isn't on the team can't read a private project today.
- In the professional's field: avionics for an aerospace engineer, and so on.
- Posts an update most weeks already, and expects a milestone in weeks 3–4.

## Setup (before week 1)

Each step is something Brazework can already do. The notes say where it would trip.

1. **Verify each professional's company.** A vouch can only go to a school address or the domain of a
   verified company (`vouch_email_ok`). In `/admin`, check that each employer is registered and verified,
   with the right email domain. If it isn't, register and verify it first.
2. **Each professional signs up** and becomes a pro at `/pro`, so their employer shows next to their
   name.
3. **Each professional joins the chapter as a member.** Commenting on a post that belongs to a club needs
   club membership (the "write comments" rule: `my_rank > 0`). Joining doesn't put them on the project
   team, so they can still vouch.
4. **Each professional follows the project's team members**, so the updates show up on their Home.
5. **Put the 3 projects and 3 professionals in one sheet**, with these columns: project, team, professional,
   their account id, the project id, and one row per week.

## Each week

| Day | Who | What |
|---|---|---|
| By Wednesday | The team | Posts one update on the project: what they did, what's stuck, one question for the professional. |
| By Sunday | The professional | Reads it and replies in the comments. |
| Friday | Founders | Text each professional one question: "Roughly how many minutes did you spend on the project this week?" |
| Friday | Founders | Ask each team one question: "Did anything the professional said change what you did?" |
| Monday | Founders | Fill in the sheet. Nudge anyone who went quiet, once. Never twice in a row. |

**Weeks 3–4, the signature.** When the team finishes a milestone, they ask their professional to sign it
with a vouch: relationship **mentor**, sent to the professional's work email. The professional signs
through the link, saying what they saw.

**At the end, the sign-back.** Each team member writes 2–3 sentences on what the professional helped
with. There's nowhere in the product for this yet, so collect it in the sheet. Then show it to the
professional and ask question 4 below.

## What we measure

From the sheet, every week: active or not, minutes (self-reported), and whether it changed anything
(the team's answer).

From the database, read-only, in Supabase → SQL Editor (fill in the ids from the sheet):

```sql
-- Comments each professional left on their project's updates, by week.
select p.project_id, c.author_id, date_trunc('week', c.created_at) as week, count(*) as comments
from public.comments c join public.posts p on p.id = c.post_id
where c.author_id = any (array['<pro A id>', '<pro B id>', '<pro C id>']::uuid[])
  and p.project_id = any (array['<project 1>', '<project 2>', '<project 3>'])
group by 1, 2, 3 order by 3, 1;

-- Updates each project posted, by week (did adoption change how often they post?).
select project_id, date_trunc('week', created_at) as week, count(*) as updates
from public.posts
where project_id = any (array['<project 1>', '<project 2>', '<project 3>'])
group by 1, 2 order by 2, 1;

-- Mentor signatures asked for and given on the 3 projects.
select m.project_id, v.state, v.created_at, v.answered_at
from public.milestone_vouches v join public.milestones m on m.id = v.milestone_id
where v.relationship = 'mentor'
  and m.project_id = any (array['<project 1>', '<project 2>', '<project 3>']);
```

For the update counts, compare each project's 4 weeks with its 4 weeks before the pilot.

## The interviews (the week after)

About 20 minutes each, with each professional and each team.

**Professionals**
1. What made you open it on the weeks you did? What stopped you on the weeks you didn't?
2. How long did a week take you, honestly?
3. Would you rather have mentored a person than a project? Why?
4. (Show them the team's sign-back.) Would you put this in your performance review or a promotion case?
   Would it make you do it again?
5. Did your employer care either way? Would they let you list it?
6. Would you do another four weeks next semester, with a different team?

**Teams**
1. What was the most useful thing the professional did? The least?
2. Was the professional's signature worth more to you than an officer's? Why?
3. Did knowing someone senior was reading change how you wrote the updates?
4. Would you ask for a professional again? What would you want from them?

## Deciding

| Result | What it means | Next |
|---|---|---|
| 2 or 3 of 3 professionals active in 3 or more of 4 weeks | They'll do it | Build Phase 1 of the spec. Use the answers to settle its open questions: how long before an adopter can sign, and who can adopt. |
| 1 of 3, or active but under 10 minutes a week | Interest without time | Try a shorter commitment: two 2-week sprints, or adopting one milestone instead of a project. Run it once more. |
| 0 of 3 | Not as designed | Stop. Use the interviews to decide between mentoring a person or dropping it. |

Also write down, whatever the result: whether the teams posted more often than before, and whether every
team asked for and got its mentor signature. Those decide whether Phase 1 is worth it for students, not
just for professionals.

## Watch out for

- **Employers with export-controlled work.** Pratt & Whitney, Electric Boat and Sikorsky do defense
  work. Tell professionals up front to keep comments to the students' project and never mention their
  own work. If a company asks, this is volunteering on public student work.
- **One person deciding the result.** With 3 people, one dropout moves the result by a third. Read the
  interviews before the numbers.
- **Founders doing the mentoring.** If Josh or Ian end up answering the teams' questions because a
  professional went quiet, mark that week inactive. Don't cover for them.
- **The weekly caps.** A member can send 10 vouch requests a week, and each milestone can have 3 open
  asks. That's far more than the pilot needs, but don't use the pilot milestones for other vouches.
