// Goals (supabase/goals.sql, Linear FIX-95): what a member is working toward, and their path to it.
// Pure, so the path and the next step are unit-tested (tests/goals.test.ts). The path is built from
// what's really on their record: projects, milestones signed (by a club or a vouch), milestones still
// waiting, and who looked.

export const GOAL_KINDS = {
  internship: { label: "Internship", title: "a summer internship", target: 3, signers: "your club or a mentor", looking: "companies hiring interns" },
  job: { label: "Next job", title: "your next full-time role", target: 4, signers: "a coworker or your club", looking: "hiring teams" },
  grad: { label: "Grad school", title: "grad school", target: 2, signers: "a professor or PI", looking: "grad programs" },
  research: { label: "Research lab", title: "a spot in a research lab", target: 2, signers: "the PI or a TA", looking: "labs" },
  competition: { label: "Competition", title: "a competition win", target: 6, signers: "your club's officers", looking: "sponsors" },
  funding: { label: "Funding", title: "funding for what you build", target: 3, signers: "a professor or a partner", looking: "sponsors and funds" },
} as const;
export type GoalKind = keyof typeof GOAL_KINDS;
export const isGoalKind = (k: unknown): k is GoalKind => typeof k === "string" && k in GOAL_KINDS;

export type Goal = { id: number; kind: GoalKind; target: string; visible: boolean; status: "active" | "met" | "dropped"; met_note: string; created_at: string; closed_at: string | null };
export type Record_ = { projects: number; signed: number; waiting: number; looked: number };

export type Step = { key: "build" | "sign" | "found"; title: string; detail: string; state: "done" | "now" | "next" };
// href "share" means: copy the profile link (the card renders a copy button for it).
export type Next = { text: string; href: string; action: string };

/** "a summer internship in power electronics" */
export function goalTitle(g: Pick<Goal, "kind" | "target">): string {
  const t = GOAL_KINDS[g.kind].title;
  return g.target ? `${t} in ${g.target}` : t;
}

export function goalPath(g: Pick<Goal, "kind" | "target">, r: Record_): { steps: Step[]; done: number; next: Next } {
  const k = GOAL_KINDS[g.kind];
  const built = r.projects > 0;
  const signed = Math.min(r.signed, k.target);
  const proven = r.signed >= k.target;
  const steps: Step[] = [
    { key: "build", title: "Log your work", detail: built ? `${r.projects} ${r.projects === 1 ? "project" : "projects"} on your record` : "Add what you're working on", state: built ? "done" : "now" },
    { key: "sign", title: "Get it signed", detail: `${signed} of ${k.target} milestones signed by ${k.signers}${r.waiting ? ` · ${r.waiting} waiting` : ""}`, state: proven ? "done" : built ? "now" : "next" },
    { key: "found", title: "Get found", detail: r.looked ? `${r.looked} ${r.looked === 1 ? "person" : "people"} looked this month` : `Visible to ${k.looking} searching your field`, state: proven && r.looked > 0 ? "done" : proven ? "now" : "next" },
  ];
  const done = steps.filter((s) => s.state === "done").length;
  return { steps, done, next: nextStep(g, r) };
}

/** The one thing to do next, in plain words, with where to do it. */
export function nextStep(g: Pick<Goal, "kind" | "target">, r: Record_): Next {
  const k = GOAL_KINDS[g.kind];
  if (r.projects === 0) return { text: `Add the project you're working toward ${k.title} with: what it is, what it's built with, a photo or a link.`, href: "#projects", action: "Add a project" };
  if (r.waiting > 0) return { text: `${r.waiting} ${r.waiting === 1 ? "milestone is" : "milestones are"} waiting to be signed. A quick nudge to ${k.signers} usually does it.`, href: "#projects", action: "See what's waiting" };
  if (r.signed < k.target) {
    const left = k.target - r.signed;
    return { text: `Log your next result as a milestone (${left} more to go) and ask ${k.signers} who saw it to sign it.`, href: "#projects", action: "Add a milestone" };
  }
  if (r.looked === 0) return { text: `Your record is ready. Send your page to ${k.looking} you'd like to work with; it's the link that replaces a résumé.`, href: "share", action: "Copy your link" };
  return { text: `${r.looked} ${r.looked === 1 ? "person" : "people"} looked this month. Keep the log going weekly and answer your Requests.`, href: "/messages", action: "Open Requests" };
}

// Sign-up asks where you're headed (Josh, 22 Nov: the app is set up around your field and your goal),
// on "About you" (app/onboarding/finish-signup-form.tsx). The goals that fit a student or someone who
// already works, most likely first, each with an example of what it's in. Optional: skipping it is fine.
export type SignupGoal = { kind: GoalKind; label: string; example: string };
export function signupGoals(type: "student" | "professional"): SignupGoal[] {
  return type === "student"
    ? [
        { kind: "internship", label: "An internship", example: "power electronics" },
        { kind: "job", label: "My first job", example: "backend engineering" },
        { kind: "grad", label: "Grad school", example: "a robotics PhD" },
        { kind: "research", label: "A research lab", example: "a materials lab" },
        { kind: "competition", label: "A competition", example: "Formula SAE" },
      ]
    : [
        { kind: "job", label: "My next role", example: "staff engineer" },
        { kind: "funding", label: "Funding", example: "a climate hardware startup" },
        { kind: "grad", label: "Grad school", example: "an MBA" },
        { kind: "research", label: "A research lab", example: "applied ML" },
      ];
}

/** A goal from the sign-up form, or null when none was picked or it doesn't fit (the form never blocks on it). */
export function signupGoalFrom(kind: unknown, target: unknown, type: "student" | "professional"): { kind: GoalKind; target: string } | null {
  if (!isGoalKind(kind) || !signupGoals(type).some((g) => g.kind === kind)) return null;
  const t = typeof target === "string" ? target.replace(/\s+/g, " ").trim() : "";
  return { kind, target: t.length <= 80 && !/[<>]/.test(t) ? t : "" };
}

// Torch does the next step (Josh, 26 Nov: "integrate with Torch to actually do it"). Each is what the
// goal card sends to the Ask Torch bar (lib/ember-bar.ts askTorch): plain words a member could have
// typed, specific to where they are on the path, ending in cards they approve. Torch's own rules still
// hold: it drafts, the member confirms, and it never invents work or signatures.
export type TorchAsk = { label: string; prompt: string };

/** The one next step, done with Torch. */
export function torchNext(g: Pick<Goal, "kind" | "target">, r: Record_): TorchAsk {
  const k = GOAL_KINDS[g.kind], title = goalTitle(g);
  if (r.projects === 0) return { label: "Add it with Torch", prompt: `I'm working toward ${title}. Help me put the project I'm building on my record: ask me what it is and what it's built with, then draft it as a project for me to approve.` };
  if (r.waiting > 0) return { label: "Nudge them with Torch", prompt: `I'm working toward ${title}. ${r.waiting === 1 ? "One of my milestones is" : `${r.waiting} of my milestones are`} still waiting to be signed. Look at what's waiting and draft a short, friendly nudge to whoever can sign each one.` };
  if (r.signed < k.target) return { label: "Find my next milestone", prompt: `I'm working toward ${title}. Look at my projects and recent work and suggest the next result worth getting signed. Draft it as a milestone, and tell me who should sign it (${k.signers}).` };
  if (r.looked === 0) return { label: "Find who to send it to", prompt: `I'm working toward ${title}, and my record has ${r.signed} signed results. Find ${k.looking}${g.target ? ` in ${g.target}` : ""} on Brazework worth sending my record to, and draft a short message to the best one.` };
  return { label: "What should I do next?", prompt: `I'm working toward ${title}. ${r.looked} ${r.looked === 1 ? "person" : "people"} looked at my record this month. What's the best thing I can do this week? Draft it if it's something you can prepare.` };
}

/** A plan for the week, from the record. */
export const torchWeek = (g: Pick<Goal, "kind" | "target">): TorchAsk => ({
  label: "Plan my week",
  prompt: `Plan my week toward ${goalTitle(g)}: three concrete things, from what's on my record, most important first. Prepare whatever you can as cards for me to approve.`,
});

/** A goal in the member's own words: Torch drafts it as a goal card. Null when there's nothing to send. */
export function torchGoalFrom(words: string): TorchAsk | null {
  const w = words.replace(/\s+/g, " ").trim().slice(0, 200);
  if (w.length < 3) return null;
  return { label: "Ask Torch", prompt: `Here's where I'm headed: "${w}". Turn it into my goal on Brazework and draft it as a goal card for me to approve, then tell me the first step from what's on my record.` };
}
