// "Your week": the nudge on Home. What happened in your clubs, what's waiting on you, and the one
// next step most worth taking. Only real counts, and nothing at all when there's nothing to say.
// Pure, so the choices are tested (tests/week.test.ts).

export type WeekInput = {
  clubPosts: number;
  verifiedInClubs: { club: string; n: number }[];
  myPending: number;
  toVerify: { clubId: string; n: number } | null;
  quietProject: { id: string; title: string; days: number } | null;
  nextEvent: { id: string; title: string; days: number } | null;
  hasClub: boolean;
  hasProject: boolean;
  // Who looked at your profile this week (weekly-loop.sql): verified companies by name, everyone counted.
  viewers?: { total: number; companies: string[] };
  // Whether you've ever asked your club to verify a milestone (any status).
  hasMilestone?: boolean;
};

export type WeekItem = { id: string; text: string; href: string; action?: string; tone: "news" | "todo" | "nudge" };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const when = (days: number) => (days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`);

export function buildWeek(w: WeekInput): WeekItem[] {
  const items: WeekItem[] = [];
  // Waiting on you first: other people are blocked on these.
  if (w.toVerify && w.toVerify.n > 0)
    items.push({ id: "verify", tone: "todo", text: `${plural(w.toVerify.n, "milestone")} waiting for you to verify`, href: `/c/${w.toVerify.clubId}/manage?tab=verify`, action: "Review" });
  if (w.nextEvent)
    items.push({ id: "event", tone: "todo", text: `You're going to ${w.nextEvent.title} ${when(w.nextEvent.days)}`, href: `/events/${w.nextEvent.id}` });
  // Who looked: the payoff for showing your work.
  if (w.viewers?.companies.length) {
    const [first, ...more] = w.viewers.companies;
    items.push({ id: "viewers", tone: "news", text: `${first}${more.length ? ` and ${plural(more.length, "more company", "more companies")}` : ""} viewed your profile`, href: "/dashboard", action: "See" });
  } else if (w.viewers && w.viewers.total > 0)
    items.push({ id: "viewers", tone: "news", text: `${plural(w.viewers.total, "person", "people")} viewed your profile this week`, href: "/dashboard" });
  if (w.myPending > 0)
    items.push({ id: "pending", tone: "news", text: `${plural(w.myPending, "milestone")} of yours waiting for your club`, href: "/projects" });
  // What happened.
  for (const v of w.verifiedInClubs.slice(0, 2))
    if (v.n > 0) items.push({ id: `verified-${v.club}`, tone: "news", text: `${plural(v.n, "milestone")} verified in ${v.club} this week`, href: "/communities" });
  if (w.clubPosts > 0) items.push({ id: "posts", tone: "news", text: `${plural(w.clubPosts, "new post")} in your clubs this week`, href: "/feed?tab=clubs" });
  // The one next step.
  if (!w.hasClub) items.push({ id: "join", tone: "nudge", text: "Join your club so its officers can verify your work", href: "/communities?tab=discover", action: "Find it" });
  else if (!w.hasProject) items.push({ id: "project", tone: "nudge", text: "Add what you're building: a robot, a rig, a model, an app", href: "/projects", action: "Add" });
  else if (w.quietProject && w.quietProject.days >= 7)
    items.push({ id: "quiet", tone: "nudge", text: `No update on ${w.quietProject.title} in ${w.quietProject.days} days`, href: `/feed?project=${w.quietProject.id}#composer`, action: "Post an update" });
  return items;
}

// This week's goal in the weekly loop (Linear FIX-67): the one action most worth taking, from the
// member's real state. Others waiting on you come first; then the steps that make your work
// verifiable; then keeping your streak. Done as soon as you've shown work this week.
export type WeekGoal = { id: string; text: string; href: string; action: string; done: boolean };

export function weekGoal(w: WeekInput, shownThisWeek: boolean): WeekGoal {
  if (w.toVerify && w.toVerify.n > 0)
    return { id: "verify", text: `Verify ${plural(w.toVerify.n, "milestone")} for your club`, href: `/c/${w.toVerify.clubId}/manage?tab=verify`, action: "Review", done: false };
  if (!w.hasClub) return { id: "join", text: "Join your club, so its officers can verify your work", href: "/communities?tab=discover", action: "Find it", done: false };
  if (!w.hasProject) return { id: "project", text: "Add what you're building", href: "/projects", action: "Add", done: false };
  if (!w.hasMilestone) return { id: "ask", text: "Ask your club to verify your first milestone", href: "/projects", action: "Ask", done: false };
  if (shownThisWeek) return { id: "done", text: "You've shown your work this week", href: "/profile", action: "", done: true };
  if (w.quietProject) return { id: "update", text: `Post an update on ${w.quietProject.title}`, href: `/feed?project=${w.quietProject.id}#composer`, action: "Post", done: false };
  return { id: "share", text: "Share what you built this week", href: "/feed#composer", action: "Post", done: false };
}
