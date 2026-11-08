// Guided tours and Forge updates, ported from public/js/tour.js and public/js/updates.js.
// Which tours someone has finished or closed lives in public.seen_tours (supabase/tours.sql).
//
// To announce a new feature: add an entry at the TOP of UPDATES with a new, never-reused id.
// - title, summary and points are what the update note shows.
// - tour (optional) is a list of steps for the "What's new" walkthrough. Each step can have
//   route (a path, optionally with ?query, e.g. "/feed" or "/profile?tab=projects"), target
//   (a [data-tour] name on that page), title and body. Members who joined after the update
//   don't get its walkthrough; the first-time tour already covers what's there.
// - kind "Next" is a preview of what's coming; it has no walkthrough and isn't counted as new.

export type TourStep = {
  route?: string;
  target?: string;
  title: string;
  body: string;
  list?: [title: string, detail: string][];
};

export type ForgeUpdate = {
  id: string;
  date?: string;
  kind: "New" | "Changed" | "Next";
  title: string;
  summary: string;
  points?: string[];
  tour?: TourStep[];
};

export const WELCOME = "welcome";

// Where the vanilla tour's hash routes live in the Next.js app.
// Profiles live at /u/<id>; "/u/" matches your own once /profile has redirected there.
export const ROUTES = {
  feed: "/feed",
  profile: "/u/",
  projects: "/u/",
} as const;

export const UPDATES: ForgeUpdate[] = [
  {
    id: "2026-11-07-tour", date: "2026-11-07", kind: "New",
    title: "Guided tour and update notes",
    summary: "New members get a short tour of Forge, and every update now opens to a quick summary like this one.",
    points: [
      "The tour runs once, the first time you sign in. Close it at any time, or go back a step without leaving it.",
      "Replay it whenever you like from Settings, under Help.",
      "Click any item in Forge updates to read what changed.",
      "When a new feature ships, you get a short walkthrough of it the next time you sign in. You can close that at any time too.",
    ],
  },
  {
    id: "2026-11-07-projects", date: "2026-11-07", kind: "New",
    title: "Projects on your profile",
    summary: "Show what you've built. Each project has a summary everyone can see and a full write-up you can keep private.",
    points: [
      "Add a project from the Projects tab on your profile: title, summary, status, up to 3 topics, a write-up and a link.",
      "Private projects show only the title, summary and topics. Requests to see the rest are coming soon.",
      "Share a project to the feed when you add it, and use Post an update to share progress later.",
      "Project posts reach For you for people interested in the project's topics.",
    ],
    tour: [
      { route: ROUTES.projects, target: "projects-tab", title: "Projects", body: "Your projects live on your profile. Add one with New project, and choose whether it's public or private." },
      { route: ROUTES.projects, target: "projects-new", title: "Share it", body: "Keep \"Share it to the feed\" on and people interested in its topics see it in For you. Post an update from the project as it moves along." },
    ],
  },
  {
    id: "2026-11-07-foryou", date: "2026-11-07", kind: "Changed",
    title: "A focused For you feed",
    summary: "For you now shows only posts that match your interests, so it stays relevant.",
    points: [
      "A post shows in For you when it's tagged with at least one of your interests. Your own posts show too.",
      "Each post says which of your interests it matches.",
      "Latest still shows every post, and Following shows people you follow.",
      "Change your interests in Settings to change what you see.",
    ],
    tour: [
      { route: ROUTES.feed, target: "feed-tabs", title: "For you, focused", body: "For you only shows posts tagged with your interests. Switch to Latest to see everything." },
      { route: ROUTES.feed, target: "interests", title: "Tune it", body: "These are your interests. Tag your own posts with topics so they reach the right people too." },
    ],
  },
  {
    id: "2026-11-07-notifications", date: "2026-11-07", kind: "New",
    title: "Notifications and Analytics",
    summary: "See who liked, commented, followed or wants to connect, and how your profile and posts are doing.",
    points: [
      "The bell in the top bar shows how many notifications are new. Each one links to what it's about.",
      "Analytics, from your profile, shows profile views over 7, 30 and 90 days or 12 months, plus likes, comments, followers and connections.",
      "Only you can see your analytics, and nobody can see who viewed a profile.",
    ],
    tour: [
      { route: ROUTES.feed, target: "bell", title: "Notifications", body: "Likes, comments, follows and requests show up here. The number shows what's new." },
      { route: ROUTES.profile, target: "analytics", title: "Your analytics", body: "Profile views and engagement on your posts. Only you can see this." },
    ],
  },
  {
    id: "2026-11-07-events", date: "2026-11-07", kind: "New",
    title: "Events",
    summary: "Career fairs, workshops and talks picked for your interests. Companies and schools can host their own.",
    points: [
      "Upcoming for you shows events on your interests; All events shows everything.",
      "RSVP, save events for later, and add them to your calendar.",
      "Events leave the list 24 hours after they end. Organizations keep a log of their past events.",
    ],
  },
  {
    id: "2026-11-07-messages", date: "2026-11-07", kind: "New",
    title: "Messages",
    summary: "Talk one-to-one with your connections. Messages from anyone else arrive as requests.",
    points: [
      "Inbox, Unread and Requests tabs keep conversations sorted.",
      "Someone you're not connected with can send one message until you accept.",
      "Block and report from any request, and choose who can message you in Settings.",
    ],
  },
  {
    id: "2026-10-17-network", date: "2026-10-17", kind: "New",
    title: "Network and Communities",
    summary: "Connect with people, follow them, and join groups in your field.",
    points: [
      "Send connection requests with a note, accept or ignore invitations, and follow people to see their posts in Following.",
      "Join communities, ask to join private ones, or start your own and pick moderators.",
    ],
  },
  {
    id: "next-projects", kind: "Next",
    title: "Project access requests, build logs and critiques",
    summary: "Coming next: ask to see a private project, follow a project's build log, and get structured critiques from people in your field.",
  },
];

// Updates that announce something (not previews of what's next).
export const RELEASED = UPDATES.filter((u) => u.kind !== "Next");

export function welcomeSteps(firstName: string): TourStep[] {
  return [
    { route: ROUTES.feed, title: `Welcome to Forge, ${firstName || "there"}`, body: "Here's a one-minute look at the essentials. Close this at any time, or use Back to see a step again." },
    { route: ROUTES.feed, target: "feed-tabs", title: "Your feed", body: "For you only shows posts that match your interests, with a note saying why. Latest has every post, Following has the people you follow, and Communities has your groups." },
    { route: ROUTES.feed, target: "composer", title: "Share your work", body: "Post an update, question, result or project. Add up to 3 topics so it reaches the people interested in them." },
    { route: ROUTES.feed, target: "interests", title: "Your focus areas", body: "Your interests decide what's in For you and which people and events we suggest. Click one to filter the feed, or change them in Settings." },
    { route: ROUTES.feed, target: "menu", title: "Everything else", body: "The menu has every page: Network, Communities, Messages, Events, Saved and Settings." },
    { route: ROUTES.feed, target: "bell", title: "Notifications", body: "Likes, comments, new followers and connection requests show up here." },
    { route: ROUTES.projects, target: "projects-tab", title: "Your profile and projects", body: "Show what you've built. Projects can be public or private, and you can share them to the feed." },
    { route: ROUTES.profile, target: "analytics", title: "Your analytics", body: "See how people find your profile and how your posts are doing. Only you can see it." },
    { route: ROUTES.feed, target: "updates", title: "Forge updates", body: "Click any update to read what changed. When a new feature ships, we'll show you around it." },
    { route: ROUTES.feed, title: "You're all set", body: "You can replay this tour any time from Settings, under Help." },
  ];
}

export function whatsNewSteps(list: ForgeUpdate[]): TourStep[] {
  return [
    {
      route: ROUTES.feed,
      title: "What's new on Forge",
      body: list.length === 1 ? "One update since you were last here:" : `${list.length} updates since you were last here:`,
      list: list.map((u) => [u.title, u.summary]),
    },
    ...list.flatMap((u) => u.tour ?? []),
    { route: ROUTES.feed, target: "updates", title: "That's what's new", body: "Read any update again by clicking it in Forge updates." },
  ];
}

// Midnight (local) on the day someone joined: updates from that day on still count as new to them.
function joinedDay(createdAt: string) {
  const t = Date.parse(createdAt);
  return Number.isNaN(t) ? 0 : new Date(new Date(t).toDateString()).getTime();
}

// Released updates this person hasn't seen and that shipped on or after the day they joined.
export function freshUpdates(seen: Set<string>, createdAt: string) {
  const since = joinedDay(createdAt);
  return RELEASED.filter((u) => !seen.has(u.id) && (!u.date || Date.parse(`${u.date}T00:00:00`) >= since));
}

export function updateDate(u: ForgeUpdate) {
  return u.date
    ? new Date(`${u.date}T00:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "Coming soon";
}

// Is the browser on a step's route? Path prefix plus every query parameter the route names.
export function onRoute(route: string, pathname: string, search: URLSearchParams) {
  const [path, query = ""] = route.split("?");
  if (!pathname.startsWith(path)) return false;
  for (const [k, v] of new URLSearchParams(query)) if (search.get(k) !== v) return false;
  return true;
}
