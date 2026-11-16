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

// ── The Build card (app/(app)/projects/bench-card.tsx) ──────────────────────────────────────────
export const WEEKS = 12;
const WEEK_MS = 7 * 86_400_000;

/** How many things happened on a build in each of the last `weeks` weeks, oldest first; the last
 *  entry is the seven days ending now. Dates outside the window (or unreadable) are left out. */
export function weeklyActivity(dates: string[], now: number = Date.now(), weeks = WEEKS): number[] {
  const out = Array.from({ length: weeks }, () => 0);
  for (const d of dates) {
    const t = Date.parse(d);
    if (!Number.isFinite(t)) continue;
    const back = Math.floor(Math.max(0, now - t) / WEEK_MS);
    if (back < weeks) out[weeks - 1 - back]++;
  }
  return out;
}
export const activeWeeks = (w: number[]) => w.filter((n) => n > 0).length;

/** The three steps every build takes, and how far this one has got: logged, asked, signed. */
export type PathStep = { id: "logged" | "asked" | "signed"; label: string; done: boolean; note: string };
export function buildPath(b: BuildCounts): PathStep[] {
  const asked = b.waiting + b.verified;
  return [
    { id: "logged", label: "Logged", done: b.updates > 0 || asked > 0, note: b.updates ? plural(b.updates, "update") : asked ? plural(asked, "result") : "nothing yet" },
    { id: "asked", label: "Asked", done: asked > 0, note: b.waiting ? `${b.waiting} waiting` : asked ? "answered" : "nobody yet" },
    { id: "signed", label: "Signed", done: b.verified > 0, note: b.verified ? `${b.verified} signed` : "not yet" },
  ];
}

/** Across all your builds: what you logged in the last seven days, and where your results stand. */
export function weekSummary(builds: (BuildCounts & { weeks: number[] })[]): { thisWeek: number; signed: number; waiting: number } {
  return builds.reduce((a, b) => ({ thisWeek: a.thisWeek + (b.weeks.at(-1) ?? 0), signed: a.signed + b.verified, waiting: a.waiting + b.waiting }), { thisWeek: 0, signed: 0, waiting: 0 });
}
