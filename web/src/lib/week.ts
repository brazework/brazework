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
