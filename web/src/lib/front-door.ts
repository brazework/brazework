import { TOPICS } from "@/lib/forge";

// The front door (landing → sign-up → first run). A visitor types what they're building on the
// landing page; that line rides into sign-up in the link, is kept in this browser (like the goal,
// app/(auth)/signup/remember-goal.tsx), and is waiting in the first-build box on Today. Nothing is
// sent anywhere until they tap "Start my build". Pure, and tested (tests/front-door.test.ts).

/** Where the typed build waits in the browser between the landing page and Today. */
export const BUILD_KEY = "brazework-build";

/** A typed build, tidied: single spaces, trimmed, at most 300 characters (the project title limit),
 *  and "" when it's too short to be one (the first-build box needs 3). */
export function cleanBuild(text: string): string {
  const s = text.replace(/\s+/g, " ").trim().slice(0, 300);
  return s.length >= 3 ? s : "";
}

/** The sign-up link from the landing page: the goal when one is picked, the build when there is one. */
export function signupHref(goal: string, build: string): string {
  const q = new URLSearchParams();
  if (goal) q.set("goal", goal);
  const b = cleanBuild(build);
  if (b) q.set("build", b);
  const s = q.toString();
  return s ? `/signup?${s}` : "/signup";
}

/** Onboarding: a field starts with its first three interests picked (three are needed to continue),
 *  until the member changes one themselves. */
export function starterInterests(field: string): string[] {
  return [...(TOPICS.find((t) => t.name === field)?.topics ?? [])].slice(0, 3);
}
