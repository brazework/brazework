# Brazework Demo University

A whole school to show on a sales call: log in as the dean, the professor or a student and walk the loop.
Made-up people and work, built by `web/e2e/demo-university.sh` (people) and `web/e2e/demo-university.sql`
(everything else).

## What's in it

| Who | Email | What to show |
| --- | --- | --- |
| Dean (the school's admin) | `dean@<domain>` | School: students, classes, verified work, courses run on Brazework, **evidence by ABET outcome** and both CSV exports |
| Professor | `prof@<domain>` | ME 410 · Capstone Design: modules, the gradebook (released grades, a late hand-in, an accommodation), ABET attainment, the design review with peer ratings, a quiz with its answer key, attendance across four lectures, the class board with a milestone waiting to verify |
| Teaching assistant | `ta@<domain>` | The same course as staff: grading and attendance |
| Students | `ava`, `ben`, `cleo`, `dev`, `eli`, `fay` `@<domain>` | Due next, the quiz to take, released grades and feedback, rating teammates, check-in, verified milestones on their record, the robotics club |

The course is mid-semester: the requirements memo is graded and released (rubric rows tagged with ABET
outcomes 1, 2 and 3), the greenhouse team's design review is graded with peer ratings in, the
stair-climber team's waits, a gear-trains quiz is open, and the build-and-test module is still a draft.

## Run it locally (today)

```bash
cd web && e2e/local-supabase.sh up && e2e/demo-university.sh
```

The domain is `demo.brazework.test` and the password is the local test one. Point `npm run dev` at the
local stack to click through it. Running it again rebuilds the class and club.

## Host it for sales calls (when we have the domain)

Never production. A demo school lives in its own Supabase project, so nothing in it can reach real
students or real grades.

1. **Domain.** Pick the demo domain (for example `demo.brazework.com`) and point a Vercel project at
   it (a second project, not `forge-app`).
2. **A demo Supabase project.** New project in the Brazework org, named `brazework-demo`. Apply every
   step in `supabase/order.txt` in order (the same way CI builds a fresh database).
3. **Seed it**, from `web/` (the script refuses the production project in `web/.env.local`):

   ```bash
   DEMO_URL=https://<demo-ref>.supabase.co DEMO_ANON=<demo anon key> \
   DEMO_DB_URL=<demo database connection string> DEMO_DOMAIN=demo.brazework.com \
   DEMO_PASSWORD=<a new password> e2e/demo-university.sh
   ```

4. **The demo site.** Set the Vercel project's Supabase variables to the demo project's, deploy main.
5. **Before each call**, run step 3 again: it rebuilds the course, so every demo starts from the same
   mid-semester state.

Keep the demo password in the founders' password manager, never in the repo or a doc.
