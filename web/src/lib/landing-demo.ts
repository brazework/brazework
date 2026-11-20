// The landing page's demos (components/landing): the example people, clubs and work they show, and
// the logic behind what a visitor can try. Everything here is example data, and the page says so.
// The people are a mix on purpose: students signed by a club, and working people signed by a manager
// or a client.
// Pure, so it's tested without a browser (tests/landing-demo.test.ts).

/** What the hero's milestone says before the visitor types their own. */
export const EXAMPLE_BUILD = "A line-following robot";
export const stageTitle = (build: string) => build || EXAMPLE_BUILD;

/** A person the way the app names them in public: "Ben Cho" is "Ben C.". */
export function shortName(name: string): string {
  const [first, ...rest] = name.trim().split(/\s+/);
  const last = rest.at(-1);
  return last ? `${first} ${last[0]}.` : first;
}

// The hero demo's title block (components/landing/proof-stage.tsx, the kit's TitleBlock): where the
// example record stands at each moment of the story. Drafting, a draft, waiting on the person it was
// sent to, then on the record (the only green), and who found it. `empty` cells say "not yet".
export type HeroPhase = "typing" | "reading" | "draft" | "sent";
export type HeroCell = { label: string; value: string; tone?: "ok" | "waiting" | "empty" };
export function heroRecord({ phase, step, signer, finder, today }: { phase: HeroPhase; step: number; signer: string; finder: string; today: string }): HeroCell[] {
  const signed = step >= 2;
  const none = { value: "Not yet", tone: "empty" as const };
  const status: Omit<HeroCell, "label"> = signed ? { value: "On the record", tone: "ok" }
    : phase === "sent" ? { value: "Waiting", tone: "waiting" }
    : phase === "draft" ? { value: "Draft" }
    : { value: "Drafting" };
  return [
    { label: "Status", ...status },
    { label: "Signed by", ...(signed ? { value: shortName(signer) } : none) },
    { label: "Signed on", ...(signed ? { value: today } : none) },
    { label: "Found by", ...(step >= 3 ? { value: finder } : none) },
  ];
}

// ── The app tour ────────────────────────────────────────────────────────────────────────────────
export const PLACES = [
  { id: "today", label: "Home", about: "Your next step, and what your clubs posted." },
  { id: "build", label: "Projects", about: "Your projects and the milestones you hit on them." },
  { id: "club", label: "Clubs", about: "Where your club or study group runs, and where officers sign work." },
  { id: "proof", label: "Record", about: "Your public record: only signed work, with who signed it." },
  { id: "inbox", label: "Inbox", about: "Messages. Recruiters and strangers wait in Requests until you accept." },
] as const;
export type Place = (typeof PLACES)[number]["id"];

/** How far the visitor has taken the tour's loop: the officer signed, then the builder answered. */
export type Tour = { verified: boolean; accepted: boolean };

/** The tour's one line of guidance: what to try next, and the place it sends you to (if not this one). */
export function tourHint(place: Place, t: Tour): { text: string; go: Place | null; done: boolean } {
  if (!t.verified) {
    return place === "club"
      ? { text: "You're the officer here. Press Verify on Maya's milestone.", go: null, done: false }
      : { text: "Try it: open Clubs and sign Maya's milestone.", go: "club", done: false };
  }
  if (!t.accepted) {
    return place === "inbox"
      ? { text: "A company found the signed work. Accept the request.", go: null, done: false }
      : { text: "Signed, so Maya's Record shows it now, and a company noticed: open Inbox.", go: "inbox", done: false };
  }
  return { text: "That's the loop: built, signed, found.", go: null, done: true };
}

// ── Ember ───────────────────────────────────────────────────────────────────────────────────────
export type EmberAsk = { id: string; ask: string; checked: string; reply: string; card: { title: string; lines: string[] }; action: string; done: string };
export const EMBER_ASKS: EmberAsk[] = [
  {
    id: "update", ask: "Draft this week's update for Rocketry Club", checked: "the club report",
    reply: "Here's this week's update, drafted from the club's report. Every number comes from what members posted and what officers verified.",
    card: { title: "This week at Rocketry Club", lines: ["Welcome Dana and Theo, who joined this week.", "2 milestones verified, including Maya's 41.2 second run.", "Launch day is Saturday. Build night is Thursday at 7."] },
    action: "Post to the club", done: "Posted to Rocketry Club",
  },
  {
    id: "next", ask: "What should I log next?", checked: "your projects and milestones",
    reply: "Your robot has one signed milestone. The sensor board you finished on Tuesday isn't on your record yet.",
    card: { title: "Sensor board rev B assembled", lines: ["On Line-following robot.", "Ask Rocketry Club to sign it: Ben saw it at build night."] },
    action: "Log it and ask the club", done: "Sent to Rocketry Club",
  },
  {
    id: "clubs", ask: "Find clubs for me", checked: "clubs at your school",
    reply: "Two clubs match what you build. Both meet this week.",
    card: { title: "Robotics Society", lines: ["41 members. Meets Wednesdays at 6.", "Also a match: Embedded Systems Group, 18 members."] },
    action: "Ask to join", done: "Request sent to Robotics Society",
  },
];

/** The reply as far as it has been typed out: whole words only, so a word never appears half written. */
export function typedSoFar(text: string, chars: number): string {
  if (chars >= text.length) return text;
  if (chars <= 0) return "";
  const cut = text.lastIndexOf(" ", chars);
  return cut <= 0 ? "" : text.slice(0, cut);
}

// ── Company search ──────────────────────────────────────────────────────────────────────────────
export type Signed = { title: string; by: string; club: string; when: string };
export type Builder = { id: string; name: string; initials: string; role: string; open: string; signed: Signed[]; skills: string[] };

export const BUILDERS: Builder[] = [
  { id: "maya", name: "Maya Patel", initials: "MP", role: "Avionics and flight software, class of 2027", open: "Open to internships",
    signed: [{ title: "Line-following robot beat the course in 41.2 seconds", by: "Ben C.", club: "Rocketry Club", when: "Nov 16" }],
    skills: ["Robotics", "PID control", "C++"] },
  { id: "theo", name: "Theo Nguyen", initials: "TN", role: "Electrical engineer, three years in EV charging", open: "Open to new roles",
    signed: [{ title: "Battery management PCB passed bring-up", by: "Priya S., engineering manager", club: "Voltline", when: "Nov 2" }, { title: "Charger held 4.2 V across 50 cycles", by: "Priya S., engineering manager", club: "Voltline", when: "Oct 14" }],
    skills: ["PCB design", "KiCad", "Power electronics"] },
  { id: "ines", name: "Ines Okafor", initials: "IO", role: "Molecular biology, class of 2026", open: "Open to research",
    signed: [{ title: "CRISPR knockout confirmed on a gel", by: "Dr. Lee", club: "Gene Editing Lab", when: "Oct 29" }],
    skills: ["CRISPR", "PCR", "Gel electrophoresis"] },
  { id: "lena", name: "Lena Brooks", initials: "LB", role: "Freelance data analyst", open: "Open to contract work",
    signed: [{ title: "City rent survey published: 412 responses", by: "Omar H., director", club: "Eastside Tenants Union", when: "Oct 20" }],
    skills: ["Survey design", "R", "Data analysis"] },
  { id: "ben", name: "Ben Cho", initials: "BC", role: "Propulsion lead, class of 2026", open: "Open to internships and research",
    signed: [{ title: "Static fire at 1.2 kN", by: "Maya P.", club: "Rocketry Club", when: "Nov 7" }, { title: "Flight computer passed vibration test", by: "Maya P.", club: "Robotics Society", when: "Oct 8" }],
    skills: ["SolidWorks", "Load cells", "Python"] },
];
export const SEARCH_TRIES = ["robot", "PCB", "CRISPR", "survey"];

/** People whose signed work, skills, club or name match every word typed. Nothing typed: everyone. */
export function searchBuilders(q: string, list: Builder[] = BUILDERS): Builder[] {
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return list;
  return list.filter((b) => {
    const hay = [b.name, b.role, ...b.skills, ...b.signed.flatMap((s) => [s.title, s.club])].join(" ").toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}

// The hero's stories (components/landing/proof-stage.tsx): the same three steps told by seven people
// who work differently, each in a chat with their AI: what they ask, what it reads, the draft it
// writes, and who signs. The chips above the card name them (`who`, `tool`), so a visitor sees the
// range at a glance and picks theirs. The first is the student's: the page opens on it, and a
// visitor's own typed line becomes its milestone (so it has no title of its own). A Product Hunt
// visitor starts on the software engineer's (lib/launch.ts). Example people, companies and links.
export type HeroPerson = { initials: string; name: string; role: string };
export type HeroStory = {
  who: string; tool: string; title?: string; cmd: string; reads: string[]; reply: string; proof: string[]; send: string; sent: string;
  signer: HeroPerson & { act: string; done: string }; finder: HeroPerson & { ask: string };
};
export const HERO_STORIES: HeroStory[] = [
  { who: "Student", tool: "GitHub", cmd: "Add my line-following robot to my record", reads: ["Read your merged pull request", "Watched the expo run video"], reply: "Here's the draft with your proof. Send it to your club to verify?", proof: ["github.com/you/linebot/pull/42", "youtu.be/fall-expo-run"],
    send: "Send to club", sent: "Sent to Rocketry Club", signer: { initials: "BC", name: "Ben Cho", role: "Officer, Rocketry Club", act: "Verify", done: "Verified" },
    finder: { initials: "CD", name: "Cara Diaz", role: "Acme Aerospace", ask: "Saw your signed work on Brazework. Free to talk about our robotics internship?" } },
  { who: "Software", tool: "GitHub · Linear", title: "Checkout p95 latency down from 820 to 310 ms", cmd: "Put the checkout latency fix on my record", reads: ["Read pull request #1187, merged", "Read the before and after dashboard"], reply: "The numbers come from your dashboard. Ask Sam, your tech lead, to sign?", proof: ["github.com/acme/checkout/pull/1187", "linear.app/acme/ENG-412"],
    send: "Ask Sam to sign", sent: "Sent to Sam Rivera", signer: { initials: "SR", name: "Sam Rivera", role: "Staff Engineer, your tech lead", act: "Sign", done: "Signed" },
    finder: { initials: "JW", name: "Jordan Wu", role: "Northwind Payments", ask: "Saw your signed latency work. Open to a staff engineer conversation?" } },
  { who: "Mechanical", tool: "Onshape · test log", title: "Bracket 38% lighter, passed the 3.2 g vibration test", cmd: "Log the bracket redesign from today's shake test", reads: ["Compared the CAD, version 13 to 14", "Read the vibration test log"], reply: "Weight is from the two models, the pass is from the log. Ask Priya, who ran the test?", proof: ["onshape: bracket v13 → v14", "vibe-test-log.csv"],
    send: "Ask Priya to sign", sent: "Sent to Priya Nair", signer: { initials: "PN", name: "Priya Nair", role: "Test lead, ran the shake test", act: "Sign", done: "Signed" },
    finder: { initials: "KO", name: "Kofi Owusu", role: "Halcyon Drones", ask: "Saw your signed bracket work. Want to talk about our structures team?" } },
  { who: "Electrical", tool: "KiCad · scope", title: "Power board rev C: ripple down from 120 to 18 mV", cmd: "Add the rev C power board result to my record", reads: ["Compared the schematic, rev B to C", "Read both scope captures"], reply: "Ripple is from the scope captures. Ask Marcus, your hardware lead?", proof: ["kicad: power-board rev B → C", "scope-rev-c.png"],
    send: "Ask Marcus to sign", sent: "Sent to Marcus Lee", signer: { initials: "ML", name: "Marcus Lee", role: "Hardware lead, your manager", act: "Sign", done: "Signed" },
    finder: { initials: "SA", name: "Sofia Alvarez", role: "Voltline Energy", ask: "Saw your signed power board work. Open to a hardware engineer role?" } },
  { who: "Civil", tool: "Reports · site photos", title: "Retaining wall pour passed inspection, zero rework", cmd: "Put the retaining wall pour on my record", reads: ["Read inspection report #22", "Looked at six site photos"], reply: "The inspection report is the proof. Ask Hannah, who stamped it?", proof: ["inspection-report-22.pdf", "site-photos-nov-12"],
    send: "Ask Hannah to sign", sent: "Sent to Hannah Ortiz", signer: { initials: "HO", name: "Hannah Ortiz, PE", role: "Project engineer, on site", act: "Sign", done: "Signed" },
    finder: { initials: "DM", name: "Dev Mehta", role: "Granite Ridge Builders", ask: "Saw your signed site work. Free to talk about a field engineer role?" } },
  { who: "Research", tool: "W&B · notebook", title: "4 MB crop model, 94.1% on held-out field photos", cmd: "Put today's model results on my record", reads: ["Read your W&B run", "Read the held-out test notebook"], reply: "Accuracy is from the held-out set, same split as your baseline. Ask Dr. Ruiz?", proof: ["wandb.ai/you/crop/runs/3fk2", "heldout-eval.ipynb"],
    send: "Ask Dr. Ruiz to sign", sent: "Sent to Dr. Elena Ruiz", signer: { initials: "ER", name: "Dr. Elena Ruiz", role: "Assistant Professor, your lab", act: "Sign", done: "Signed" },
    finder: { initials: "AK", name: "Amara Kim", role: "AgriSense Labs", ask: "Saw your signed model results. Interested in our ML research internship?" } },
  { who: "Design", tool: "Figma", title: "Checkout redesign lifted conversion 12%", cmd: "Add the Lumen checkout redesign to my record", reads: ["Read the Figma file", "Read the client's A/B test report"], reply: "The lift is from the client's A/B test. Ask Noor, who ran it?", proof: ["figma.com/file/lumen-checkout", "ab-test-report.pdf"],
    send: "Ask Noor to sign", sent: "Sent to Noor Haddad", signer: { initials: "NH", name: "Noor Haddad", role: "Head of Growth, Lumen (your client)", act: "Sign", done: "Signed" },
    finder: { initials: "RT", name: "Rosa Torres", role: "Studio Field", ask: "Saw your signed redesign. Taking on new client work this spring?" } },
];
