# Brazework: strategy to YC and to revenue (updated 2026-11-26: schools first)

Builds on [positioning.md](positioning.md) (market research, with sources). Numbers marked *assumption* are hypotheses to test, not facts.

## The realignment (2026-11-26): the school is the customer

Brazework is sold to schools as the tool they use to run and track student projects, in class and in clubs. **Schools pay; students, clubs and the people who sign stay free.** Employers can pay too, but they come second and never drive the product.

**Why a school pays.** A school pays for what it is measured on. A place for students to post projects won't get a budget line (Handshake taught career centers to expect student software for free). Brazework earns one as the tool faculty use to assign, follow and verify project work, and by showing the school its outcomes:

| What the school gets | Who buys it | What Brazework uses |
|---|---|---|
| Accreditation evidence (ABET student outcomes: design, teamwork, solving real problems) | Engineering dean, department chairs | Class and club projects, milestones, teammates, files and 3D models, faculty verification |
| Club and engagement reporting | Student life / engagement office | Club pages, club projects, activity and membership numbers |
| Job placement data | Career center | Employer views, contacts and hires of the school's students |
| A public showcase of student work | Admissions, marketing, advancement | Public projects, clubs and the school's page |
| A record of class projects by course and semester | Provost, registrar, faculty | The student portal (below) |

Accreditation is the strongest pitch: faculty assemble that evidence by hand every cycle, and the buyer (the engineering dean) has the budget.

**Why this is a better model than companies first.** Companies only pay once there's enough verified talent to search, which needs scale we don't have. A school's offices already own budgets for the outcomes above, faculty verification makes the record stronger for students and employers alike, and a school whose classes and semesters live in Brazework renews. The risks are speed (6 to 12 months from first conversation to contract, through budgets, procurement, IT and FERPA review) and cold start (a dashboard with nothing in it sells nothing). So the free student and club side stays the front door, and sponsorships and the hiring plan can bring in cash while pilots run.

**Price** (`SCHOOL`, `CAMPUS_BANDS` and `TALENT` in `web/src/lib/pricing.ts`; first picks to test). Never per club or per student, and every school pays, pilots included:

| | Price | Why this number |
|---|---|---|
| Semester pilot | $1,500, one department, credited toward the first year | Small enough for a chair to approve; real money, so it tests intent |
| Department | $6,000 a year with 5 faculty seats, $600 per extra seat (10 seats: $9,000) | Under the amount most schools can sign without a formal bid, so a dean or chair can say yes |
| Campus | $18,000 (up to 5,000 students), $30,000 (up to 15,000), $45,000 (above) a year; every department, unlimited faculty | Banded by enrollment, not by who joins; in line with or below the student-org and assessment tools campuses already buy. Past 25 seats a campus costs less than a department, and the price list says so |
| Recruiters | Starter $4,800 a year (1 seat); hiring plan $15,000 (2 seats); sponsorships $2,500 per chapter per semester, all to the club, plus a $500 fee | Starter lets smaller and local employers in |

Hosting and AI cost per school is small, so the margin is high (about 90%, *assumption*). Ten department deals and five campuses are about $200,000 a year. A per-club or per-student price would give a school a reason to keep people off.

**The student portal** (the build order below says which pull request does what).
1. **School email registry.** Students join with their university email; the domain places them in their school automatically (`school_domains` and `is_school_email()` exist; automatic placement doesn't yet). Students at schools that haven't signed up are still grouped by school, so they're there when it does.
2. **Your school in the sidebar**, under Clubs: the school's page, its verified clubs and, later, the student's classes this semester. (Shipped as a first step on 2026-11-26: the school's page and clubs, or an invitation to bring the school.)
3. **Faculty sign-on.** Faculty accounts come only from the school's own list, not from anyone with a school email, because only faculty verify class projects.
4. **Class projects with faculty verification.** A teacher creates a project and assigns a group, or a student lists their project under a class they take. The teacher sees every project in the class and verifies the work and each student's part. Each class project shows on every group member's profile with the class and semester.
5. **Classes and semesters from course records**, starting with a CSV upload of classes and rosters each semester, then integrations (Banner, Colleague, Workday Student; Canvas, Blackboard, Moodle) as each school's IT approves them.
6. **School reports:** accreditation evidence export, engagement dashboard, placement data, branded showcase.
7. **Student to professional.** At graduation the student moves the account to a personal email (both addresses confirmed); every project and verification stays theirs, and the school's records still show where and when the work was done.

**One record, three kinds of buyer.** Every surface reads the same verified-work record, so nothing is bolted on:

| Who | Uses | Pays |
|---|---|---|
| Students and clubs | Projects, verification, their record | Never |
| **Universities** (the main customer) | The portal: classes, faculty verification, reports | Every school, pilots included: a $1,500 semester pilot, then a department ($6,000 a year) or the campus (from $18,000) |
| Recruiters | Search by verified work, message students, sponsor clubs | Starter ($4,800), hiring plan ($15,000), sponsorships |
| Handshake, LinkedIn, applicant-tracking systems (Greenhouse, Lever) | Read verified work, with each student's consent | Partner access, once a few campuses are live |

The flow: a student joins with their school email and is placed at their school; their classes come from the roster; each project sits under a class or a club; the professor or officer verifies it; it lands at once on the student's record, the school's reports and recruiter search; the student can add it to LinkedIn or Handshake as verified.

**Blackboard, Canvas, Moodle: win the project course.** An LMS is built for readings, quizzes and a gradebook, and no school will swap it out. It is bad at project courses (capstones, design and lab courses, and club builds), and that is where Brazework wins outright: "run your project courses on Brazework." A professor runs the whole course here and the LMS only keeps the final grade.

| In a project course | Blackboard / Canvas | Brazework |
|---|---|---|
| Teams | A group set | Teams with roles, each member's part on record |
| Progress | One file per assignment | Milestones against the professor's deliverable schedule (proposal, design review, prototype, final) |
| Teamwork | Nothing; schools buy a separate peer-evaluation tool (CATME and the like) | Peer evaluation built in: each teammate rates contribution |
| Evidence | Files in a course shell | CAD you can turn, test logs, video, and who verified it |
| Accreditation | Faculty assemble ABET evidence by hand | Faculty tick the ABET outcomes a milestone shows when they verify; the export is grouped by outcome |
| Industry sponsors | Can't see the course | Sign off results by email (built) |
| After the course | The shell is archived | The verified work stays the student's |

Integration is **LTI 1.3**, which all of them support: a teacher adds Brazework to a course, students click in with no new login, the roster comes across (Names and Role Provisioning), and the final grade goes back to the LMS gradebook (Assignment and Grade Services), so grades still never live on Brazework. Build it once a paying school's IT asks; until then a CSV roster each semester and grades entered as today.

**Partners and LinkedIn, in two steps.** Now, with no partnership: an "Add to LinkedIn" button on every verified project (LinkedIn's public add-to-profile link for a certification, pointing at its `/v/<id>` verify page), and the verify page itself, which anyone (a recruiter, a Handshake or LinkedIn viewer) opens to see who signed and with what evidence. Later: a Verified Work API that Handshake, LinkedIn or an applicant-tracking system licenses, read-only and per student consent. That is the network for YC: they have the profiles; Brazework holds the proof.

**Build order (one pull request each, every step working on its own):**
1. School-first site, `/schools`, the paid pilot, the trimmed navigation and Your school (2026-11-26).
2. Students placed in their school automatically from their email domain, including domains not registered yet (grouped by domain from day one).
3. Faculty accounts from the school's own uploaded list; only they verify class projects.
4. Classes and semesters from a CSV upload; class projects (teacher-assigned groups, or a student lists their project under a class); faculty verification of the work and each student's part; private to the class by default.
5. The school dashboard: engagement, verified work by class and department, the accreditation (ABET) evidence export, placement.
6. Student to professional: move the account to a personal email, both addresses confirmed, everything kept.
7. The project-course toolkit: a deliverable schedule per class, peer evaluation, and ABET outcomes ticked at verification (the export grouped by outcome). This is what makes a professor run the course on Brazework instead of the LMS.
8. "Add to LinkedIn" on verified work, a partners page, then the Verified Work API.
9. LTI 1.3 for Blackboard, Canvas, Moodle and D2L (sign-in, roster, final grade back), when a paying school asks.

**To settle before building classes.** FERPA: a data agreement with each school; class projects private to the class by default; the student chooses what goes public; grades and teacher notes never public. Faculty proof: from the school's sign-on list only. Email change: confirm both addresses so nobody takes over a record.

**Go-to-market.** One campus first: the University of Hartford (162 student organizations already listed). A paid pilot for one department or a few classes for a semester gets real use and a first reference customer; use the pilot's numbers to sell the full campus.

## The one-pager

| | |
|---|---|
| **Problem** | AI made résumés and profiles free to fake: 91% of recruiters have caught candidate deception, and 1 in 4 candidate profiles may be fake by 2028. STEM students build real things in clubs, but the proof lives in group chats and lab notebooks, where no one hiring can see it. |
| **Product** | The record of your work, signed by the people who saw it. **Clubs run on it** (members, events, chat, announcements, with Ember, the AI agent, doing the busywork). **Members post projects** (photos, video with callouts, specs, the tools). **Club officers, who saw the work happen, verify each milestone** with its evidence, and their name stays on it. **Companies find people by that proof** and sponsor the clubs behind it. |
| **Why us, why it's defensible** | Verification is a social act only the club can perform, so the trust graph is ours: who vouched, when, with what evidence. Each verified milestone makes a profile more valuable to its owner and the whole network more useful to companies, and a club's history carries across officer turnover. Competitors either have the audience without the proof (LinkedIn, Handshake) or the admin without the careers outcome (Presence, Engage). |
| **The habit** | A weekly loop that pays off: post what you built, get it verified, see who looked (Your week, the digest, "viewed by 3 companies"). Officers come back every Monday for Ember's brief. Clubs live on it, so it's where the chapter actually happens. |
| **Business model** | *(Superseded 2026-11-26: schools are the main customer, see the realignment above; the employer prices below still stand as the second line.)* Free forever for the people who build, students and working professionals alike, and for clubs (the supply side and the trust). Companies pay first: chapter sponsorships ($2,500 per chapter per semester, all of it to the club, plus a separate $500 service fee; Brazework takes no cut) and a hiring plan for verified-work search ($15,000 a year: 2 search and messaging seats; sponsorships separate). Then universities (a $6,000 portal with 2 advisor seats, plus $1,200 per extra advisor; never per club) and national organizations (a network license). |
| **Go-to-market** | Atomic network: one club of 30–100 people, useful on day one. Design partner: NSBE @ UHart, then the other engineering clubs, then nearby campuses through officer-to-officer intros, then national organizations (NSBE, SHPE, SWE) once 20+ chapters are live. First sponsors: Connecticut employers that already recruit at NSBE (Pratt & Whitney, Collins, Electric Boat, Sikorsky). |
| **What we'll show YC** | 40%+ of a pilot club's members active weekly for 8 weeks; 15+ verified milestones in the first month; organizations growing 5–10% a week; companies messaging members; one paid sponsor pilot or signed LOI. |
| **Where we are (Nov 2026)** | The full loop is built and tested (84 end-to-end checks): club, projects, verification with evidence and revocation, company search, sponsored challenges, Ember. Live in production on the new name; the pilot with the UHart chapter is next. |

## 1. What Brazework is, in one line

**Brazework is the record of your work, signed by the people who saw it.** It is for anyone who builds, at any stage: a student signed by a club officer, an employee signed by a coworker, a freelancer signed by a client (Josh's call, 2026-11-16, FIX-120). We still launch inside university clubs, because a club is the smallest group that is useful with nobody else there. Organizations run on it, members prove what they've built, and the companies and universities that hire find them there. Ember, the AI agent built in, does the organization's busywork.

- **YC "describe it in 50 characters":** *Your work, signed by the people who saw it.*
- **Why it matters now:** AI made résumés and profiles free to generate. 91% of recruiters have caught candidate deception (Greenhouse, 2025), and Gartner expects 1 in 4 candidate profiles to be fake by 2028 (sources in positioning.md). Work that someone else saw happen is what still carries signal, and today it's buried in group chats and lab notebooks.

## 2. The product loop

1. **An organization runs on Brazework.** A chapter, club, lab or team: members, events, chat, announcements, roles. Ember plans meetings, drafts updates from real numbers and handles follow-ups.
2. **Members prove the work.** Projects with photos, video and write-ups; officers verify milestones they saw happen. Brazework records who vouched, when, and the evidence.
3. **The right people find it.** Companies, universities and alumni find people by verified work, sponsor the organizations behind it, and reach out through a request inbox.
4. **Members land opportunities and bring the next organization.**

The atomic network is **one organization of 30–100 people**: useful on day one with zero outside network.

## 3. Who pays (and who never does)

Free, always: **members and student organizations.** That's the supply side and the trust.

| Customer | What they buy | Budget it replaces | First price to test (*assumption*) |
|---|---|---|---|
| **Companies** (first revenue) | Chapter sponsorships with real ROI reporting; search by verified work; events beside the organizations they support | Diversity and campus recruiting spend that already flows to NSBE, SHPE and SWE (conference booths, chapter sponsorships) | $2,500 per chapter per semester, all of it to the club, plus a separate $500 service fee; challenge prizes from $5,000 plus a $500 service fee; hiring plan $15,000 a year (2 search and messaging seats; sponsorships separate) |
| **Universities** | A showcase of the school's STEM work for prospective students: its verified clubs and what they're building. Plus every student organization on one platform, and outcomes: verified projects, events, employer connections | Student-org management platforms. UHart already lists its organizations, including NSBE, on Presence ([hartford.presence.io](https://hartford.presence.io/organization/national-society-of-black-engineers)) | $6,000 a year for the portal with 2 advisor seats, plus $1,200 per extra advisor (about $13k for a campus with 8 advisors). Never per club: a per-club price would give a school a reason to keep clubs off. Pilots are paid too ($1,500 for a semester, credited toward the first year) |
| **National organizations** (NSBE, SHPE, SWE, IEEE, ASME…) | Chapter health across the network, member engagement, sponsor reporting | Chapter management tools and spreadsheets | Network license, priced per active chapter |
| **Later: AI labs and the expert market** | Access to verified STEM experts (with consent) | The market Handshake and Mercor proved: Handshake's AI-training work is about $1B of its ~$1.15B run rate | Marketplace take rate |

### The pitch to schools

**Show prospective students exactly what your STEM clubs are building.** Every university says it has hands-on engineering and science; Brazework shows it, with real builds, verified milestones and the companies working with its clubs.

- **How a school joins:** schools don't sign themselves up. A school gets in touch, and the Brazework team sets up its official account and its admins (`set_up_school()`). That's what makes "official" mean something: students and companies can trust the school's page is really the school.
- **Its clubs, verified by the school:** a club that operates under the school asks to be verified as one of its clubs, with proof such as its listing in the school's student-organization directory. The school's admins approve it (the Brazework team covers this until a school is set up). Verified clubs carry a "Verified club of <school>" badge and are listed together under the school.
- **What the school gets:** one page showing every verified club and what its members are building right now, which admissions can send to prospective students and their parents. It also shows employers and partners the school's STEM work, and gives the school outcomes it can measure.
- **Why schools will pay:** it turns student activity the school already funds into a recruiting asset, and it replaces a student-org platform it already pays for (see Presence above). Built so far: official school accounts, club verification and the school's club list (step 56, Nov 2026). Next: the school's public page.

**Why this can be very large (illustrative, not a forecast):** about 4,000 US degree-granting institutions; if 1,000 campuses pay about $13k that's $13M ARR. 3,000 employers at $15k is $45M. National-organization licenses add to that, and the verified-expert marketplace is a separate, larger market. The asset under all of it is the **verified work graph**, which gets more valuable with every milestone and is hard to copy because it's attested by organizations, not self-reported.

## 4. The AI angle (core, not a feature)

1. **Ember runs the organization.** Officers are students with no time. If Ember plans the meeting, drafts the update, chases the RSVPs and writes the sponsor report, the organization runs on Brazework because it's less work, not more. That's the retention engine.
2. **Verified work is AI-readable trust.** As hiring moves to AI screening and AI agents, they need signal that can't be generated. Brazework's verified milestones are structured: who vouched, when, evidence. Expose them to recruiters' tools through an API and MCP (members' own MCP access already exists).
3. **Your Brazework in any AI.** Members connect Claude, Cursor or any MCP client today (read-only, revocable).

Rule for the brand: **AI does the busywork, never the talking.** Ember drafts; people approve. Brazework never posts on anyone's behalf without a tap.

## 5. Go-to-market: start at home

### Design partner: the NSBE chapter at UHart

The chapter (in CETA) is described as being in "a resurgence" ([UHart](https://www.hartford.edu/unotes/2023/02/uharts-national-society-of-black-engineers-nsbe-provides-opportunities-for-black-engineering-students.aspx)), and NSBE nationally has 24,000+ members across 600+ chapters ([nsbe.org](https://nsbe.org/)). Win this one chapter completely, then use it as the reference.

Don't say "NSBE partner" publicly until NSBE agrees; say "built with student chapters at UHart."

**First 6 weeks:**

| Week | Goal | Measure |
|---|---|---|
| 1 | Set up the chapter with the officers in person: roles, members imported, next 3 events on Brazework | Every officer active; 20+ members joined |
| 2 | Run the general body meeting through Brazework (event, RSVPs, attendee chat); Ember drafts the recap | 60%+ of members RSVP on Brazework |
| 3 | First verified milestones: each member posts one project; officers verify | 15+ verified milestones |
| 4 | First sponsor conversation with a Connecticut employer, using the chapter's Brazework record | One sponsor meeting booked |
| 5 | Bring the next 2 CETA organizations (e.g. ASME, IEEE, SWE, SHPE chapters) with the NSBE officers' intro | 2 more organizations live |
| 6 | Review: weekly-active rate, what Ember saved officers, what members want | 40%+ weekly-active for 4 straight weeks |

**Connecticut employers to approach first** (big engineering employers that recruit at NSBE events): Pratt & Whitney (East Hartford), Collins Aerospace, General Dynamics Electric Boat, Sikorsky. Ask for a **paid pilot sponsorship of one chapter**, not a platform sale.

### Then

1. **Campus:** every CETA organization, then all of UHart's STEM organizations. Pitch the university on outcomes once 5+ organizations are live.
2. **Region:** NSBE Region 1 (Northeast) chapters through officer-to-officer intros and the regional conference. Other identity-based STEM societies (SHPE, SWE, oSTEM) follow the same playbook.
3. **National organizations:** after 20+ chapters, offer a network license with chapter-health reporting.

## 6. Marketing

**Positioning line:** *Verified work, not résumés.* Everything else supports it.

**One message per audience:**
- **Student organizations:** "Run your chapter in one place. Ember does the busywork."
- **Members:** "Your work, on the record, vouched for by people who saw it."
- **Professionals:** "Mentor the chapters in your field and get found for what you've built."
- **Companies:** "Hire from proof, not keywords. Sponsor where the building happens."
- **Universities:** "See what your students build, and prove it to employers and accreditors."

**Channels that fit a two-founder budget:**
1. **Officer-to-officer.** Chapter presidents trust each other. Give every founding organization a referral path and a "founding organization" badge.
2. **Proof drops.** Short videos of real member builds, posted by the members, with "verified by [chapter]." This is the content engine: real work, not ads.
3. **Campus moments.** Run a "Proof Week" each semester: every member posts one project, officers verify, the best get shown to sponsors at a demo night.
4. **Sponsor reports as marketing.** A one-page "what our chapter did this semester" that Ember generates. Companies forward it; universities ask for it.
5. **Founders build in public.** Weekly numbers and lessons on LinkedIn and X; it's also YC evidence.
6. **Regional conferences.** A table and a live "verify your project" station.

**Brand rules:** plain language, real work over hype, no fake numbers, AI as the helper not the face. Every claim on the site has to be true today (the landing page labels example data as such).

## 7. What YC will want to see

- **Engagement:** share of a pilot organization's members active each week (target 40%+ for 8 weeks; 25% is good for consumer social, 45% great).
- **Growth:** organizations live, week over week (5–7%/week is good, 10% exceptional).
- **Proof of the loop:** verified milestones per week; messages from companies to members; organizations referred by other organizations.
- **Money:** one paid sponsor pilot or signed LOI before applying.
- **Founders:** a go-full-time trigger, e.g. 3 organizations above 40% weekly-active for 8 weeks plus one paid pilot.

### Draft application answers

- **What are you making?** A record of what people build, signed by the people who saw it. It starts in student organizations: chapters run on it, officers sign members' work, and employers and universities find them. The same record keeps going after graduation, signed by a coworker or a client. An AI agent runs the organization's busywork.
- **Why now?** AI made résumés free to fake, so hiring needs proof. And AI agents are finally good enough to run the operations that student organizations drop.
- **How will you make money?** Free for members and organizations. Companies pay for sponsorships and search; universities and national organizations pay for campus- and network-wide tools.
- **Competition?** LinkedIn (noise, AI-written posts), Handshake (career-center led; most revenue now from AI training), Presence/Engage (student-org admin without careers or AI), Discord/GroupMe (where organizations live today, but chat disappears). Brazework is the only one where the organization's work becomes verified career proof.
- **What do you understand that they don't?** Profiles were never the problem; trust is. LinkedIn is where you *say* what you did, and Polywork and Read.cv were nicer ways to say it. Brazework is where the people who saw it *confirm* it: your club, your team, and the companies that set the challenges.

### How we compare (for the competition answer and the interview)

| | LinkedIn | Polywork (shut down Jan 2025) | Read.cv (wound down Jan 2025) | Brazework |
|---|---|---|---|---|
| Built around | The résumé and your network | A personal "what I'm doing" timeline | A minimalist CV and portfolio | The project: a living build log |
| Who vouches | Nobody (identity only) | Nobody: self-reported | Nobody | Club officers sign milestones by name; pro verification; vouches |
| Unit of community | Individuals | Individuals | Individuals | The club: chapter, events, chat, verification |
| Teams | Name teammates | Collaboration requests | None | Owner, admins, teammates and viewers; each builds their own proof |
| While building | Nothing | Nothing | Nothing | Private until finished, public in one click |
| Engineering work | Photos and PDFs | Posts and links | Images and links | CAD, rotatable 3D models, code, GitHub activity |
| Earning credit | Self-added certificates | None | None | Sponsor challenges entered with real projects |
| AI | Writing help | None | None | Ember across the whole app, and your own AI tools via MCP |
| Direction | Job search | None | None | Goals: what to work toward, with Ember suggesting the next step |
| Who pays | Recruiters, Premium | Never found it | Never found it | Companies sponsoring clubs and challenges; later universities |

**Why Polywork and Read.cv failed, and what we do differently:**
1. **No atomic network.** Polywork raised $44.5M and still shut down: a personal profile is worth little until everyone is there. Ours is one club, useful the day it runs its events, chat and verification on Brazework, before anyone else joins.
2. **Self-reported, so copyable.** LinkedIn can match a nicer self-written page in a quarter. It can't match a milestone signed by a named officer inside that club's history.
3. **No buyer.** Neither found who pays. Companies already spend campus-recruiting money; sponsored clubs and challenges give them something concrete to buy.
4. **Horizontal from day one.** "Everyone's personal brand" is LinkedIn's home ground. Our positioning is now for anyone who builds (2026-11-16), which makes this the risk to watch: the message is broad, so the launch has to stay narrow. Signed work, inside one club at a time, for the companies that hire from it, is a start LinkedIn serves badly. A working professional can join and be signed by a coworker today, but we don't go looking for them until a campus is active.

**Where we could still look like them (watch this):** an update feed without proof is Polywork's product, and a profile that leads with bio and links is Read.cv's. Proof leads every profile, and the cold start is the same risk that killed both, which is why one campus has to be truly active (the UHart NSBE pilot) before we expand.

## 8. Product priorities to support this

*Re-ordered 2026-11-26: the student portal steps in the realignment above come first; the list below is the earlier, company-first order.*

1. **Ember for officers:** meeting planning, recaps, RSVP follow-ups, member engagement check, sponsor report.
2. **Sponsor report:** a semester summary per organization, shareable.
3. **Company side:** search by verified work, sponsor pages, sponsorship checkout.
4. **University dashboard:** organizations, engagement, outcomes.
5. **Production:** finish the database steps (34–36 left, FIX-25), add `ANTHROPIC_API_KEY` (FIX-15), real email (FIX-1), then open the site publicly.
6. **iPhone app:** TestFlight and push notifications once the web loop is proven at UHart.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Officers are busy and turnover each year | Ember does the work; set up in person; the organization's history stays on Brazework across officer changes |
| Members don't come back weekly | Events, chat and announcements live on Brazework, so it's where the chapter actually happens |
| Implying an NSBE partnership too early | Say "built with student chapters at UHart" until NSBE agrees; then pursue a formal pilot |
| Universities already pay for Presence or Engage | Don't compete on admin; win on career outcomes and AI, and start with organizations, not IT procurement |
| School sales take 6 to 12 months | Start with one department's paid pilot ($1,500, credited toward the first year); sponsorships and the hiring plan bring cash meanwhile |
| Class records are FERPA-protected | A data agreement per school; class projects private by default; grades and teacher notes never public |
| A school dashboard is empty without students | Students and clubs stay free and are the front door; sell to a school only once its students are on Brazework |
| Verification gamed | Only officers verify; Brazework records who verified; reports and blocking; later, evidence requirements per milestone |
