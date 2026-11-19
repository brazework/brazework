# Your tools fill in your record

Brazework is the record of what you build, signed by the people who saw it. You already keep that work in
your own tools: GitHub, Onshape, KiCad, Weights & Biases, MATLAB, Overleaf, Stripe, Figma, Qualtrics. With
Brazework's MCP server, an AI assistant (Claude Code, Claude Desktop, Cursor, VS Code, Codex, Windsurf, Zed)
reads the work where it already lives and drafts the post, milestone or signature request for you, with the
proof attached. **Nothing goes out until you say yes.**

The public version of this guide is **[brazework.com/ai](https://brazework.com/ai)**: readable signed out, built from the same lists as the server (`web/src/lib/ai-guide.ts`), so a new tool or prompt shows up there by itself.

What it looks like:

- You merge a pull request. CI is green. A GitHub Action leaves a draft milestone in Brazework with the pull request
  as evidence: "Merged: live arrival times". On your phone, you open **Drafts**, fix the title, and tap
  *Send to club*. The club's officers verify it.
- You finish a FEA run in ANSYS. You type `/shipped` in Claude. It reads the run, finds the version, and
  shows you "Gearbox v4: max von Mises 182 MPa at 450 N, safety factor 1.9" with the report linked. You say
  yes.
- Your W&B run beats the baseline. `/result` turns it into "Crop disease classifier: 94.1% on the field-trial
  photos, +3.1 over the baseline" with the run linked.
- Your PI watched the experiment. `/ask_signature` emails them a one-time link. They sign it without an account.
  Their name and role show on the milestone.
- Friday afternoon, `/week` looks over your week across every tool you've connected and drafts the two things
  worth recording.

The code: `web/src/app/api/mcp/route.ts` (the server), `web/src/lib/mcp.ts` (tools),
`web/src/lib/mcp-playbooks.ts` (the field playbooks and prompts), `supabase/mcp-workflows.sql` (drafts,
scopes, signatures). Design: [superpowers/specs/2026-11-18-mcp-workflows-design.md](superpowers/specs/2026-11-18-mcp-workflows-design.md).

## Set it up in 2 minutes

**The fastest way: sign in, no token.** Add Brazework to your assistant by its address,
`https://<your Brazework>/api/mcp`:

- **Claude (web and desktop):** Settings → Connectors → Add custom connector.
- **Claude Code:** `claude mcp add --transport http brazework https://<your Brazework>/api/mcp`, then `/mcp` to
  sign in.
- **Cursor, VS Code and others:** add an MCP server with that address.

Your assistant opens Brazework's consent page. It says which app is asking and what the app can do
(read, and leave drafts for you to approve), and you tap **Connect**. Each sign-in shows in **Settings →
Your tools**, where you can turn on posting for it or disconnect it. This works once a founder has switched
on the OAuth server (below). Until then, and for GitHub Actions and scripts, use a token:

1. In Brazework, open **Settings → Your tools** and pick your assistant. Tap **Make token**. New tokens can
   read your Brazework and leave drafts for you to approve. Turn on *Let it post updates for me* only if you
   want it to post after asking you in chat.
2. Follow the one step it shows, with your token filled in. For Claude Code, that's one command:

   ```bash
   claude mcp add --transport http brazework https://<your Brazework>/api/mcp --header "Authorization: Bearer forge_…" --scope user
   ```

3. Connect the tools for your field (your section is below; **Recipes for your field** in Settings → Your tools shows
   the same list). Or type `/setup` and let your assistant walk you through it.
4. Type `/start`. In about a minute, it finds something you finished in the tools you've connected and turns it
   into your first milestone, with its proof. After that: `/shipped`, `/result` or `/week`.

## The commands

These are the server's MCP prompts, so they appear as slash commands. In Claude Code they're
`/mcp__brazework__shipped` and so on; Claude Desktop, VS Code and Cursor list them under Brazework. Each one
takes an optional `field` (it defaults to the field on your profile) and reads your field's playbook.

| Command | What it does |
|---|---|
| `start` | Your first minute: it reads your field, looks at the last 30 days in the tools you've connected, picks the strongest finished work that has proof, and turns it into your first milestone. It ends with the link. |
| `shipped` | Finished work (a merged PR, a new version, a passed test) becomes a milestone with 1 to 8 evidence links, for your club to verify or for someone to sign. |
| `result` | A number (a run, a test, a measurement, a sales total) becomes a result post with the specifics. |
| `week` | Looks over the last 7 days in your connected tools and drafts the 1 to 3 things worth recording, without repeating what's already there. |
| `ask_signature` | Asks the professor, TA, PI, manager or mentor who saw your work to sign one of your milestones. |
| `setup` | Lists your field's tools and how your assistant reaches each one (official server, community server, or your exports). |

What each command does at the end depends on your token:

- **Can post:** it shows you exactly what will appear and posts only after your yes.
- **Drafts (the default):** it saves a draft. You approve the draft in Brazework.
- **Read-only (older tokens):** it writes the text out for you to paste.

Every write says what happens next and gives the link to open it: "Sent to Rocketry Club; its officers verify
it", or "waiting for a signature: ask with request_signature", or "waiting in your drafts". When Brazework
says no (a Gmail address for a signer, a teammate, a weekly limit), the message says how to fix it, so your
assistant can fix it or ask you.

In assistants that show MCP Apps (Claude, ChatGPT, VS Code and Goose, per the MCP Apps launch), a
milestone you log or draft shows as a **card in the chat**: the title, its proof, where it stands
("Waiting for Rocketry Club", "Waiting for a signature", "In your drafts"), the next step, and **Open in
Brazework**. The card is `ui://brazework/milestone-card` (`web/src/lib/mcp-card.ts`). It reaches nothing
outside and only shows what the tool sent it. Other assistants show the same result as text.

Your assistant can also read the playbooks directly as MCP resources: `brazework://playbooks` (the index)
and `brazework://playbooks/<field>`, for example `brazework://playbooks/data-ai`.

## The tools

| Tool | Needs | What it does |
|---|---|---|
| `me`, `my_clubs`, `my_projects`, `notifications`, `search`, `upcoming_events`, `my_review_requests` | read | Read your Brazework. `my_projects` now lists `open_milestones`: the ones still waiting for a club or a signature, with their ids. |
| `draft_post`, `draft_milestone` | draft | Leave a post or a milestone in your **Drafts**. Same fields as the live tools, plus `source` (shown on the draft) and `source_key` (send the same key again and you get the first draft back, so re-runs never duplicate). |
| `post_update`, `log_milestone` | post | Post, or log a milestone, straight away after asking you. `log_milestone` no longer needs a club: with no club, the milestone waits for a signature. |
| `request_signature` | post | Email someone who saw the work a one-time link to sign a milestone. |
| `create_project`, `update_project`, `add_teammate` | draft (does it with post) | Ask in plain words: "add my hopper project", "update the summary and specs", "put Josh on it". With a token that can post, they happen once you say yes in chat; otherwise (or with `draft: true`) they wait as cards in **Drafts** and on Ember's page. `update_project` changes only the fields given (summary, write-up, link, specs) on your own projects, and the card shows what it replaces. `add_teammate` adds someone who shares one of your clubs, as a teammate or a viewer (admins are made in the app). |
| `rsvp_event` | draft (does it with post) | "Save me a spot at Thursday's build night", or "I can't make it" (`going: false`). Only events you can see that aren't over; ids come from `upcoming_events`. |
| `join_club`, `accept_invite` | draft (does it with post) | "Join the robotics club", "accept this invite: brazework.com/join/…". A club that approves members gets a request, as in the app. |
| `my_inbox` | read | Your conversations and message requests, newest first, or one conversation's last 20 messages. |
| `draft_reply` | draft | A reply (or a first message) always waits in Drafts as a card: you read it and send it from Brazework. A tool never sends a message. |

Scopes nest: read ⊂ draft ⊂ post. A token made before November 2026 keeps exactly what it had.

## Ember and your tools: one set of actions

Ember (the agent in Brazework) prepares actions as approve-first cards. Your AI tools now use the same
actions, by the same names (`supabase/tool-actions.sql`, `web/src/lib/tool-actions.ts`):

- **A draft from Claude is an Ember card.** What a tool drafts (a project, an edit, a teammate, …) shows on
  `/drafts` and under *Waiting from your tools* on Ember's page as the card Ember would have shown. Edit it,
  then **Confirm**: it runs the app's own action, exactly as when Ember proposed it, and the draft is done.
- **What Ember can prepare, a tool can draft.** Each action has one check in the database
  (`tool_check_<kind>`), run as you, under the same rules as the app; actions a posting token may do straight
  away also have `tool_do_<kind>`. `mcp_act` is the tool's way in.

| Action (card) | MCP tool | Without a token that posts | With one |
|---|---|---|---|
| New project | `create_project` | card in Drafts | added after your yes |
| Project summary, write-up, link, specs | `update_project` | card in Drafts | saved after your yes |
| Teammate from your clubs | `add_teammate` | card in Drafts | added after your yes |
| RSVP to an event, or take it back | `rsvp_event` (`going: false` to take it back) | card in Drafts | done after your yes |
| Join a club (or ask to, if it approves members) | `join_club` | card in Drafts | done after your yes |
| Accept a club invite link | `accept_invite` | card in Drafts | done after your yes |
| A message or a reply | `draft_reply` | card in Drafts | **always a card**: you send it |
| A club announcement (officers) | `draft_announcement` | card in Drafts | **always a card**: you post it |
| A club event (club admins) | `draft_event` | card in Drafts | **always a card**: you publish it |
| Follow someone | `follow_person` | card in Drafts | done after your yes |

Every card Ember can prepare now has a tool: posts and milestones (`draft_post`, `draft_milestone`), and
everything above. The one card neither offers is a milestone review: verifying stays with people, in the app.

## For club officers

If you're a moderator, admin or owner of a club, ask in plain words: "how was Rocketry's week?", "plan
Thursday's meeting", "recap last week for the club". The `club_week` prompt does it in one go.

- `club_brief` is Ember's weekly brief (the same numbers as Manage → Report and Ember's club report):
  members and new joiners, posts this week vs last, the top post, events coming up and just past,
  milestones verified and waiting, join requests. Moderators and up.
- `draft_announcement` drafts a post in the club; `draft_event` drafts an event. Both always wait as cards
  in your Drafts: you publish them. Events follow the app's rule: a club's admins and owner host them, so a
  moderator drafts the announcement and asks an admin.
- Verifying milestones stays in Brazework. The brief says how many wait and links the Verify tab.

| Prompt | What it does |
|---|---|
| `club_week` | Ember's brief for your club, turned into this week's update (default), a meeting plan (`what: meeting plan`, and offers to draft the meeting itself) or a recap (`what: recap`), saved as a draft announcement. |

## Career fairs and résumés

Ask "get me ready for the career fair" and the `career_fair` prompt chains the tools, asking you before
every write:

1. Finds the event (`upcoming_events`) and its employer session.
2. Checks your projects (`my_projects`) for milestones still waiting for a club or a signature.
3. For each, asks who saw it and prepares the signature ask (`request_signature`, sent only after your yes,
   with a token that can post; otherwise it tells you where to ask in Brazework).
4. Builds the résumé section (`my_resume`): each project with its signed work, who signed it, and a link
   anyone can open. A result you've shared links to its public proof card (`/p/<id>`); the rest link to
   the project. It says which results you could share for a public link.
5. RSVPs you to the employer session (`rsvp_event`), after your yes, or leaves it as a card.

| Tool | Needs | What it does |
|---|---|---|
| `my_resume` | read | Your signed (and GitHub-backed) work, project by project, with who signed it and a link for each. Nothing you keep private. |
| `find_builders` | read, verified company or school admins only | Search builders by signed work: skills or work, field, club, class year, open to, at least N signed results, and level (`signed`, or `signed_or_backed`). Same data, ranking and privacy rules as `/talent` (it uses /talent's own code): only public signed work on projects you could open in the app, and profile fields every member sees. Messages to them land in their Requests. |

| Prompt | What it does |
|---|---|
| `career_fair` | "Get me ready for <event>": finds it, checks your projects for unsigned milestones, prepares the signature asks, builds your résumé section and RSVPs you to the employer session, asking before each write. |

## Drafts and automations

**Drafts** (`/drafts`, and "Your tools noticed N things" on Today) are where anything a tool
couldn't ask you about waits. Each one shows the tool it came from and why (for example "GitHub Actions ·
acme/rig #12 merged"). You can edit it, then **Post** (or **Send to club** / **Log it** for a milestone), or
**Dismiss** it. Approving checks it again and makes it as you, under the same rules as anything you make in
the app: posting pace, milestone limits, your own projects, clubs you're in. Nobody else can see your drafts.
A tool can leave at most 20 an hour, and at most 30 can wait at once.

**Daily triage.** Today opens with "Your tools noticed N things": the five newest drafts, each decided in one
tap without leaving the page, built for a phone. A milestone gets **Keep** (logged on its project, waiting for
proof), **Send to club** (its officers are asked to verify; you pick the club when you're in more than one),
**Ask to sign** (kept, and the person who saw it gets the signature email: a university or company address,
with every guard from *Signatures* below) or **Dismiss**. A post gets **Post**, **Post to club** or
**Dismiss**. Editing stays on `/drafts`. If email can't go out, Ask to sign says so and the draft keeps
waiting. An optional email (Settings → Email → *Drafts from your tools, daily*, or the link under the list on
Today; off by default) arrives at most once a day, only when a draft came in since the last one, and says only
how many and from which tools, never what a draft says.

**GitHub Actions** (Settings → Your tools → GitHub Actions) is an automation, not an assistant. Its token can
only read and leave drafts; it can never be switched to post. Pick the project, and the club that verifies
its milestones if you want one (with none, an approved milestone waits for someone to vouch), then:

1. Save the token as a repository secret (`gh secret set BRAZEWORK_TOKEN`).
2. Add the workflow it gives you as `.github/workflows/brazework.yml`.

On every merged pull request, the workflow calls `draft_milestone` with the pull request as evidence and
`source_key` = `github:<owner>/<repo>#<number>`. The pull request's title reaches the script through
environment variables and `jq --arg`, never pasted into the shell, so a crafted title can't run as code.
The same pattern works from any scheduler: a nightly script that checks W&B, or a scheduled Claude task.
Each one sends one JSON-RPC `tools/call` to `/api/mcp`.

## Signatures

Brazework's proof is a club verifying your milestone, or a person who saw the work signing it. From chat:
`log_milestone` without a club, then `request_signature` with the person's **university or company email**
(Gmail, Outlook and the like don't count) and how they know you (`professor`, `ta`, `pi`, `manager`, `mentor`,
`other`). All of the app's vouch rules apply, from `supabase/vouches.sql`:

- never yourself or anyone on the project's team
- at most 3 open asks per milestone and 10 a week
- the link is single-use and lasts 14 days

The server makes the link and emails it; your assistant never sees it. If the email can't go out, the ask
is withdrawn.

## What it never does

- Post, send or ask anything without your yes. Drafts wait for your tap. Tools that can post are told to show
  you first.
- Verify or sign anything. Clubs and people do that, in Brazework.
- Delete anything, or change anything someone else made. It changes your own projects only when you ask
  (`update_project`), and only the fields you named.
- Claim more than it can reach. Each field's tools below are marked **Official MCP server** (the vendor's),
  **Community MCP server** (someone else's open-source server: read it before you install it) or **Reads your
  exports** (no server: your assistant reads the files or command output you point it to). Checked in November 2026.

Keep private things out of posts: customer, patient and student details, secrets, and anything from an
employer's confidential work. For medicine and social science, check your IRB's rules before connecting a
data tool.

## By field

Tools that help everywhere:

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Google Drive and Calendar | Official MCP server | files and events (Google's Workspace servers are in Developer Preview; Claude also has its own connectors) |
| Slack | Official MCP server | messages and channels (your workspace admin may need to approve it) |
| Discord | Community MCP server | channel messages with a bot token |
| Notion | Official MCP server | pages and databases |

### Robotics

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| ROS 2 | Community MCP server | topics, services and parameters over rosbridge; or ros2 CLI and rosbag output |
| PlatformIO | Community MCP server | builds, flashes, test runs, serial logs |
| Arduino CLI | Community MCP server | compile and upload results, serial output |
| Onshape | Community MCP server | documents and versions (the official Onshape server only writes FeatureScript) |
| GitHub | Official MCP server | commits, pull requests, CI runs, releases |

Moments worth recording:

- **A timed run on the course beats the last best** → result post: “Line follower: course in 41.2 s, down from 47.8 s”. Proof: the run video and the commit the robot ran.
- **A subsystem works end to end on the real robot** → milestone: “Closed-loop drive holds heading within 2° over 10 m”. Proof: rosbag plot or video, and the pull request.

Who signs: the team's club officers, a lab TA or the faculty advisor. Try `/shipped` with the field Robotics.

### Aerospace

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Autodesk Fusion | Official MCP server | the live model and active document (local server); hubs, projects and items (Fusion Data server) |
| OpenRocket / RockSim | Reads your exports | the .ork/.rkt file and its simulation CSV |
| MATLAB | Official MCP server | runs scripts and checks code (needs a local licence) |
| ANSYS | Official MCP server | Fluent, MAPDL and CFX sessions through PyAnsys (local install and licence) |
| GitHub | Official MCP server | commits, pull requests, CI runs, releases |

Moments worth recording:

- **A flight or static fire hits its target** → milestone: “Flew to 1,140 m and was recovered intact”. Proof: the altimeter log, the flight video and the launch report.
- **Simulation and test agree** → result post: “Fin flutter margin 1.6× at max-q, CFD within 4% of the wind tunnel”. Proof: the CFD report and the tunnel data.

Who signs: the rocketry club's officers, the launch's range safety officer, or a professor. Try `/shipped` with the field Aerospace.

### Mechanical

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Autodesk Fusion | Official MCP server | the live model (local server); hubs, projects and items (Fusion Data server) |
| Onshape | Community MCP server | documents, part studios and versions through the REST API (the official server only writes FeatureScript) |
| SolidWorks | Community MCP server | parts and features through COM on a running SolidWorks (alpha); or STEP exports |
| ANSYS | Official MCP server | MAPDL and Fluent results through PyAnsys |
| COMSOL | Official MCP server | models, studies and plots (new in COMSOL 2027) |
| MATLAB | Official MCP server | scripts and test analysis |

Moments worth recording:

- **A new design version passes simulation** → build update: “Gearbox v4: max von Mises 182 MPa at 450 N, safety factor 1.9”. Proof: the version link and the FEA report.
- **The physical part survives its test** → milestone: “Ran two hours under load without slipping”. Proof: the test video and the logged data.

Who signs: the team's officers, the machine-shop supervisor or the course instructor. Try `/shipped` with the field Mechanical.

### Electronics

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| KiCad | Community MCP server | schematics, boards, DRC/ERC, BOM and Gerber export; or kicad-cli on the text files |
| Altium | Community MCP server | schematic and PCB queries (Windows, experimental); or BOM and Gerber exports |
| PlatformIO | Community MCP server | firmware builds, tests, serial logs |
| Arduino CLI | Community MCP server | compile and upload, serial output |
| GitHub | Official MCP server | commits, pull requests, CI runs, releases |

Moments worth recording:

- **A board passes bring-up** → milestone: “BMS board passed bring-up with every cell balanced within 5 mV”. Proof: the bring-up log, a photo and the board's release.
- **The design passes DRC and goes to fab** → build update: “Rev C sent to fab: 0 DRC errors, 4-layer, 38 × 52 mm”. Proof: the commit with the Gerbers.

Who signs: the team's officers, a lab TA or the professor whose lab it ran in. Try `/shipped` with the field Electronics.

### Civil

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Autodesk Fusion | Official MCP server | models and data (local and Fusion Data servers) |
| SAP2000 / RISA | Reads your exports | analysis reports and exported tables |
| QGIS | Community MCP server | layers, processing and rendering via a plugin; or GeoPackage/GeoJSON |
| MATLAB | Official MCP server | load-test analysis |
| Google Sheets | Official MCP server | test data (Google's Workspace servers are in Developer Preview) |

Moments worth recording:

- **A load test meets the brief** → milestone: “Balsa truss held 48 kg while weighing 62 g”. Proof: the test video and the data sheet.
- **Analysis predicts the failure correctly** → result post: “Predicted failure at 46 kg, broke at 48 kg (4% error)”. Proof: the analysis report and the test video.

Who signs: the society's officers, the competition judge or the course instructor. Try `/shipped` with the field Civil.

### Software

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| GitHub | Official MCP server | commits, pull requests, CI runs, releases |
| GitLab | Official MCP server | merge requests and pipelines |
| Vercel | Official MCP server | deployments and build logs |
| Linear | Official MCP server | issues and projects |
| Sentry / analytics | Reads your exports | error and usage exports |

Moments worth recording:

- **A pull request merges with CI green** → milestone: “Shipped live arrival times: p95 under 300 ms”. Proof: the pull request and the CI run.
- **Real people use what you shipped** → result post: “Shuttle tracker reached 2,100 weekly riders”. Proof: the analytics export and the release.

Who signs: the club's officers, a code reviewer who isn't on the team, or a manager. Try `/shipped` with the field Software.

### Computer science

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| GitHub | Official MCP server | commits, pull requests, CI runs, releases |
| Jupyter | Community MCP server | notebook cells and outputs (Datalayer's server); or the .ipynb JSON itself |
| Lean 4 | Community MCP server | goals and diagnostics through lean-lsp-mcp; or lake build output |
| Overleaf | Community MCP server | project files; or its Git sync and the .tex files |
| arXiv | Community MCP server | search and read papers |

Moments worth recording:

- **A benchmark beats the baseline** → result post: “Sorted 10 GB across four nodes in 94 s (1.8× the single node)”. Proof: the benchmark log and the commit.
- **A proof or paper is done** → milestone: “Formalized the pumping lemma in Lean, no sorry”. Proof: the repository and the CI build.

Who signs: a professor, a TA, or the computing society's officers. Try `/shipped` with the field Computer science.

### Data & AI

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Weights & Biases | Official MCP server | runs, metrics, sweeps and reports |
| Hugging Face | Official MCP server | models, datasets, papers and Spaces |
| Google Colab | Official MCP server | notebooks: add and run cells in a Colab runtime |
| Kaggle | Official MCP server | competitions, datasets and notebooks (check its docs; or the kaggle CLI) |
| Jupyter | Community MCP server | notebook cells and outputs; or the .ipynb itself |
| MLflow | Official MCP server | mostly GenAI traces; for runs and metrics use its REST API or CLI |
| GitHub | Official MCP server | commits, pull requests, CI runs, releases |

Moments worth recording:

- **A run beats the baseline** → result post: “Crop disease classifier: 94.1% on the field-trial photos, +3.1 over the baseline”. Proof: the W&B run or report, and the commit.
- **A model or dataset is published** → milestone: “Released the 12k-image field-trial dataset on Hugging Face”. Proof: the dataset page and its card.

Who signs: the AI society's officers, a lab PI or a professor. Try `/shipped` with the field Data & AI.

### Mathematics

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Overleaf | Community MCP server | project files; or its Git sync and the .tex files |
| Lean 4 | Community MCP server | goals and diagnostics through lean-lsp-mcp |
| Wolfram / Mathematica | Official MCP server | evaluate Wolfram Language; notebooks (built into version 15) |
| MATLAB | Official MCP server | computation and plots |
| arXiv | Community MCP server | search and read papers |

Moments worth recording:

- **A result is presented or posted** → milestone: “Presented the trefoil invariant at the undergraduate seminar”. Proof: the slides or preprint and the seminar page.
- **A computation confirms a conjecture to a new bound** → result post: “Checked the conjecture for all n ≤ 10⁸”. Proof: the code and its output.

Who signs: the professor or advisor, or the math society's officers. Try `/shipped` with the field Mathematics.

### Physics

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| MATLAB | Official MCP server | analysis scripts and fits |
| Jupyter | Community MCP server | notebook analysis; or the .ipynb itself |
| COMSOL | Official MCP server | models, studies and plots (COMSOL 2027) |
| LabVIEW | Reads your exports | exported measurement data |
| Overleaf | Community MCP server | the write-up; or its Git sync |

Moments worth recording:

- **A measurement lands with its uncertainty** → result post: “Measured g = 9.79 ± 0.02 m/s² over 200 pendulum runs”. Proof: the analysis notebook and the raw data.
- **The rig works** → milestone: “Double pendulum tracker logs 200 runs a day unattended”. Proof: the video and the code.

Who signs: the lab instructor, the PI or a TA. Try `/shipped` with the field Physics.

### Chemistry

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Benchling | Official MCP server | notebook entries, registry and results (your institution's tenant) |
| LabArchives | Community MCP server | notebook listing and search (small project); or PDF exports |
| Instrument software (NMR, HPLC, IR) | Reads your exports | exported spectra and reports |
| Zotero | Community MCP server | your references and notes |
| Jupyter | Community MCP server | analysis notebooks |

Moments worth recording:

- **A synthesis or growth works** → milestone: “Grew a 14 mm single crystal over three weeks”. Proof: the notebook entry and photos.
- **Characterization confirms it** → result post: “Product confirmed by ¹H NMR, 87% yield”. Proof: the spectrum and the notebook entry.

Who signs: the PI, the lab manager or the course instructor. Try `/shipped` with the field Chemistry.

### Biology

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Benchling | Official MCP server | notebook entries, sequences, registry and results |
| PubMed | Official MCP server | search and full text through Anthropic's PubMed connector (it isn't NCBI's) |
| R / RStudio | Official MCP server | run R in your session through Posit's mcptools package |
| Zotero | Community MCP server | references and annotations |
| Google Sheets | Official MCP server | plate maps and data (Developer Preview) |

Moments worth recording:

- **An experiment gives a clear result** → result post: “Knockdown cut expression 72% (n = 3, p < 0.01)”. Proof: the notebook entry and the figure.
- **Something you built is used** → milestone: “DNA model printed and used in the BIO 101 lab”. Proof: photos and the course page.

Who signs: the PI, a postdoc who supervised it, or the course instructor. Try `/shipped` with the field Biology.

### Environment

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| QGIS | Community MCP server | layers and processing via a plugin; or GeoPackage/GeoJSON |
| ArcGIS | Official MCP server | Esri's servers cover developer docs and location services; your own content via the ArcGIS API or exports |
| Google Earth Engine | Community MCP server | imagery queries (early); or earthengine-api in Python |
| R / RStudio | Official MCP server | analysis through Posit's mcptools |
| Google Sheets | Official MCP server | logger data (Developer Preview) |

Moments worth recording:

- **A data series runs unbroken** → milestone: “Weather station logged 90 days without a gap”. Proof: the data export and a photo of the station.
- **The analysis finds something** → result post: “Campus canopy cuts surface temperature 4.2 °C in July”. Proof: the map and the notebook.

Who signs: the environmental club's officers, a field-course instructor or the PI. Try `/shipped` with the field Environment.

### Space

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Autodesk Fusion | Official MCP server | models and data |
| ANSYS | Official MCP server | structural and thermal runs through PyAnsys |
| MATLAB | Official MCP server | orbit and link-budget analysis |
| KiCad | Community MCP server | avionics boards |
| GitHub | Official MCP server | commits, pull requests, CI runs, releases |

Moments worth recording:

- **A qualification test passes** → milestone: “CubeSat structure passed the vibration test at launch levels”. Proof: the test report and the video.
- **A subsystem meets its budget** → result post: “Link budget closes with 6.3 dB margin at 500 km”. Proof: the analysis and the commit.

Who signs: the space systems lab's lead, the test-facility engineer or the faculty advisor. Try `/shipped` with the field Space.

### Medicine

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| PubMed | Official MCP server | literature through Anthropic's PubMed connector (not NCBI's) |
| REDCap | Community MCP server | records and instruments with a project API token: check your IRB and institution's rules first, and never post patient data |
| R / RStudio | Official MCP server | analysis through Posit's mcptools |
| Stata | Community MCP server | do-files and results (licensed Stata 17+) |
| Autodesk Fusion | Official MCP server | device models |

Moments worth recording:

- **A device works in testing** → milestone: “Prosthetic hand gripped and lifted a 500 g bottle”. Proof: the test video and the design version.
- **A study or review is complete** → milestone: “Systematic review screened 1,240 abstracts, 38 included”. Proof: the protocol registration and the preprint.

Who signs: the supervising physician or PI, the course director, or the biomedical society's officers. Try `/shipped` with the field Medicine.

### Business

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Stripe | Official MCP server | payments, customers and subscriptions (use test mode while you learn) |
| Shopify | Official MCP server | products, orders and analytics through your store's server |
| Notion | Official MCP server | pages and databases |
| Google Analytics | Official MCP server | GA4 reports (experimental, read-only) |
| HubSpot | Official MCP server | CRM records and activities |
| QuickBooks | Official MCP server | invoices and reports |

Moments worth recording:

- **A sales or revenue mark is hit** → result post: “Coffee cart sold 1,200 cups in its first month”. Proof: a Stripe or Shopify summary (totals only, no customer details).
- **You launch** → milestone: “Launched online ordering; 140 orders in week one”. Proof: the live page and the order summary.

Who signs: the entrepreneurship club's officers, an accelerator mentor or a professor. Try `/shipped` with the field Business.

### Design

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Figma | Official MCP server | frames, components and variables |
| Canva | Official MCP server | designs, folders and exports |
| Autodesk Fusion | Official MCP server | product models |
| Blender | Official MCP server | scenes and objects (Blender Lab's server; the popular ahujasid one is separate and unaffiliated) |
| Adobe Express | Official MCP server | Adobe's hosted creativity server (the Photoshop and Illustrator desktop servers are only previewed) |

Moments worth recording:

- **A prototype passes its test** → milestone: “Flat-pack chair held 120 kg in the load test”. Proof: the test video and the model.
- **A design ships or is critiqued** → build update: “Wayfinding system v2: 6 of 8 testers found the lab in under a minute”. Proof: the Figma file and the test notes.

Who signs: the studio instructor, the critique panel or a client. Try `/shipped` with the field Design.

### Media

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| DaVinci Resolve | Community MCP server | projects, timelines and renders (easiest with Studio); or EDL/XML exports |
| YouTube | Community MCP server | video and channel stats through the Data API (no Google server) |
| Adobe Premiere | Reads your exports | exports and EDLs (Adobe's desktop server is only previewed) |
| Canva | Official MCP server | posters and thumbnails |
| Google Drive | Official MCP server | scripts and cuts (Developer Preview) |

Moments worth recording:

- **The piece is screened or published** → milestone: “Documentary short screened to 300 people at the fall showcase”. Proof: the screening page and the film link.
- **The audience responds** → result post: “12,400 views and 61% average watch time in the first week”. Proof: the YouTube analytics summary.

Who signs: the film club's officers, the festival programmer or the course instructor. Try `/shipped` with the field Media.

### Social science

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Qualtrics | Official MCP server | surveys and responses (check its setup docs); or CSV/SPSS exports |
| Google Sheets | Official MCP server | data (Developer Preview); Google Forms has no server, so link its responses to a Sheet |
| R / RStudio | Official MCP server | analysis through Posit's mcptools |
| Stata | Community MCP server | do-files and results |
| SPSS | Reads your exports | no server: export .sav to CSV |
| Zotero | Community MCP server | references |

Moments worth recording:

- **Data collection closes** → result post: “Campus rent survey closed with 412 responses (31% response rate)”. Proof: the survey summary (never individual responses).
- **The findings are published or used** → milestone: “Rent report published and cited by the student senate”. Proof: the report and the senate minutes.

Who signs: the faculty advisor, the IRB-approved PI or the society's officers. Try `/shipped` with the field Social science.

### Education

| Tool | How your assistant reaches it | What it reads |
|---|---|---|
| Google Classroom | Official MCP server | courses, coursework and submissions (Developer Preview) |
| Canvas LMS | Community MCP server | courses and assignments with a personal API token |
| Google Forms / Sheets | Official MCP server | feedback, through Sheets (Developer Preview) |
| Canva | Official MCP server | materials |
| Notion | Official MCP server | lesson plans |

Moments worth recording:

- **Something you made is used in a classroom** → milestone: “Tactile fraction kit used in three fourth-grade classes this term”. Proof: photos (no students' faces) and the lesson plan.
- **Learners improve** → result post: “Post-test scores rose 18 points across 64 students”. Proof: the aggregate results (never individual students).

Who signs: the cooperating teacher, the school's principal or the course instructor. Try `/shipped` with the field Education.

## How signing in works (for founders)

Brazework uses Supabase Auth's OAuth 2.1 server (public beta) as its authorization server:

1. A client calls `/api/mcp` with no token. The 401's `WWW-Authenticate` points to
   `/.well-known/oauth-protected-resource/api/mcp` (RFC 9728), which names `<Supabase URL>/auth/v1`.
2. The client registers itself (dynamic client registration) and sends the member to Supabase's
   authorize endpoint with PKCE. Supabase sends them to `/oauth/consent` in the app.
3. Connecting (or Not now) goes back to the client. The client trades the code for an access token and
   calls `/api/mcp` with it.
4. The first call makes that sign-in's own token row (`supabase/mcp-oauth.sql`). Its hash is keyed with
   a server-only secret, so every tool, scope and limit works as it does for a pasted token.

**Founder step (once, per Supabase project: staging, then production).** Nothing changes until it's done.
In Supabase → **Authentication → OAuth Server**:

- Turn the OAuth server on.
- Set **Authorization Path** to `/oauth/consent`. Check that Authentication → URL Configuration → Site URL
  is the app's address.
- Turn on **dynamic OAuth apps** (dynamic client registration), so assistants can register themselves.

Then open Settings → Your tools: "Sign in from your assistant, no token" appears within five minutes. To
check it: `curl -i -X POST https://<your Brazework>/api/mcp` should answer 401 with a `resource_metadata`
link.

