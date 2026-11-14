// A build's place on the way from built to signed, and the one thing worth doing next. The Build
// page's cards show exactly one primary button from this (app/(app)/projects/bench-card.tsx).
// Pure, and tested (tests/build-step.test.ts).

export type BuildCounts = { updates: number; verified: number; waiting: number };
export type BuildStep = { kind: "log" | "verify" | "waiting"; label: string; hint: string };

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function nextBuildStep(b: BuildCounts): BuildStep {
  if (b.waiting > 0) return { kind: "waiting", label: "Waiting on a signature", hint: `${plural(b.waiting, "result")} with the people you asked. Keep logging in the meantime.` };
  if (b.verified > 0) return { kind: "log", label: "Log an update", hint: "Signed work reads best next to steady progress." };
  if (b.updates > 0) return { kind: "verify", label: "Get it verified", hint: "Pick a result and ask someone who saw it to sign it." };
  return { kind: "log", label: "Log your first update", hint: "What you built, tested or learned. One line is enough." };
}

/** How far a build has got: 0 started, 1 logged (it has updates or a result waiting), 2 signed. */
export function buildStage(b: BuildCounts): 0 | 1 | 2 {
  return b.verified > 0 ? 2 : b.updates > 0 || b.waiting > 0 ? 1 : 0;
}
