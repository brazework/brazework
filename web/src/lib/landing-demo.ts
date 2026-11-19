// The landing page's demos (components/landing): the example people, clubs and work they show, and
// the logic behind what a visitor can try. Everything here is example data, and the page says so.
// The people are a mix on purpose: students signed by a club, and working people signed by a manager
// or a client.
// Pure, so it's tested without a browser (tests/landing-demo.test.ts).

/** What the hero's milestone says before the visitor types their own. */
export const EXAMPLE_BUILD = "A line-following robot";
export const stageTitle = (build: string) => build || EXAMPLE_BUILD;

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
