import { INTENT_PROMPTS, intentPromptText } from "@/lib/mcp-intent-prompts";

// Field playbooks for Brazework's MCP server (docs/mcp-workflows.md): for each of the 20 fields the
// landing page shows (components/projects/sample-models.ts, SAMPLES), the tools people in it really
// use, how an assistant reaches each one, the moments worth recording, and who signs them. The MCP
// route serves them as resources (brazework://playbooks/…) and builds its prompts (/shipped, /result,
// /week, /ask_signature, /setup) from them. Pure, so it's unit-tested (tests/mcp-playbooks.test.ts).
//
// How a tool connects, checked in November 2026 (never claim more than this):
//   official: the vendor runs or publishes an MCP server
//   community: an open-source server someone else maintains (review it before installing)
//   files: no usable server; the assistant reads exports or the tool's CLI output instead

export type Connect = "official" | "community" | "files";
export type PlaybookTool = { name: string; connect: Connect; reads: string };
export type Moment = { when: string; becomes: "milestone" | "result" | "update"; example: string; evidence: string };
export type Playbook = { id: string; field: string; tools: PlaybookTool[]; moments: Moment[]; signers: string };

const T = (name: string, connect: Connect, reads: string): PlaybookTool => ({ name, connect, reads });
const GITHUB = T("GitHub", "official", "commits, pull requests, CI runs, releases");

export const PLAYBOOKS: Playbook[] = [
  {
    id: "robotics", field: "Robotics",
    tools: [T("ROS 2", "community", "topics, services and parameters over rosbridge; or ros2 CLI and rosbag output"), T("PlatformIO", "community", "builds, flashes, test runs, serial logs"), T("Arduino CLI", "community", "compile and upload results, serial output"), T("Onshape", "community", "documents and versions (the official Onshape server only writes FeatureScript)"), GITHUB],
    moments: [
      { when: "A timed run on the course beats the last best", becomes: "result", example: "Line follower: course in 41.2 s, down from 47.8 s", evidence: "the run video and the commit the robot ran" },
      { when: "A subsystem works end to end on the real robot", becomes: "milestone", example: "Closed-loop drive holds heading within 2° over 10 m", evidence: "rosbag plot or video, and the pull request" },
    ],
    signers: "the team's club officers, a lab TA or the faculty advisor",
  },
  {
    id: "aerospace", field: "Aerospace",
    tools: [T("Autodesk Fusion", "official", "the live model and active document (local server); hubs, projects and items (Fusion Data server)"), T("OpenRocket / RockSim", "files", "the .ork/.rkt file and its simulation CSV"), T("MATLAB", "official", "runs scripts and checks code (needs a local licence)"), T("ANSYS", "official", "Fluent, MAPDL and CFX sessions through PyAnsys (local install and licence)"), GITHUB],
    moments: [
      { when: "A flight or static fire hits its target", becomes: "milestone", example: "Flew to 1,140 m and was recovered intact", evidence: "the altimeter log, the flight video and the launch report" },
      { when: "Simulation and test agree", becomes: "result", example: "Fin flutter margin 1.6× at max-q, CFD within 4% of the wind tunnel", evidence: "the CFD report and the tunnel data" },
    ],
    signers: "the rocketry club's officers, the launch's range safety officer, or a professor",
  },
  {
    id: "mechanical", field: "Mechanical",
    tools: [T("Autodesk Fusion", "official", "the live model (local server); hubs, projects and items (Fusion Data server)"), T("Onshape", "community", "documents, part studios and versions through the REST API (the official server only writes FeatureScript)"), T("SolidWorks", "community", "parts and features through COM on a running SolidWorks (alpha); or STEP exports"), T("ANSYS", "official", "MAPDL and Fluent results through PyAnsys"), T("COMSOL", "official", "models, studies and plots (new in COMSOL 2027)"), T("MATLAB", "official", "scripts and test analysis")],
    moments: [
      { when: "A new design version passes simulation", becomes: "update", example: "Gearbox v4: max von Mises 182 MPa at 450 N, safety factor 1.9", evidence: "the version link and the FEA report" },
      { when: "The physical part survives its test", becomes: "milestone", example: "Ran two hours under load without slipping", evidence: "the test video and the logged data" },
    ],
    signers: "the team's officers, the machine-shop supervisor or the course instructor",
  },
  {
    id: "electronics", field: "Electronics",
    tools: [T("KiCad", "community", "schematics, boards, DRC/ERC, BOM and Gerber export; or kicad-cli on the text files"), T("Altium", "community", "schematic and PCB queries (Windows, experimental); or BOM and Gerber exports"), T("PlatformIO", "community", "firmware builds, tests, serial logs"), T("Arduino CLI", "community", "compile and upload, serial output"), GITHUB],
    moments: [
      { when: "A board passes bring-up", becomes: "milestone", example: "BMS board passed bring-up with every cell balanced within 5 mV", evidence: "the bring-up log, a photo and the board's release" },
      { when: "The design passes DRC and goes to fab", becomes: "update", example: "Rev C sent to fab: 0 DRC errors, 4-layer, 38 × 52 mm", evidence: "the commit with the Gerbers" },
    ],
    signers: "the team's officers, a lab TA or the professor whose lab it ran in",
  },
  {
    id: "civil", field: "Civil",
    tools: [T("Autodesk Fusion", "official", "models and data (local and Fusion Data servers)"), T("SAP2000 / RISA", "files", "analysis reports and exported tables"), T("QGIS", "community", "layers, processing and rendering via a plugin; or GeoPackage/GeoJSON"), T("MATLAB", "official", "load-test analysis"), T("Google Sheets", "official", "test data (Google's Workspace servers are in Developer Preview)")],
    moments: [
      { when: "A load test meets the brief", becomes: "milestone", example: "Balsa truss held 48 kg while weighing 62 g", evidence: "the test video and the data sheet" },
      { when: "Analysis predicts the failure correctly", becomes: "result", example: "Predicted failure at 46 kg, broke at 48 kg (4% error)", evidence: "the analysis report and the test video" },
    ],
    signers: "the society's officers, the competition judge or the course instructor",
  },
  {
    id: "software", field: "Software",
    tools: [GITHUB, T("GitLab", "official", "merge requests and pipelines"), T("Vercel", "official", "deployments and build logs"), T("Linear", "official", "issues and projects"), T("Sentry / analytics", "files", "error and usage exports")],
    moments: [
      { when: "A pull request merges with CI green", becomes: "milestone", example: "Shipped live arrival times: p95 under 300 ms", evidence: "the pull request and the CI run" },
      { when: "Real people use what you shipped", becomes: "result", example: "Shuttle tracker reached 2,100 weekly riders", evidence: "the analytics export and the release" },
    ],
    signers: "the club's officers, a code reviewer who isn't on the team, or a manager",
  },
  {
    id: "computer-science", field: "Computer science",
    tools: [GITHUB, T("Jupyter", "community", "notebook cells and outputs (Datalayer's server); or the .ipynb JSON itself"), T("Lean 4", "community", "goals and diagnostics through lean-lsp-mcp; or lake build output"), T("Overleaf", "community", "project files; or its Git sync and the .tex files"), T("arXiv", "community", "search and read papers")],
    moments: [
      { when: "A benchmark beats the baseline", becomes: "result", example: "Sorted 10 GB across four nodes in 94 s (1.8× the single node)", evidence: "the benchmark log and the commit" },
      { when: "A proof or paper is done", becomes: "milestone", example: "Formalized the pumping lemma in Lean, no sorry", evidence: "the repository and the CI build" },
    ],
    signers: "a professor, a TA, or the computing society's officers",
  },
  {
    id: "data-ai", field: "Data & AI",
    tools: [T("Weights & Biases", "official", "runs, metrics, sweeps and reports"), T("Hugging Face", "official", "models, datasets, papers and Spaces"), T("Google Colab", "official", "notebooks: add and run cells in a Colab runtime"), T("Kaggle", "official", "competitions, datasets and notebooks (check its docs; or the kaggle CLI)"), T("Jupyter", "community", "notebook cells and outputs; or the .ipynb itself"), T("MLflow", "official", "mostly GenAI traces; for runs and metrics use its REST API or CLI"), GITHUB],
    moments: [
      { when: "A run beats the baseline", becomes: "result", example: "Crop disease classifier: 94.1% on the field-trial photos, +3.1 over the baseline", evidence: "the W&B run or report, and the commit" },
      { when: "A model or dataset is published", becomes: "milestone", example: "Released the 12k-image field-trial dataset on Hugging Face", evidence: "the dataset page and its card" },
    ],
    signers: "the AI society's officers, a lab PI or a professor",
  },
  {
    id: "mathematics", field: "Mathematics",
    tools: [T("Overleaf", "community", "project files; or its Git sync and the .tex files"), T("Lean 4", "community", "goals and diagnostics through lean-lsp-mcp"), T("Wolfram / Mathematica", "official", "evaluate Wolfram Language; notebooks (built into version 15)"), T("MATLAB", "official", "computation and plots"), T("arXiv", "community", "search and read papers")],
    moments: [
      { when: "A result is presented or posted", becomes: "milestone", example: "Presented the trefoil invariant at the undergraduate seminar", evidence: "the slides or preprint and the seminar page" },
      { when: "A computation confirms a conjecture to a new bound", becomes: "result", example: "Checked the conjecture for all n ≤ 10⁸", evidence: "the code and its output" },
    ],
    signers: "the professor or advisor, or the math society's officers",
  },
  {
    id: "physics", field: "Physics",
    tools: [T("MATLAB", "official", "analysis scripts and fits"), T("Jupyter", "community", "notebook analysis; or the .ipynb itself"), T("COMSOL", "official", "models, studies and plots (COMSOL 2027)"), T("LabVIEW", "files", "exported measurement data"), T("Overleaf", "community", "the write-up; or its Git sync")],
    moments: [
      { when: "A measurement lands with its uncertainty", becomes: "result", example: "Measured g = 9.79 ± 0.02 m/s² over 200 pendulum runs", evidence: "the analysis notebook and the raw data" },
      { when: "The rig works", becomes: "milestone", example: "Double pendulum tracker logs 200 runs a day unattended", evidence: "the video and the code" },
    ],
    signers: "the lab instructor, the PI or a TA",
  },
  {
    id: "chemistry", field: "Chemistry",
    tools: [T("Benchling", "official", "notebook entries, registry and results (your institution's tenant)"), T("LabArchives", "community", "notebook listing and search (small project); or PDF exports"), T("Instrument software (NMR, HPLC, IR)", "files", "exported spectra and reports"), T("Zotero", "community", "your references and notes"), T("Jupyter", "community", "analysis notebooks")],
    moments: [
      { when: "A synthesis or growth works", becomes: "milestone", example: "Grew a 14 mm single crystal over three weeks", evidence: "the notebook entry and photos" },
      { when: "Characterization confirms it", becomes: "result", example: "Product confirmed by ¹H NMR, 87% yield", evidence: "the spectrum and the notebook entry" },
    ],
    signers: "the PI, the lab manager or the course instructor",
  },
  {
    id: "biology", field: "Biology",
    tools: [T("Benchling", "official", "notebook entries, sequences, registry and results"), T("PubMed", "official", "search and full text through Anthropic's PubMed connector (it isn't NCBI's)"), T("R / RStudio", "official", "run R in your session through Posit's mcptools package"), T("Zotero", "community", "references and annotations"), T("Google Sheets", "official", "plate maps and data (Developer Preview)")],
    moments: [
      { when: "An experiment gives a clear result", becomes: "result", example: "Knockdown cut expression 72% (n = 3, p < 0.01)", evidence: "the notebook entry and the figure" },
      { when: "Something you built is used", becomes: "milestone", example: "DNA model printed and used in the BIO 101 lab", evidence: "photos and the course page" },
    ],
    signers: "the PI, a postdoc who supervised it, or the course instructor",
  },
  {
    id: "environment", field: "Environment",
    tools: [T("QGIS", "community", "layers and processing via a plugin; or GeoPackage/GeoJSON"), T("ArcGIS", "official", "Esri's servers cover developer docs and location services; your own content via the ArcGIS API or exports"), T("Google Earth Engine", "community", "imagery queries (early); or earthengine-api in Python"), T("R / RStudio", "official", "analysis through Posit's mcptools"), T("Google Sheets", "official", "logger data (Developer Preview)")],
    moments: [
      { when: "A data series runs unbroken", becomes: "milestone", example: "Weather station logged 90 days without a gap", evidence: "the data export and a photo of the station" },
      { when: "The analysis finds something", becomes: "result", example: "Campus canopy cuts surface temperature 4.2 °C in July", evidence: "the map and the notebook" },
    ],
    signers: "the environmental club's officers, a field-course instructor or the PI",
  },
  {
    id: "space", field: "Space",
    tools: [T("Autodesk Fusion", "official", "models and data"), T("ANSYS", "official", "structural and thermal runs through PyAnsys"), T("MATLAB", "official", "orbit and link-budget analysis"), T("KiCad", "community", "avionics boards"), GITHUB],
    moments: [
      { when: "A qualification test passes", becomes: "milestone", example: "CubeSat structure passed the vibration test at launch levels", evidence: "the test report and the video" },
      { when: "A subsystem meets its budget", becomes: "result", example: "Link budget closes with 6.3 dB margin at 500 km", evidence: "the analysis and the commit" },
    ],
    signers: "the space systems lab's lead, the test-facility engineer or the faculty advisor",
  },
  {
    id: "medicine", field: "Medicine",
    tools: [T("PubMed", "official", "literature through Anthropic's PubMed connector (not NCBI's)"), T("REDCap", "community", "records and instruments with a project API token: check your IRB and institution's rules first, and never post patient data"), T("R / RStudio", "official", "analysis through Posit's mcptools"), T("Stata", "community", "do-files and results (licensed Stata 17+)"), T("Autodesk Fusion", "official", "device models")],
    moments: [
      { when: "A device works in testing", becomes: "milestone", example: "Prosthetic hand gripped and lifted a 500 g bottle", evidence: "the test video and the design version" },
      { when: "A study or review is complete", becomes: "milestone", example: "Systematic review screened 1,240 abstracts, 38 included", evidence: "the protocol registration and the preprint" },
    ],
    signers: "the supervising physician or PI, the course director, or the biomedical society's officers",
  },
  {
    id: "business", field: "Business",
    tools: [T("Stripe", "official", "payments, customers and subscriptions (use test mode while you learn)"), T("Shopify", "official", "products, orders and analytics through your store's server"), T("Notion", "official", "pages and databases"), T("Google Analytics", "official", "GA4 reports (experimental, read-only)"), T("HubSpot", "official", "CRM records and activities"), T("QuickBooks", "official", "invoices and reports")],
    moments: [
      { when: "A sales or revenue mark is hit", becomes: "result", example: "Coffee cart sold 1,200 cups in its first month", evidence: "a Stripe or Shopify summary (totals only, no customer details)" },
      { when: "You launch", becomes: "milestone", example: "Launched online ordering; 140 orders in week one", evidence: "the live page and the order summary" },
    ],
    signers: "the entrepreneurship club's officers, an accelerator mentor or a professor",
  },
  {
    id: "design", field: "Design",
    tools: [T("Figma", "official", "frames, components and variables"), T("Canva", "official", "designs, folders and exports"), T("Autodesk Fusion", "official", "product models"), T("Blender", "official", "scenes and objects (Blender Lab's server; the popular ahujasid one is separate and unaffiliated)"), T("Adobe Express", "official", "Adobe's hosted creativity server (the Photoshop and Illustrator desktop servers are only previewed)")],
    moments: [
      { when: "A prototype passes its test", becomes: "milestone", example: "Flat-pack chair held 120 kg in the load test", evidence: "the test video and the model" },
      { when: "A design ships or is critiqued", becomes: "update", example: "Wayfinding system v2: 6 of 8 testers found the lab in under a minute", evidence: "the Figma file and the test notes" },
    ],
    signers: "the studio instructor, the critique panel or a client",
  },
  {
    id: "media", field: "Media",
    tools: [T("DaVinci Resolve", "community", "projects, timelines and renders (easiest with Studio); or EDL/XML exports"), T("YouTube", "community", "video and channel stats through the Data API (no Google server)"), T("Adobe Premiere", "files", "exports and EDLs (Adobe's desktop server is only previewed)"), T("Canva", "official", "posters and thumbnails"), T("Google Drive", "official", "scripts and cuts (Developer Preview)")],
    moments: [
      { when: "The piece is screened or published", becomes: "milestone", example: "Documentary short screened to 300 people at the fall showcase", evidence: "the screening page and the film link" },
      { when: "The audience responds", becomes: "result", example: "12,400 views and 61% average watch time in the first week", evidence: "the YouTube analytics summary" },
    ],
    signers: "the film club's officers, the festival programmer or the course instructor",
  },
  {
    id: "social-science", field: "Social science",
    tools: [T("Qualtrics", "official", "surveys and responses (check its setup docs); or CSV/SPSS exports"), T("Google Sheets", "official", "data (Developer Preview); Google Forms has no server, so link its responses to a Sheet"), T("R / RStudio", "official", "analysis through Posit's mcptools"), T("Stata", "community", "do-files and results"), T("SPSS", "files", "no server: export .sav to CSV"), T("Zotero", "community", "references")],
    moments: [
      { when: "Data collection closes", becomes: "result", example: "Campus rent survey closed with 412 responses (31% response rate)", evidence: "the survey summary (never individual responses)" },
      { when: "The findings are published or used", becomes: "milestone", example: "Rent report published and cited by the student senate", evidence: "the report and the senate minutes" },
    ],
    signers: "the faculty advisor, the IRB-approved PI or the society's officers",
  },
  {
    id: "education", field: "Education",
    tools: [T("Google Classroom", "official", "courses, coursework and submissions (Developer Preview)"), T("Canvas LMS", "community", "courses and assignments with a personal API token"), T("Google Forms / Sheets", "official", "feedback, through Sheets (Developer Preview)"), T("Canva", "official", "materials"), T("Notion", "official", "lesson plans")],
    moments: [
      { when: "Something you made is used in a classroom", becomes: "milestone", example: "Tactile fraction kit used in three fourth-grade classes this term", evidence: "photos (no students' faces) and the lesson plan" },
      { when: "Learners improve", becomes: "result", example: "Post-test scores rose 18 points across 64 students", evidence: "the aggregate results (never individual students)" },
    ],
    signers: "the cooperating teacher, the school's principal or the course instructor",
  },
];

/** Tools that help in every field. */
export const EVERYONE: PlaybookTool[] = [
  T("Google Drive and Calendar", "official", "files and events (Google's Workspace servers are in Developer Preview; Claude also has its own connectors)"),
  T("Slack", "official", "messages and channels (your workspace admin may need to approve it)"),
  T("Discord", "community", "channel messages with a bot token"),
  T("Notion", "official", "pages and databases"),
];

export const CONNECT_LABEL: Record<Connect, string> = { official: "Official MCP server", community: "Community MCP server", files: "Reads your exports" };

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
/** The playbook for a field, by id ("data-ai") or name ("Data & AI"), forgiving about case and spacing. */
export function playbookFor(field?: string | null): Playbook | undefined {
  if (!field) return undefined;
  const k = norm(field);
  return PLAYBOOKS.find((p) => norm(p.id) === k || norm(p.field) === k) ?? PLAYBOOKS.find((p) => k.length >= 4 && (norm(p.field).startsWith(k) || k.startsWith(norm(p.field))));
}

export const PLAYBOOK_INDEX_URI = "brazework://playbooks";
export const playbookUri = (p: Playbook) => `${PLAYBOOK_INDEX_URI}/${p.id}`;

export function playbookMarkdown(p: Playbook): string {
  return [
    `# ${p.field}: Brazework playbook`,
    "",
    "## Your tools and how your assistant reaches them",
    ...p.tools.map((t) => `- **${t.name}** (${CONNECT_LABEL[t.connect].toLowerCase()}): ${t.reads}`),
    ...EVERYONE.map((t) => `- **${t.name}** (${CONNECT_LABEL[t.connect].toLowerCase()}): ${t.reads}`),
    "",
    "## Moments worth recording",
    ...p.moments.map((m) => `- ${m.when} → a ${m.becomes === "result" ? "result post" : m.becomes === "update" ? "build update" : "milestone"}. Example: “${m.example}”. Evidence: ${m.evidence}.`),
    "",
    `## Who signs\n${p.signers[0].toUpperCase()}${p.signers.slice(1)}. A club verifies a milestone you log with it; anyone else (a professor, PI, manager or mentor) signs through request_signature, with their university or company email.`,
    "",
    "Community servers are written by other people: read one before you install it. Brazework never posts without the member's yes.",
  ].join("\n");
}

export function playbooksIndexMarkdown(): string {
  return [
    "# Brazework playbooks",
    "One per field: which tools connect, the moments worth recording, and who signs. Read brazework://playbooks/<id>.",
    "",
    ...PLAYBOOKS.map((p) => `- ${p.field}: ${playbookUri(p)}`),
  ].join("\n");
}

// ---------- Prompts (slash commands in the member's assistant) ----------
export type PromptArg = { name: string; description: string; required: boolean };
export type PromptDef = { name: string; title: string; description: string; arguments: PromptArg[] };
const FIELD_ARG: PromptArg = { name: "field", description: "Your field, e.g. Mechanical, Data & AI, Medicine. Leave it out to use the field on your Brazework profile.", required: false };
const WHAT_ARG: PromptArg = { name: "what", description: "What happened, in a few words (optional: your assistant can look).", required: false };

export const PROMPTS: PromptDef[] = [
  { name: "start", title: "Get me started", description: "Your first minute: find something you really finished in the tools you've connected, and turn it into your first milestone, with its proof, ready for the person who saw it to sign.", arguments: [FIELD_ARG] },
  { name: "shipped", title: "I shipped something", description: "Turn work you just finished (a merged PR, a new version, a passed test) into a milestone with evidence, for your club to verify or someone to sign.", arguments: [FIELD_ARG, WHAT_ARG] },
  { name: "result", title: "I got a result", description: "Turn a number (a run, a test, a measurement, a sales total) into a result post with specifics.", arguments: [FIELD_ARG, WHAT_ARG] },
  { name: "standup", title: "Write my standup", description: "Write today's standup (done, next, blocked) from what your connected tools show since yesterday, and save it to your Brazework drafts. Nothing is posted until you approve it.", arguments: [FIELD_ARG, { name: "date", description: "The day it's for, as YYYY-MM-DD (optional: today).", required: false }] },
  { name: "week", title: "Recap my week", description: "Look over the last 7 days in your connected tools and draft the 1–3 things worth recording.", arguments: [FIELD_ARG] },
  { name: "ask_signature", title: "Ask someone to sign", description: "Ask the professor, PI, manager or mentor who saw your work to sign one of your milestones.", arguments: [{ name: "who", description: "Who saw it, e.g. “Dr. Lee, my lab PI”.", required: false }] },
  { name: "setup", title: "Connect my tools", description: "Which of your field's tools your assistant can reach, and how to connect them in a few minutes.", arguments: [FIELD_ARG] },
];
PROMPTS.push(...INTENT_PROMPTS);

export type Scopes = { canDraft: boolean; canPost: boolean };

function fieldLine(p: Playbook | undefined, asked?: string): string {
  if (p) {
    const tools = p.tools.map((t) => `${t.name} (${t.connect === "files" ? "read my exports" : t.connect === "community" ? "community server" : "official server"})`).join(", ");
    return `My field is ${p.field}. The tools people in it use: ${tools}. Use whichever of these you're connected to; for the rest, read the files or command-line output I point you to. The full playbook is the resource ${playbookUri(p)}.`;
  }
  return `${asked ? `I said my field is “${asked}”, which isn't one Brazework has a playbook for, so ` : ""}Call me first to see my field, then read the matching playbook from ${PLAYBOOK_INDEX_URI}.`;
}

const READ_ONLY = "This Brazework token can only read, so don't try to post or draft: write it out for me to paste into Brazework, and tell me I can make a token that leaves drafts in Brazework → Settings → Your tools.";

function writeLine(s: Scopes, kind: "milestone" | "post"): string {
  const live = kind === "milestone" ? "log_milestone" : "post_update";
  const draft = kind === "milestone" ? "draft_milestone" : "draft_post";
  if (s.canPost) return `Show me exactly what will appear and wait for my yes. Then call ${live}. If I'd rather look at it later in Brazework, call ${draft} instead: it waits in my drafts until I approve it there.`;
  if (s.canDraft) return `Save it with ${draft}: it waits in my Brazework drafts until I approve it, and nothing is posted before that. This token can't post directly.`;
  return READ_ONLY;
}

// After a milestone with no club: who signs it. Only a token that can post may email someone.
function signLine(s: Scopes): string {
  if (s.canPost) return "If there's no club, offer to ask the person who saw it to sign (request_signature), and only send it after I say who and yes.";
  return "If there's no club, tell me to ask the person who saw it from the milestone in Brazework (“Ask someone to vouch”): this token can't email anyone for me.";
}

/** The message a prompt sends, for this member's field and what their token may do. */
// The intent prompts (club_week, career_fair) live in lib/mcp-intent-prompts.ts.
export function promptText(name: string, args: Record<string, string | undefined>, s: Scopes): string | null {
  const p = playbookFor(args.field);
  const what = args.what?.trim() ? ` (${args.what.trim().slice(0, 300)})` : "";
  const ex = p?.moments.find((m) => m.becomes === "milestone") ?? p?.moments[0];
  const exR = p?.moments.find((m) => m.becomes === "result") ?? p?.moments[0];
  switch (name) {
    case "start":
      return [
        "Get me started on Brazework: turn one thing I've really finished into my first milestone, in about a minute.",
        p ? fieldLine(p, args.field) : `Call me first to see my field and what's on my record, then read the matching playbook from ${PLAYBOOK_INDEX_URI}.`,
        "1. Look at the tools you can reach right now from that list, over my last 30 days: merged pull requests and releases, finished runs, exported reports, files I shipped. Pick the single strongest piece of finished work that has proof. If you can't reach any of them, ask me for one link that shows something I finished (a repo, a doc, a video).",
        "2. Call my_projects and pick the project it belongs to. If I have none yet, tell me to type what I'm building in the box on Brazework's Home page (one line is enough), then come back.",
        `3. Write it as a milestone: the title is what was achieved, with numbers${ex ? `, like “${ex.example}”` : ""}; the evidence is 1 to 8 https links. Show it to me in a few lines.`,
        `4. ${writeLine(s, "milestone")}`,
        `5. ${signLine(s)}`,
        "6. End with the link from the result, and one line on what I could record next from my field's playbook.",
      ].join("\n");
    case "shipped":
      return [
        `I just finished something${what} and want it on my Brazework record as a milestone.`,
        fieldLine(p, args.field),
        "1. Find the concrete outcome and its proof in my tools: the merged pull request and its CI run, the new version, the test video or log, the report. Numbers beat adjectives.",
        "2. Call my_projects to pick the project, and my_clubs to pick the club that saw it. If no club did, leave the club out: it then waits for a signature from whoever saw it.",
        `3. Write the title as what was achieved, with numbers${ex ? `, like “${ex.example}”` : ""}; the detail as how it was done and measured; the evidence as 1 to 8 https links.`,
        `4. ${writeLine(s, "milestone")}`,
        `5. ${signLine(s)}`,
      ].join("\n");
    case "result":
      return [
        `I have a result${what} to share on Brazework.`,
        fieldLine(p, args.field),
        "1. Get the real numbers from my tools (the run, the test, the measurement, the totals) and compare them with the last best or the baseline. Never invent a number: if you can't find it, ask me.",
        `2. Draft a short post in my voice, kind "result": what changed, the numbers, how it was measured, what's next${exR ? `. Like: “${exR.example}”` : ""}. Attach it to the right project from my_projects, and up to 3 #tags.`,
        `3. ${writeLine(s, "post")}`,
        "Keep private things out: no customer, patient or student details, no secrets, nothing from an employer's confidential work.",
      ].join("\n");
    case "standup": {
      const day = /^\d{4}-\d{2}-\d{2}$/.test(args.date?.trim() ?? "") ? args.date!.trim() : "today";
      return [
        `Write my standup for ${day === "today" ? "today" : day} from my tools, for my Brazework record.`,
        fieldLine(p, args.field),
        "1. Look at what you can reach since my last working day: commits and merged pull requests, CI and test runs, issues and tickets I moved, documents and runs I finished, my calendar for today. Call my_projects so you can attach it to the right project.",
        "2. Write it in my voice, short, as three parts: Done (what I finished, with numbers and links), Next (what I'm doing today), Blocked (what's in my way, or “Nothing”). Never invent work or numbers: if you can't see it, leave it out or ask me.",
        "3. Keep private things out: no customer, patient or student details, no secrets, nothing from an employer's confidential work. If something only makes sense with those, describe it in general terms.",
        s.canDraft || s.canPost
          ? `4. Save it with draft_post, kind "update", attached to the project it's mostly about, with source_key “standup:${day === "today" ? "<today's date as YYYY-MM-DD>" : day}” so running this again the same day doesn't make a second one. Always a draft, even if this token can post: I approve it in Brazework. Then show me what you saved and the review link.`
          : `4. ${READ_ONLY}`,
      ].join("\n");
    }
    case "week":
      return [
        "Recap my last 7 days for my Brazework record.",
        fieldLine(p, args.field),
        "1. Look through what you can reach for the week: merged work, versions, runs, tests, results, launches. Call my_projects to see what's already recorded, so you don't repeat it.",
        "2. Pick the 1 to 3 things most worth recording, and for each say whether it's a milestone (something achieved, with proof) or a post (an update or result).",
        s.canDraft || s.canPost
          ? `3. ${s.canPost ? "Go through them one at a time: show each and wait for my yes before posting or logging it, or save it as a draft if I say “later”." : "Save each with draft_post or draft_milestone, with a source_key like “week:<year>-W<week>:<short-name>” so running this twice doesn't make duplicates."} Then tell me what's waiting in Brazework.`
          : `3. ${READ_ONLY}`,
      ].join("\n");
    case "ask_signature":
      if (!s.canPost) return `I want someone who saw my work to sign one of my Brazework milestones. This token can't send asks (it would email someone for me), so tell me to open the milestone in Brazework and use “Ask someone to vouch”, or to turn on “Can post” for this token in Settings → Your tools.`;
      return [
        `I want someone who saw my work to sign one of my Brazework milestones${args.who?.trim() ? `: ${args.who.trim().slice(0, 120)}` : ""}.`,
        "1. Call my_projects and list my open_milestones (waiting for a club or a signature). Ask me which one.",
        "2. Ask me who saw it: their university or company email (Gmail, Outlook and the like don't count) and how they know my work: professor, ta, pi, manager, mentor or other. Never someone on the project's team.",
        "3. Show me exactly who will get the email and for which milestone, and wait for my yes. Then call request_signature. They get a one-time link; they don't need an account.",
      ].join("\n");
    case "setup":
      return [
        "Help me connect the tools I use to Brazework, so my work shows up on my record.",
        fieldLine(p, args.field),
        "1. For each tool, tell me how you'd reach it: an official MCP server (link me to the vendor's own setup page), a community server (say it's written by someone else and that I should read it before installing), or my exports and command-line output (say which file or command).",
        "2. Don't install or sign in to anything without asking me.",
        "3. Suggest one moment from my field to try first, and the slash command for it (shipped, result or week).",
        "4. For work I want recorded without me asking, point me to Brazework → Settings → Your tools → GitHub Actions: it leaves drafts for me to approve.",
      ].join("\n");
    default:
      return intentPromptText(name, args, s);
  }
}
