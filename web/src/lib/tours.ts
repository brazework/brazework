// Guided tours and Brazework updates, ported from public/js/tour.js and public/js/updates.js.
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
    id: "2026-11-09-news", date: "2026-11-09", kind: "New",
    title: "STEM news on your feed",
    summary: "Headlines from IEEE Spectrum, ScienceDaily, Nature, NASA and more, picked for your interests.",
    points: [
      "The Trending box on your feed now has a News tab. Flip between them any time; Brazework remembers the one you used last.",
      "Stories on your interests come first and say which interest they match, then stories in your field.",
      "Each headline opens the full story on the publisher's site.",
    ],
    tour: [
      { route: ROUTES.feed, target: "news", title: "STEM news for you", body: "Switch to News to see headlines from around the web on the topics you follow." },
    ],
  },
  {
    id: "2026-11-09-connectors", date: "2026-11-09", kind: "New",
    title: "Import projects from GitHub",
    summary: "Paste a repo link and Brazework fills in the project for you.",
    points: [
      "Adding a project? Paste a public GitHub repo link and Brazework fills in the title, summary, write-up, link and topics. Releases become milestones your club can verify.",
      "Copilot can read public GitHub repos and draft a project from one, for you to confirm.",
    ],
  },
  {
    id: "2026-11-09-feedback", date: "2026-11-09", kind: "New",
    title: "Tell us what to build",
    summary: "Send ideas, problems and praise straight to the Brazework team from Brazework updates.",
    points: [
      "Open the Feedback tab in Brazework updates, or the bottom of the full updates list.",
      "Similar ideas from different members are grouped together, so the most-requested ones rise to the top.",
      "Your name is only shared with the team if you say they can contact you.",
    ],
    tour: [
      { route: ROUTES.feed, target: "feedback-tab", title: "Tell us what to build", body: "Ideas, problems and praise go straight to the Brazework team. Similar ideas are grouped, so popular ones rise to the top." },
    ],
  },
  {
    id: "2026-11-09-milestones", date: "2026-11-09", kind: "New",
    title: "Club-verified milestones and your guide",
    summary: "Ask your club to vouch for what you built, and follow a short guide to a profile and club that get noticed.",
    points: [
      "On any of your projects, add a milestone (what happened, when, a link to the evidence) and ask one of your clubs to verify it.",
      "Club moderators, admins and owners review requests in the club's Manage → Verify tab, and can decline with a note.",
      "Verified milestones show on your project with your club's name, and count toward the Verified number on your profile.",
      "The guide button at the bottom right shows your next steps, a tip for the page you're on, and club setup steps for clubs you run.",
      "Club moderators and up get a This week tab under Manage: members, posts, events and milestones at a glance, and a weekly update you can post in one click.",
    ],
  },
  {
    id: "2026-11-08-search", date: "2026-11-08", kind: "New",
    title: "Search, a roomier layout and editable posts",
    summary: "Find people and communities from the search bar on every page, give the feed more room, and fix a post after you share it.",
    points: [
      "Search by name, field, headline or club from the bar at the top of every page. Press / to jump to it.",
      "Connect with people and join communities right from the results. People and clubs that share your interests come first.",
      "Collapse the sidebar to icons with the button next to the logo; the feed uses the extra width.",
      "Brazework updates now sit at the top right of your feed, with recent changes and what's coming next.",
      "Edit the text and topics of your own posts at any time. Edited posts say so.",
    ],
    tour: [
      { route: ROUTES.feed, target: "search", title: "Search Brazework", body: "Find people and communities by name, field or club. Connect or join right from the results." },
      { route: ROUTES.feed, target: "sidebar-toggle", title: "More room", body: "Collapse the sidebar to icons when you want more space. Brazework remembers your choice." },
      { route: ROUTES.feed, target: "updates-panel", title: "Brazework updates", body: "Recent changes and what's coming next. Click any item to read more." },
    ],
  },
  {
    id: "2026-11-08-redesign", date: "2026-11-08", kind: "Changed",
    title: "A rebuilt, faster Brazework",
    summary: "Every screen was rebuilt for speed, with new themes, a livelier feed and real links for every page.",
    points: [
      "Themes in Settings: Mono, Brazework Fire, Blueprint, Aurora and Emerald, each in light and dark.",
      "The feed adds events this week, project spotlights and builders to follow, plus a profile strength guide.",
      "On phones, a bottom tab bar keeps Feed, Clubs, Messages and Alerts one tap away.",
      "Old links and bookmarks still work.",
    ],
  },
  {
    id: "2026-11-08-media", date: "2026-11-08", kind: "New",
    title: "Photos and video",
    summary: "Show your work: up to 4 photos or 1 video per post, plus a profile photo, a cover banner and club covers.",
    points: [
      "Pin callouts on a photo, add alt text, or post two photos as a before and after slider.",
      "Videos play with speed control, looping, frame steps and timeline markers.",
      "Photos are resized and their location data removed before they're uploaded.",
    ],
  },
  {
    id: "2026-11-08-clubs", date: "2026-11-08", kind: "New",
    title: "Club events and invite links",
    summary: "Communities can host their own events and bring people in with invite links.",
    points: [
      "Club admins and owners host events from the club's Events tab. They also show under Events.",
      "Members-only clubs keep their events members-only.",
      "Invite links can expire, have a use limit and be turned off. Joining by link skips approval; bans still apply.",
    ],
  },
  {
    id: "2026-11-07-tour", date: "2026-11-07", kind: "New",
    title: "Guided tour and update notes",
    summary: "New members get a short tour of Brazework, and every update now opens to a quick summary like this one.",
    points: [
      "The tour runs once, the first time you sign in. Close it at any time, or go back a step without leaving it.",
      "Replay it whenever you like from Settings, under Help.",
      "Click any item in Brazework updates to read what changed.",
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
      "Only you can see your dashboard, and nobody can see who viewed a profile.",
    ],
    tour: [
      { route: ROUTES.feed, target: "bell", title: "Notifications", body: "Likes, comments, follows and requests show up here. The number shows what's new." },
      { route: ROUTES.profile, target: "analytics", title: "Your dashboard", body: "Profile views, likes, comments and followers over time. Only you can see this." },
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
    id: "next-copilot", kind: "Next",
    title: "Brazework Copilot",
    summary: "An assistant that turns rough notes into a post, drafts project write-ups and answers career questions for your field.",
  },
  {
    id: "next-projects", kind: "Next",
    title: "Project access requests, build logs and critiques",
    summary: "Ask to see a private project, follow a project's build log, and get structured critiques from people in your field.",
  },
  {
    id: "next-org-pages", kind: "Next",
    title: "Company and school pages",
    summary: "Public pages for verified organizations, with their events, open roles and more than one admin.",
  },
  {
    id: "next-notify", kind: "Next",
    title: "Email notifications and settings",
    summary: "Choose which notifications reach you by email, and turn off the kinds you don't want.",
  },
  {
    id: "next-messages", kind: "Next",
    title: "Group messages and attachments",
    summary: "Talk with several people at once and share files in messages.",
  },
];

// Updates that announce something (not previews of what's next).
export const RELEASED = UPDATES.filter((u) => u.kind !== "Next");

export function welcomeSteps(firstName: string): TourStep[] {
  return [
    { route: ROUTES.feed, title: `Welcome to Brazework, ${firstName || "there"}`, body: "Here's a one-minute look at the essentials. Close this at any time, or use Back to see a step again." },
    { route: ROUTES.feed, target: "feed-tabs", title: "Your feed", body: "Your clubs shows what your clubs are building. Everyone is ranked for your interests, with a note saying why. Latest and Following are under More." },
    { route: ROUTES.feed, target: "search", title: "Ask Ember, search, or jump anywhere", body: "One bar at the top of every page. Type a name, field or club to search and connect or join from the results, or ask Ember with ⌘K." },
    { route: ROUTES.feed, target: "composer", title: "Share your work", body: "Post an update, question, result or project. Add up to 3 topics so it reaches the people interested in them." },
    { route: ROUTES.feed, target: "interests", title: "Your focus areas", body: "Filter narrows the feed by kind of post or by one of your topics. Your interests decide what's in Everyone and which people and events we suggest; change them in Settings." },
    { route: ROUTES.feed, target: "menu", title: "Five places", body: "Today is what needs you. Build is what you're making. Club is your team. Proof is what you've proven and who looked. Inbox is who's reaching out. Settings are on your photo at the bottom." },
    { route: ROUTES.feed, target: "bell", title: "Notifications", body: "Likes, comments, new followers and connection requests show up here." },
    { route: ROUTES.projects, target: "projects-tab", title: "Your profile and projects", body: "Show what you've built. Projects can be public or private, and you can share them to the feed." },
    { route: ROUTES.profile, target: "analytics", title: "Your dashboard", body: "See how people find your profile and how your posts are doing over time. Only you can see it." },
    { route: ROUTES.feed, target: "updates-panel", title: "Brazework updates", body: "Recent changes and what's coming next. Click any update to read what changed. When a new feature ships, we'll show you around it." },
    { route: ROUTES.feed, title: "You're all set", body: "You can replay this tour any time from Settings, under Help." },
  ];
}

export function whatsNewSteps(list: ForgeUpdate[]): TourStep[] {
  return [
    {
      route: ROUTES.feed,
      title: "What's new on Brazework",
      body: list.length === 1 ? "One update since you were last here:" : `${list.length} updates since you were last here:`,
      list: list.map((u) => [u.title, u.summary]),
    },
    ...list.flatMap((u) => u.tour ?? []),
    { route: ROUTES.feed, target: "updates-panel", title: "That's what's new", body: "Read any update again by clicking it in Brazework updates, at the top right of your feed." },
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
