// The build streak in the weekly loop (Linear FIX-67): how many weeks in a row you've shown work (a
// post or a milestone). Weekly, not daily, so it rewards steady building, not checking in. This week
// counts as soon as you post; until then the streak stays alive from last week. One missed week is
// forgiven, so a single quiet week (exams, a trip) doesn't wipe out a long run. Pure, so it's tested
// (tests/streak.test.ts). Weeks start Monday 00:00 UTC, like the rest of the app.

const WEEK = 7 * 864e5;

export function weekStart(t: number): number {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export type Streak = { weeks: number; thisWeek: boolean; forgiven: boolean };

export function buildStreak(times: number[], now: number): Streak {
  const active = new Set(times.filter((t) => t <= now).map(weekStart));
  const current = weekStart(now);
  const thisWeek = active.has(current);
  let week = thisWeek ? current : current - WEEK;
  let weeks = 0;
  let forgiven = false;
  for (let i = 0; i < 104; i++) {
    if (active.has(week)) { weeks++; week -= WEEK; continue; }
    // One gap is forgiven, but only inside a streak (a gap at the start isn't a streak yet), and only
    // if the week before it was active.
    if (!forgiven && weeks > 0 && active.has(week - WEEK)) { forgiven = true; week -= WEEK; continue; }
    break;
  }
  return { weeks, thisWeek, forgiven };
}
