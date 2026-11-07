# Forge (web app, first release slice)

Plain HTML, CSS and JavaScript modules served by Vercel, with Supabase for sign-in (Supabase Auth), the database (Postgres) and live updates (Supabase Realtime). There's no bundler; the Supabase client (v2.45.4) is imported from a CDN. The only build step writes `public/js/supabase-config.js` from Vercel's environment variables.

- **Set up and deploy:** see [SETUP.md](SETUP.md).
- **Design source of truth:** the Forge prototype canvas and the Forge Build Brief.

## Structure

```
vercel.json              Static site from public/, build step, cache headers
scripts/build-config.mjs Writes public/js/supabase-config.js from Vercel's Supabase variables
supabase/schema.sql      Tables, row-level security (who can do what), triggers and live-update setup
supabase/messages.sql    Conversations and messages (run after schema.sql)
supabase/events.sql      Organizations and events (run after schema.sql)
public/
  index.html             Applies saved theme before first paint
  css/tokens.css         Dark and light color tokens (use these, never fixed colors)
  css/app.css            Shared components, shell, motion (respects reduce motion)
  js/supabase.js         Supabase setup, query helpers, live() for real-time lists
  js/app.js              Auth state, route guard (sign-in > verify > onboarding > app), transitions
  js/shell.js            Top bar and side menu
  js/theme.js            Appearance settings
  js/posts.js            Composer, post card, live post list, likes, comments, saves, delete
  js/communities.js      Community roles and permissions, joining, requests, moderation, auto-moderation
  js/network.js          Connections (requests, accept, remove), follows, people suggestions
  js/messages.js         Conversations: list, thread, send, accept, decline, block and report, unread count, settings
  js/events.js           Events, RSVPs, saved events, organizations, calendar files
  js/util.js             Helpers, icons, error messages, starter topic list
  js/views/*.js          One file per page (reset.js: choose a new password from a reset link)
```

## Data (Postgres tables)

The database fills in names, counts and times itself, so the app can't fake them. See `supabase/schema.sql` for exactly who can read and change what.

- `profiles`: one per account (id = the Supabase user). first_name, last_name, birthday (private), account_type, headline, bio, field, interests[], onboarded. Made automatically at sign-up.
- `posts`: author, body, kind (update, question, result, project), tags[] (up to 3), like_count, comment_count. `community_id` is empty for the main feed; community posts also have status (visible, held).
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
- `org_interest`: company and school interest from the landing page (write-only from the site; read it in the Supabase dashboard under Table Editor).

## Known limits of this slice

- University email is checked by domain pattern only; a maintained school-domain list comes later.
- Author names on posts, and names on connections and follows, are copied when created; profile name changes don't update old ones yet.
- Feed loads the latest 60 posts. "For you" ranks them by recency with a boost for your interests.
- Auto-moderation (word filter, holding links from new members) runs in the app when someone posts. A person tampering with the app could skip it; moderators can still remove anything. Moving it into the database later makes it airtight.
- Communities can't be deleted or have ownership transferred yet. Invite-only communities, community events and a moderation log come later.
- Anyone who was declined can send a new request later; blocking them stops that. Blocking only covers messages: a blocked person can still see your profile and send a connection request.
- Messages are one-to-one text only (no group chats, attachments, editing or deleting yet), and there are no email notifications for new messages. Attachments wait on choosing file storage, and the spam filter's hidden folder waits on choosing a spam detection service.
- There's no admin screen for message reports yet, so nobody is alerted when one comes in; check the `message_reports` table.
- Read status is never shown to anyone, even after a request is accepted.
- Organizations have one admin (the person who registered) and no public page yet; adding colleagues as admins and the company page come later. Their name isn't checked, only their email domain, and unlisted schools aren't reviewed yet: a school needs an academic domain.
- Events have one topic each and no reminders. Communities can't host events yet.
- Supabase's built-in email sender only sends a few emails an hour; set up your own email sender before launch (SETUP.md, step 4).
