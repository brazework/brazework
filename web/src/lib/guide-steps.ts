// The first steps a new member sees on Today (the start checklist), worded for where they are.
// A student starts by joining their club, because the club's officers sign their work. Someone who
// already works may never have a club, so they start with the work itself and ask a person who saw
// it to sign by email (supabase/vouches.sql). Anyone in a club gets the club's steps, whatever they
// chose at sign-up. Pure, and tested (tests/guide-steps.test.ts); lib/guide.ts fills in the facts.

export type GuideStep = {
  id: string;
  label: string;
  done: boolean;
  /** Where to go to do it. */
  href: string;
  /** Why it matters, in one line. */
  why: string;
  /** What to ask Copilot for help with this step. */
  ask?: string;
};

export type LoopFacts = {
  /** Chose "Student" at sign-up. */
  student: boolean;
  inClub: boolean;
  hasProject: boolean;
  /** Has posted an update on a project. */
  hasUpdate: boolean;
  /** Has asked for a milestone to be verified, by a club or a person. */
  asked: boolean;
  verified: boolean;
  /** Milestones exist in this database (lib/db-features.ts). */
  milestones: boolean;
};

/** True when their work is signed through a club: every student, and anyone who has joined one. */
export const clubPath = (f: Pick<LoopFacts, "student" | "inClub">) => f.student || f.inClub;

/** How Ember should describe them when it drafts for them ("a Physics student", "a design professional"). */
export const describeMember = (field: string | null | undefined, student: boolean) => `a ${field?.trim() ? `${field.trim()} ` : ""}${student ? "student" : "professional"}`;

export function loopSteps(f: LoopFacts): GuideStep[] {
  const project: GuideStep = { id: "project", label: "Add what you're building", done: f.hasProject, href: "/profile#projects", why: "A project with photos and specs. No repo needed; Ember can import one from GitHub.", ask: "Help me turn something I've built into a project on my profile." };
  if (clubPath(f)) {
    return [
      { id: "club", label: "Join your club", done: f.inClub, href: "/communities?tab=discover", why: "Your club is who vouches for your work. Not here yet? Create it, or invite your officer." },
      project,
      { id: "update", label: "Post an update about it", done: f.hasUpdate, href: "/feed#composer", why: "Pick the project in the composer and share it with your club." },
      ...(f.milestones ? [
        { id: "ask-verify", label: "Ask your club to verify a milestone", done: f.asked, href: "/profile#projects", why: "Add evidence (a photo, video, commit or the event) and your officers review it." },
        { id: "verified", label: "Get your first verified milestone", done: f.verified, href: "/profile#projects", why: "It shows on your profile with your club's name on it: proof no résumé can fake." },
      ] : []),
    ];
  }
  return [
    project,
    { id: "update", label: "Post an update about it", done: f.hasUpdate, href: "/feed#composer", why: "Pick the project in the composer. Steady updates are what a signature sits next to." },
    ...(f.milestones ? [
      { id: "ask-verify", label: "Ask someone who saw it to verify a milestone", done: f.asked, href: "/profile#projects", why: "A coworker, a mentor or anyone who was there. We email them a link; they don't need an account." },
      { id: "verified", label: "Get your first verified milestone", done: f.verified, href: "/profile#projects", why: "It shows on your profile with their name and where they work: proof no résumé can fake." },
    ] : []),
  ];
}
