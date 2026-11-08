# Forge data model

Every table, who can read and change it, and the known limits of the current slice. The SQL files in `supabase/` are the source of truth; row-level security there is what protects the data.

## Tables

The database fills in names, counts and times itself, so the app can't fake them. See `supabase/schema.sql` for exactly who can read and change what.

- `profiles`: one per account (id = the Supabase user). first_name, last_name, birthday (private), account_type, headline, bio, field, interests[], onboarded. Made automatically at sign-up.
- `posts`: author, body, kind (update, question, result, project), tags[] (up to 3), like_count, comment_count. `community_id` is empty for the main feed; community posts also have status (visible, held). `project_id` marks a post about one of the author's projects.
- `seen_tours`: user_id, key ("welcome" or an update's id). Private to each member.
- `projects`: owner, title, summary, status (in progress, completed), year, tags[] (up to 3), private. `project_details`: the write-up and link, readable by others only while the project is public.
- `likes`, `comments`, `saved`: one like per member per post; comments up to 1000 characters; saves are private. Deleting a post removes all three.
- `connections`: from_id, to_id, status (pending, accepted), note, people (name and headline of both). Only one per pair of people.
- `follows`: follower, target, plus their names.
- `communities`, `community_members` (role: owner, admin, moderator, helper, member), `community_requests`, `community_bans`.
- `conversations`, `messages`: one conversation per pair of people. Between connections it's open right away; otherwise it's a request with one message, which the other person accepts, declines, or blocks and reports. Only the two people can read it. Each conversation keeps a preview.
- `conversation_reads`: when each person last read a conversation. Kept apart from the conversation and visible only to that person, so nobody can tell when you've read their message.
- `message_settings`: whether requests wait in a separate tab, and who can send you one (anyone, connections plus people in your communities, or connections only). The database enforces who can send. Visible only to you.
- `message_blocks`: who you've blocked. Neither of you can message the other. The blocked person can't see the block, and you can undo it in Settings.
- `message_reports`: created by Block & report, with a copy of the messages. Can't be read from the site; review them in the Supabase dashboard under Table Editor.
- `organizations`, `organization_admins`: companies and schools, verified when the registering account's confirmed email matches the website's domain (personal providers are rejected). The `forge` organization posts Forge's own events; add its admins in the dashboard.
- `events`, `event_rsvps`, `event_saves`: hosted by an organization. Events are never deleted. Row-level security hides them from members 24 hours after they end, and from then on only the host's admins can see them, which is the past-events log. Ended events can't be edited.
- `notifications`: written only by the database when someone likes or comments on your post, follows you, sends or accepts a connection request, asks to join a community you help run, or approves your request. Unliking, unfollowing or withdrawing removes it again. Nothing is sent about your own actions or by people you've blocked. Only you can read, mark read or clear yours.
- `profile_views`: one row per viewer, per profile, per day (your own visits don't count). Nobody can read it from the site; `my_analytics()` gives the owner totals only, and the viewer breakdown appears only once at least 3 different people have viewed you.
- `org_interest`: company and school interest from the landing page (write-only from the site; read it in the Supabase dashboard under Table Editor).

## Known limits of this slice

- University email is checked by domain pattern only; a maintained school-domain list comes later.
- Author names on posts, and names on connections and follows, are copied when created; profile name changes don't update old ones yet.
- "For you" shows only posts tagged with at least one of your interests (the latest 60), plus your own, ranked by recency with a boost for each matching topic. Untagged posts and posts on other topics only appear in Latest and Following. Latest shows the newest 60 posts.
- Projects: a private project's title, summary and topics are visible to every member; the write-up and link are hidden from others. Requests to see a private project, build logs and critiques come later. Project posts take the project's topics, so they reach For you for people interested in them.
- Auto-moderation (word filter, holding links from new members) runs in the app when someone posts. A person tampering with the app could skip it; moderators can still remove anything. Moving it into the database later makes it airtight.
- Communities can't be deleted or have ownership transferred yet. Invite-only communities, community events and a moderation log come later.
- Anyone who was declined can send a new request later; blocking them stops that. Blocking only covers messages: a blocked person can still see your profile and send a connection request.
- Messages are one-to-one text only (no group chats, attachments, editing or deleting yet), and there are no email notifications for new messages. Attachments wait on choosing file storage, and the spam filter's hidden folder waits on choosing a spam detection service.
- There's no admin screen for message reports yet, so nobody is alerted when one comes in; check the `message_reports` table.
- Read status is never shown to anyone, even after a request is accepted.
- Organizations have one admin (the person who registered) and no public page yet; adding colleagues as admins and the company page come later. Their name isn't checked, only their email domain, and unlisted schools aren't reviewed yet: a school needs an academic domain.
- Events have one topic each and no reminders. Communities can't host events yet.
- The first-time tour runs once per account, the first time the feed opens; closing it counts as done. Replay it from Settings → Help.
- To announce a feature: add an entry at the top of `public/js/updates.js` with a new id, a summary and points, and optionally `tour` steps that point at `data-tour="…"` names on the page. Members who joined before it get a short What's new walkthrough on their next visit; everyone can read the note by clicking it under Forge updates.
- Notifications appear in the app only; there are no emails or phone push notifications yet, and no settings to turn kinds off.
- Analytics counts profile views and engagement on your posts. Project views, search appearances and access requests from the prototype wait on those features. Career progression only shows when you joined until profiles have experience and education, and the career benchmark waits on deciding how skill levels are measured. Company analytics wait on the company page.
- Supabase's built-in email sender only sends a few emails an hour; set up your own email sender before launch (SETUP.md, step 4).

## Club events (`supabase/club-events.sql`)

- `events.community_id`: an event is hosted by exactly one of an organization (`org_id`) or a community (`community_id`).
- Community admins and owners (`can_host_community_events()`, rank 4+) create and edit their club's events. Members of approval-required communities are the only ones who see that club's events; public clubs' events are visible to everyone.

## Invite links (`supabase/invites.sql`)

- `community_invites`: code (16 random hex characters), community, who made it, optional expiry and use limit, uses so far, revoked. Only the club's helpers and above can see, create or turn off its links.
- `invite_preview(code)`: the club's name, field, size and description for the `/join/<code>` page; works signed out. Nothing comes back for a bad, expired, used-up or revoked code.
- `accept_invite(code)`: joins the club directly (skipping approval), unless you're banned; joining twice doesn't use up the link.
