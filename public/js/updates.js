// Forge updates: the list in the feed's briefing, the notes you read when you click one,
// and the short walkthrough members get the first time they sign in after it ships.
//
// To announce a new feature: add an entry at the TOP with a new, never-reused id.
// - title, summary and points are what the update note shows.
// - tour (optional) is a list of steps for the "What's new" walkthrough. Each step can have
//   route (a page, e.g. "feed" or "profile/projects"), target (a [data-tour] name on that page),
//   title and body. Members who joined after the update don't get its walkthrough; the
//   first-time tour already covers what's there.
// - kind "Next" is a preview of what's coming; it has no walkthrough and isn't counted as new.

export const UPDATES = [
  {
    id: "2026-11-07-tour", date: "2026-11-07", kind: "New",
    title: "Guided tour and update notes",
    summary: "New members get a short tour of Forge, and every update now opens to a quick summary like this one.",
    points: [
      "The tour runs once, the first time you sign in. Close it at any time, or go back a step without leaving it.",
      "Replay it whenever you like from Settings, under Help.",
      "Click any item in Forge updates to read what changed.",
      "When a new feature ships, you get a short walkthrough of it the next time you sign in. You can close that at any time too."
    ]
  },
  {
    id: "2026-11-07-projects", date: "2026-11-07", kind: "New",
    title: "Projects on your profile",
    summary: "Show what you've built. Each project has a summary everyone can see and a full write-up you can keep private.",
    points: [
      "Add a project from the Projects tab on your profile: title, summary, status, up to 3 topics, a write-up and a link.",
      "Private projects show only the title, summary and topics. Requests to see the rest are coming soon.",
      "Share a project to the feed when you add it, and use Post an update to share progress later.",
      "Project posts reach For you for people interested in the project's topics."
    ],
    tour: [
      { route: "profile/projects", target: "projects-tab", title: "Projects", body: "Your projects live on your profile. Add one with New project, and choose whether it's public or private." },
      { route: "profile/projects", target: "projects-new", title: "Share it", body: "Keep \"Share it to the feed\" on and people interested in its topics see it in For you. Post an update from the project as it moves along." }
    ]
  },
  {
    id: "2026-11-07-foryou", date: "2026-11-07", kind: "Changed",
    title: "A focused For you feed",
    summary: "For you now shows only posts that match your interests, so it stays relevant.",
    points: [
      "A post shows in For you when it's tagged with at least one of your interests. Your own posts show too.",
      "Each post says which of your interests it matches.",
      "Latest still shows every post, and Following shows people you follow.",
      "Change your interests in Settings to change what you see."
    ],
    tour: [
      { route: "feed", target: "feed-tabs", title: "For you, focused", body: "For you only shows posts tagged with your interests. Switch to Latest to see everything." },
      { route: "feed", target: "interests", title: "Tune it", body: "These are your interests. Tag your own posts with topics so they reach the right people too." }
    ]
  },
  {
    id: "2026-11-07-notifications", date: "2026-11-07", kind: "New",
    title: "Notifications and Analytics",
    summary: "See who liked, commented, followed or wants to connect, and how your profile and posts are doing.",
    points: [
      "The bell in the top bar shows how many notifications are new. Each one links to what it's about.",
      "Analytics, from your profile, shows profile views over 7, 30 and 90 days or 12 months, plus likes, comments, followers and connections.",
      "Only you can see your analytics, and nobody can see who viewed a profile."
    ],
    tour: [
      { route: "feed", target: "bell", title: "Notifications", body: "Likes, comments, follows and requests show up here. The number shows what's new." },
      { route: "profile", target: "analytics", title: "Your analytics", body: "Profile views and engagement on your posts. Only you can see this." }
    ]
  },
  {
    id: "2026-11-07-events", date: "2026-11-07", kind: "New",
    title: "Events",
    summary: "Career fairs, workshops and talks picked for your interests. Companies and schools can host their own.",
    points: [
      "Upcoming for you shows events on your interests; All events shows everything.",
      "RSVP, save events for later, and add them to your calendar.",
      "Events leave the list 24 hours after they end. Organizations keep a log of their past events."
    ]
  },
  {
    id: "2026-11-07-messages", date: "2026-11-07", kind: "New",
    title: "Messages",
    summary: "Talk one-to-one with your connections. Messages from anyone else arrive as requests.",
    points: [
      "Inbox, Unread and Requests tabs keep conversations sorted.",
      "Someone you're not connected with can send one message until you accept.",
      "Block and report from any request, and choose who can message you in Settings."
    ]
  },
  {
    id: "2026-10-17-network", date: "2026-10-17", kind: "New",
    title: "Network and Communities",
    summary: "Connect with people, follow them, and join groups in your field.",
    points: [
      "Send connection requests with a note, accept or ignore invitations, and follow people to see their posts in Following.",
      "Join communities, ask to join private ones, or start your own and pick moderators."
    ]
  },
  {
    id: "next-projects", kind: "Next",
    title: "Project access requests, build logs and critiques",
    summary: "Coming next: ask to see a private project, follow a project's build log, and get structured critiques from people in your field."
  }
];

// Updates that announce something (not previews of what's next).
export const RELEASED = UPDATES.filter(u => u.kind !== "Next");
