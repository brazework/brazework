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
  js/messages.js         Conversations: list, thread, send, accept or decline requests, unread count
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
- `conversations`, `messages`: one conversation per pair of people. Between connections it's open right away; otherwise it's a request the other person accepts or declines, and the sender can send up to 3 messages until then. Only the two people can read it. Each conversation keeps a preview and when each person last read it.
- `org_interest`: company and school interest from the landing page (write-only from the site; read it in the Supabase dashboard under Table Editor).

## Known limits of this slice

- University email is checked by domain pattern only; a maintained school-domain list comes later.
- Author names on posts, and names on connections and follows, are copied when created; profile name changes don't update old ones yet.
- Feed loads the latest 60 posts. "For you" ranks them by recency with a boost for your interests.
- Auto-moderation (word filter, holding links from new members) runs in the app when someone posts. A person tampering with the app could skip it; moderators can still remove anything. Moving it into the database later makes it airtight.
- Communities can't be deleted or have ownership transferred yet. Invite-only communities, community events and a moderation log come later.
- Anyone who was declined can send a new request later; blocking comes later.
- Messages are one-to-one text only (no group chats, attachments, editing or deleting yet), and there are no email notifications for new messages.
- Supabase's built-in email sender only sends a few emails an hour; set up your own email sender before launch (SETUP.md, step 4).
