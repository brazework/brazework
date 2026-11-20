# Playbook lanes: studying and working

Date: 2026-11-20 · Status: **approved by Josh in conversation** ("Approve it", with Claude's three defaults) · Linear FIX-209

Josh asked what the flow should be in each field, for a student and for a professional, so both can fit
Brazework into how they already work. Claude recommended one loop with two lanes; Josh said "Write the
lanes spec". Nothing here is built. A second reader checked this document against the code on `main`
(b03c199); what that changed is marked below.

## Intent

Someone who works connects their assistant and gets a flow that fits work: the right moments, the right
person to sign, and confidential work kept out of sight. A student already gets that for clubs and
classes. Both use the same record and the same loop:

> finish something in your own tool → your assistant drafts it with proof → you say yes → someone who
> saw it stands behind it → it's on your record

Only four things differ between a student and someone who works: what counts as done, what the proof
is, who the witness is, and what the record is for. The playbooks are where an assistant learns those
four things, and today they only know the student's answers.

## Why now

The product moved and the playbooks didn't:

- The landing page tells six stories. Four are people who work: an engineer, an analyst, a designer, a
  teacher (`HERO_STORIES`, `web/src/lib/landing-demo.ts`).
- A work email can sign, labelled when the company isn't verified (#163).
- A merged pull request names who approved it on GitHub, with nobody asked (#164), and the last 90 days
  of merged pull requests are one tap from the record (#165).
- Private work can carry one public line (#112), and the review packet prints signed work for a review
  (#110).
- Sign-up already asks Student or Professional, and Settings calls them Studying and Working
  (`profiles.account_type`, `supabase/account-type.sql`).

But each of the 20 playbooks (`web/src/lib/mcp-playbooks.ts`) has one list of moments and one line of
signers, and both describe a student. The examples are club and class work ("Balsa truss held 48 kg").
Nearly every signer is someone at a university: officers, TAs, professors, PIs. Software adds "a
manager" and Design adds "a client"; no field names a tech lead. A working mechanical engineer who
types `/shipped` is steered toward a club they aren't in.

This follows the positioning Josh chose on 2026-11-16 (FIX-120): one record, and studying or working is
a detail. Here the detail belongs to the piece of work.

## Found while reading (these change the design)

1. **A milestone logged from chat starts hidden and stays hidden.** `milestones.private` defaults to
   true (`supabase/verification.sql`), `tool_insert_milestone` never sets it
   (`supabase/mcp-workflows.sql`), and nothing flips it when a club verifies. Only the member showing or
   sharing it in the app does (`web/src/lib/milestones.ts`, `supabase/proof-cards.sql`). So confidential
   work doesn't show by accident. The gap is the other way round: from chat nothing can show a
   milestone, and nothing can write a hidden milestone's public line.
2. **The server tells assistants the opposite.** `log_milestone`'s description says "It shows on the
   member's profile only once verified or signed" (`web/src/lib/mcp.ts`). The database's result says the
   same ("It shows on your profile once they do", `supabase/mcp-workflows.sql`), but that line never
   reaches an assistant: `ok()` in `web/src/app/api/mcp/route.ts` replaces it with the server's own next
   step (`web/src/lib/mcp-results.ts`). Corrected while planning the build.
3. **An assistant can't tell a student from a professional.** `mcp_me` returns the headline, field,
   interests and counts (clubs among them), but not `account_type` (`supabase/mcp.sql`).
4. **`student` means a school email.** Everyone else is `professional`, including someone studying who
   signed up with a personal address or with Google, GitHub or LinkedIn
   (`supabase/account-type.sql`). So `professional` alone doesn't mean "has an employer". The app
   already handles this: Home's first steps treat "professional and in no club" as working, and
   students and anyone in a club as before (`web/src/lib/guide-steps.ts`).
5. **GitHub backing doesn't happen from chat.** `checkBacking` runs only in the app's own forms and the
   90-day picker (`web/src/lib/milestones.ts`, `web/src/lib/recent-work.ts`). A merged, approved pull
   request logged through `log_milestone`, or drafted by the GitHub Action and approved, is saved with
   no backing and waits for a signature.
6. **A post is hidden only when its project is private.** Posts have no hidden state of their own
   (`supabase/project-access.sql`). A project made from chat is always public (`tool_do_project`,
   `supabase/tool-actions.sql`). A private project's updates, milestones and files are hidden from
   everyone but the owner and the people they added, but its card (title, summary, topics) still shows
   on the profile.
7. **The review packet leaves hidden work out unless it's ticked** (`?private=1`), and lists only
   verified or signed work, so work that is only backed isn't in it.
8. **`my_projects` already says which projects are private**, and **no signer can be a client**: the
   relationships are professor, ta, pi, manager, mentor and other.
9. **The docs are tested against the playbooks.** `web/tests/mcp-playbooks.test.ts` checks that
   `docs/mcp-workflows.md` covers every field and prompt, and that no playbook claims a tool connection
   that wasn't checked.

## Approaches considered

- **Two lanes inside each playbook (picked).** Each field keeps one playbook and one address
  (`brazework://playbooks/<id>`), with a Studying part and a Working part. The tools list is shared.
  The lane is chosen for each piece of work. Costs one type change that the resources, the prompts,
  `/ai` and Settings all read, and 20 working moments to write.
- **A second set of playbooks for people who work.** Forty resources (`…/software-work`). The quickest
  to build, but the index doubles, the two sets drift apart, and a person is forced to be one or the
  other. An intern is both in the same month.
- **One shared "at work" block, no per-field working moments.** One paragraph of rules added to every
  field. The cheapest, and the rules really are the same everywhere. But the prompts quote the field's
  example as the model for the title, so a working civil engineer would still be shown a balsa truss.
  The assistant copies examples more than it follows rules.

The picked approach uses the third as its first layer: the working rules are written once and shared,
and each field adds its own working moment and signers on top.

## The design

### The lane belongs to the work

Two lanes, in the app's own words: **Studying** and **Working** (`study` and `work` in code). Working
covers employed, freelance and on your own; the signer for a freelancer is the client.

How the lane is chosen, in order. It follows the rule Home already uses (finding 4):

1. The `lane` argument on a prompt, when the member gave one.
2. A `student` account is Studying, with no question.
3. A `professional` account in no club is Working.
4. A `professional` account in a club is asked once: "Was this at work, or for school or a club?"
5. In any lane, once the member says the work was for an employer or a client (a job, an internship, a
   contract), the working rules apply.

### The unit of privacy is the private project

Work belongs on a private project. Its updates and milestones are then hidden from everyone but the
member and the people they add (finding 6), and each milestone can carry one public line. Its card
still shows, so the project's title and summary are written in general terms ("Checkout performance",
not a customer's name).

### What the working lane changes

| | Studying (as today) | Working |
|---|---|---|
| The moment | A test, run, result or launch for a club, class or lab | A release, an acceptance, an approval, a number that moved |
| The proof | Links anyone can open | Links only the member and the signer can open |
| Who signs | Club officers verify; a TA, professor or PI signs | A tech lead, manager or client signs, by work email |
| Before reading a tool | Nothing extra | Ask whether the employer allows it |
| The project | Public unless the member hides it | Private, with a title in general terms |
| A milestone | Hidden until the member shows it | Hidden, with one public line the member approves |
| A number (`/result`) | A post in the feed | A hidden milestone, never a feed post |
| Updates (`/standup`, `/week`) | Posts, after the member's yes | Only on a private project; otherwise written out, not saved |
| Rhythm the assistant suggests | `/shipped` or `/result` at the moment, `/week` on Friday | `/week` on Friday; `/standup` once there's a private project |
| Where it leads | `career_fair` and the résumé | The review packet, with hidden work ticked |

### The working rules, written once

Wording for the builder to polish; the meaning is fixed.

1. This is work for an employer or a client. Before you read any work tool, ask me whether my employer
   allows it. If I'm not sure, don't read it: I'll tell you what happened and give you a link.
2. Keep confidential things out of everything you write, the project's title and summary included: no
   customer names, no unreleased product names, no numbers my employer hasn't published. If it can't be
   said without them, say it in general terms.
3. Record it as a milestone. It stays hidden on my profile; don't offer to show it.
4. Never save a post about work unless the project is private (`my_projects` says which are). If it
   isn't, write it out for me and tell me I can make the project private in Brazework.
5. Who signs: the field's working signers, at their work address, never anyone on the Brazework
   project's team.
6. A merged pull request in a repo I've linked can be added from the project's "Your last 90 days" in
   Brazework, backed by its approvals with nobody asked. Say so, and don't claim anything logged from
   here is backed (finding 5).
7. Don't suggest a club for work, and don't send work to one, unless I name it myself. (Tightened in
   review: a milestone sent to a club is readable by its officers, so being in a club isn't a reason
   to send it employer work.)

### Where the rules live

Most people type a command with no arguments, or just talk, so the rules can't live only in a prompt
that was given `lane: work`:

- **A prompt with no lane** (the normal case) carries the lane steps above, the working rules in full,
  and for that command the step the rules replace (no club, a milestone instead of a post, a post only
  on a private project). It points to the playbook's working part for the field's example and signers.
  A lane typed in words it can't read is said back to the assistant, which then asks.
- **A prompt given `lane: work`** carries the rules in full, the working example and the working
  signers.
- **The playbook resource's working part** opens with the rules, for an assistant that reads it without
  a prompt.
- **The server's instructions and the milestone tools' descriptions** each gain one sentence: before
  recording work done for an employer or a client, read the working part of the field's playbook.

### A working moment for each field

One per field in v1. Every example is invented, as the studying ones are (see Decided 2 for who reads
them).

| Field | The moment | Example title | Proof | Who signs |
|---|---|---|---|---|
| Robotics | A cell or robot passes acceptance on site | Palletizing cell passed site acceptance: 11 cycles a minute over an 8-hour run | The acceptance report and the release it ran | The test lead, your manager or the customer's engineer |
| Aerospace | A part passes qualification | Bracket passed qualification vibration at 14 g RMS with no cracks | The test report and the drawing revision | The test engineer, your lead or the quality engineer |
| Mechanical | A design is released to production | Housing rev D released: 9 parts, down from 14, at the same load rating | The engineering change and the test report | Your lead, the manufacturing engineer or your manager |
| Electronics | A board passes validation | Controller board rev C passed validation: every rail within 2%, no rework | The validation report and the release | The hardware lead, the test engineer or your manager |
| Civil | A structure passes inspection, or a design is approved | Footbridge deck passed its load test at 1.5 times the design load | The inspection report or the permit | The engineer of record, the project manager or the client |
| Software | A change ships and a number moves | Checkout p95 latency down from 820 to 310 ms | The merged pull requests, the ticket and the dashboard | Your tech lead, a reviewer outside the project or your manager |
| Computer science | A system change is adopted | Scheduler change rolled out to every cluster: 14% fewer preemptions | The design doc, the merged change and the rollout report | The reviewing engineer, your lead or your manager |
| Data & AI | A model goes live and holds its number | Fraud model live for 30 days: recall 91% at 0.5% false positives | The evaluation report and the model card | The ML lead, the product owner or your manager |
| Mathematics | A model or method is adopted | Reserving model adopted for the quarter close: back-test error under 2% | The write-up and the back-test | The head of the team that adopted it, or your manager |
| Physics | An instrument meets its spec | Detector reached 1.8% energy resolution at 662 keV, inside spec | The calibration report and the run log | The group lead or the facility manager |
| Chemistry | A process scales | Scaled the coupling step from 5 g to 2 kg at 84% yield | The batch record and the certificate of analysis | The lab head, the quality lead or your manager |
| Biology | An assay is validated | Assay validated: under 8% variation across three operators | The validation report | The lab director or the study director |
| Environment | A plan or report is accepted | Stormwater plan approved by the county on first submission | The approval letter and the report | The project manager, the client or the agency's reviewing engineer |
| Space | A unit passes acceptance | Flight radio passed thermal vacuum: 8 cycles, no anomalies | The test report and the as-run procedure | The test conductor, the systems lead or your manager |
| Medicine | A quality-improvement project moves its measure | Discharge checklist cut 30-day readmissions on one ward from 14% to 9% | The aggregate report, never patient data, with the institution's approval | The department head or the medical director |
| Business | A target is hit | New pricing tiers cut churn 9% | The pilot results, totals only | Your manager, the director who owned the target, or the client |
| Design | A redesign ships and moves a number | Checkout redesign lifted conversion 12% | The design file and the test report | The client, the product lead or your manager |
| Media | A piece is published and performs | Launch film reached 480,000 views, 58% watched to the end | The published piece and the analytics summary | The client, the commissioning editor or a producer who isn't on the project |
| Social science | Findings change a decision | Tenant survey (1,150 responses) led the council to extend rent relief | The report and the council minutes | The research director, the client or the body that commissioned it |
| Education | A unit lifts results | Fractions unit lifted quiz scores 18% | The unit plan and aggregate scores, never individual students | The head of department or the principal |

The Software and Design examples are the landing page's own, so the assistant and the front door tell
the same story. When this table was approved the Business and Education ones were too; the landing page
changed the same day (#170) and now tells its own Mechanical, Electrical and Civil stories ("Bracket 38%
lighter, passed the 3.2 g vibration test", "Power board rev C: ripple down from 120 to 18 mV",
"Retaining wall pour passed inspection, zero rework"). Whether those three fields should use the landing
page's examples is a question for the read in Decided 2.

### Which fields get checked first

All 20 ship together, because the content is data. They fall into four families by how "done" shows up,
and the builder walks one field from each family end to end on the local demo members, in this order:

1. **Code and data** (Software, Computer science, Data & AI). Done is an event in a system.
2. **Hardware you test** (Robotics, Aerospace, Mechanical, Electronics, Civil, Space). Done is a test
   that passed; a person has to say so.
3. **Lab and research** (Mathematics, Physics, Chemistry, Biology, Environment, Medicine, Social
   science). Done is a result with its number; totals only.
4. **Made for people** (Business, Design, Media, Education). Done is a launch or a response.

## The pull requests

### PR 1: lanes in the playbooks and prompts

- **The type.** A playbook has its shared `tools`, and a `study` and a `work` part, each with `moments`
  and `signers`. Today's moments and signers move into `study` unchanged.
- **`me` returns `account_type`.** One database step replaces `mcp_me`. The tool's description says the
  field picks the playbook, and the account type and the clubs count pick the lane.
- **The tool descriptions stop saying a milestone shows once it's verified** (finding 2): it stays
  hidden until the member shows or shares it in Brazework. This needs no database change.
- **Prompts take `lane`** (`study` or `work`, optional): `start`, `shipped`, `result`, `standup`,
  `week`, `setup`, `ask_signature`. `ask_signature` also gains `field`, which it lacks today, so it can
  name the field's signers.
- **What each prompt does in the working lane.** `shipped` and `start` log a hidden milestone and never
  start by picking a club. `result` logs a hidden milestone instead of drafting a post. `week` picks
  milestones only, unless the project is private. `standup` saves its draft only on a private project.
  `setup` opens with the employer question and suggests `/week`. Any of them that ends by pointing
  somewhere points to the review packet with hidden work ticked.
- **Where the rules live**, as above: prompts with and without a lane, the resource, the instructions
  and the milestone tools' descriptions.
- **The resource.** `brazework://playbooks/<id>` keeps its address and gains two headed parts, "If
  you're studying" and "If you're working". The index says each playbook has both.
- **`/ai` and Settings → Your tools.** A Studying / Working switch above each field's moments. `/ai`
  opens on Studying; Settings opens on the member's own.
- **`docs/mcp-workflows.md`.** Each field's section gains its working moment and signers; the commands
  table gains `lane`.
- **Tests.**
  - Every field has both lanes, each with a moment that becomes a milestone and a signers line; the
    working signers name someone at work.
  - Every field × lane (study, work, none) × prompt × token names only tools that token has. This is
    the existing matrix, extended.
  - A prompt with no lane carries the lane steps and the working rules.
  - In the working lane no prompt tells the assistant to pick a club first, to save a post on a project
    that isn't private, or that anything logged from chat is backed.
  - In the studying lane no prompt carries the employer question or the lane question.
  - Database tests: `account_type` in `mcp_me`, and a milestone logged with no club is hidden (the twin
    of the club case `supabase/tests/mcp-milestones.test.sql` already covers).
  - One browser journey gets a working prompt through `/api/mcp`.

### PR 2: backing from chat

A merged pull request logged from chat, or drafted by the GitHub Action and approved, is backed by
GitHub the way the app's own form does it, when the repo is linked. The 90-day picker stops offering a
pull request that's already on the record. Working rule 6 is then rewritten to say so. This is the
piece that makes the code-and-data family need no typing; until it ships, rule 6 sends people to the
app and keeps the assistant honest.

### PR 3: private from chat

- `create_project` takes `private` (default false, as today), so a working project can start private.
- `log_milestone` and `draft_milestone` take two optional fields: `public_line` (up to 140 characters,
  the same rule as `set_public_line`) and `show` (default false, as today). Not both: a public line is
  for hidden work.
- A database step carries these through `tool_do_project`, `tool_milestone_payload`,
  `tool_insert_milestone`, `mcp_log_milestone` and the draft's approval. The line is written only as
  the owner, only on hidden work, exactly as `set_public_line` does now.
- The draft card and the milestone card in chat show the line, and whether it will show.
- The working prompts gain: "Offer one public line that says what I did without those details", and
  offer to make a new project private. The studying prompts gain: "Ask whether to show it on my
  profile".
- Add `client` to the signer relationships, so a freelancer's private line reads "signed by a client".

## Not in these PRs

- **Tools only people at work use** (Jira, a company's PLM, and so on). Each has to be checked the way
  November's list was before a playbook names it. The working lane reuses each field's checked list.
- **A goal that fits someone already working.** `job` is described as a first full-time role. A
  promotion or a next role needs its own kind.
- **Remembering a lane on a project.** The assistant asks when it's unclear.
- **Changing the consent choice.** "Add it when I say yes in chat" stays the default for everyone.
  Hidden-by-default and private projects are what protect work, so a second default isn't needed.
- **Setting a public line on a milestone that already exists.** That stays in the app.
- **Backed work in the review packet.** The packet lists signed and verified work (finding 7). Whether
  backed-only work belongs in it is its own decision.

## What would make this a failure

- An assistant reads an employer's system without the member being asked whether that's allowed.
- A confidential detail lands somewhere that shows: a title, a public line, a post, a project's card.
- Someone who works is told to send it to their club.
- Someone with a student account is asked the employer question or the lane question.
- The assistant says GitHub backs something that isn't backed.
- A playbook names a tool connection nobody checked.

## How we'd know it worked

Measured by the owner's `account_type`, since the lane isn't stored. Claude's proposal:

1. Of professionals who connect an assistant, half log a first milestone within 7 days. There's no
   baseline yet, so the first month sets one.
2. Six in ten of their milestones get a signature ask within 14 days.
3. Nothing from the working lane shows on a profile or in a feed without the member's yes. This one is
   a set of tests, not a metric.

## Calls made by Claude

- Two lanes inside each playbook, and the lane belonging to the piece of work.
- The lane steps, taken from the rule Home already uses: a professional in no club is Working, a
  professional in a club is asked once, a student is never asked.
- The private project as the unit of privacy for work, and no feed posts about work outside one. This
  reverses what Claude first told Josh ("`/standup` each morning" for people who work): a standup
  approved onto a public project is a post every member can read.
- `/result` in the working lane logs a hidden milestone.
- The rules repeated in prompts without a lane, the resource, the instructions and the tool
  descriptions, so the plain-words path is covered.
- The assistant reads the lane from `me`, as it reads the field, with no lookup on the server.
- One working moment per field in v1, and all 20 examples (invented). Tools shared across lanes.
- Leaving the consent default alone. Claude first suggested "Drafts only" for work, then found that
  chat-logged milestones already start hidden.
- `show` from chat. Drop it if showing should stay something the member only does in the app.
- Fixing the "it shows on your profile" wording in PR 1 instead of waiting for PR 3.

## Decided by Josh, 2026-11-20

Josh approved Claude's default on each. Ian hasn't been asked yet.

1. **Backing from chat is in, as PR 2.** It is real work: GitHub calls from the MCP route, the `logged`
   state, private repos, and tests on the stand-in GitHub. It comes before private-from-chat because it
   is what makes the software flow automatic.
2. **Josh reads the Software example and Ian reads the Mechanical one before PR 1 merges.** The other
   18 ship as written, and each is fixed as someone in the field reads it. The studying examples
   shipped the same way.
3. **A hidden work milestone still needs an evidence link.** Today a milestone needs one to eight https
   links. For hidden work those can be inside links only the member and the signer can open, which is
   what the 90-day picker already stores for a private repo. Some employers won't allow even the
   address of an inside page in an outside system. Allowing none would change what a signature proves,
   so it isn't in these PRs; ask the first working members whether the link stops them.
