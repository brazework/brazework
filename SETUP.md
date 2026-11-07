# Putting Forge online with Vercel and Supabase

Forge's code lives on GitHub. Vercel puts it online and redeploys automatically every time a change is pushed. Supabase holds the accounts and the database.

---

## Step 1: Put the site on Vercel

1. Go to **https://vercel.com/new** and sign in with GitHub.
2. Find the `forge-app` repository and click **Import**, then **Deploy**. Leave the settings as they are; `vercel.json` already says how to build it.

## Step 2: Add the database

1. In your Vercel project, open the **Storage** tab and click **Create Database**.
2. Choose **Supabase**, accept the terms, pick the free plan and a region close to your users.
3. Connect it to the `forge-app` project. Vercel adds the Supabase settings (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and others) to the project for you.

## Step 3: Create Forge's tables

1. Open your Supabase project (Vercel's Storage tab has an **Open in Supabase** button).
2. Go to **SQL Editor**, click **New query**, paste everything from `supabase/schema.sql`, and click **Run**. It should say "Success. No rows returned."
3. Do the same with `supabase/messages.sql`, then `supabase/events.sql`.
4. To post Forge's own events, open **Table Editor → organization_admins** and add a row with the `Forge` organization's id and your user id.

> The anon key is safe to have in a website. What protects your data is row-level security in `supabase/schema.sql`.

## Step 4: Set up sign-in emails

In Supabase, open **Authentication**:

1. **URL Configuration:** set **Site URL** to your live address (for example `https://forge-app.vercel.app`) and add `https://forge-app.vercel.app/**` under **Redirect URLs**. Without this, the links in sign-up and password reset emails point to the wrong place.
2. **Sign In / Providers → Email:** keep **Confirm email** on.
3. **Emails → SMTP Settings:** Supabase's built-in sender only sends a few emails an hour, and only to your own team's addresses. Before real people sign up, connect an email service (Resend, Postmark, SendGrid or similar; most have a free tier) here.
4. Optional: in **Emails → Templates**, change the wording of the confirmation and reset emails.

## Step 5: Redeploy and test

In Vercel, open **Deployments**, click **⋮** on the newest one and choose **Redeploy**, so the site picks up the Supabase settings. Then try this checklist on your live site:

- [ ] Sign up as a professional with your own email
- [ ] Find the verification email (check spam) and click the link; you come back signed in
- [ ] Pick your major or profession, field and at least 3 interests
- [ ] Post something on the feed with a topic; like it, comment on it and save it
- [ ] Post from your profile page; open Saved from the menu
- [ ] Create a community, post in it, and check the Communities tab on your feed
- [ ] From your second account, join (or request to join) the community; approve the request from **Manage**, then make that account a Moderator
- [ ] From your second account, open your main profile and click **Connect**; on your main account, accept it under **Network**, then check the **Following** tab on your feed
- [ ] Open your second account's profile and click **Message**; reply from the second account and watch the unread badge next to Messages
- [ ] From an account you're not connected with, send a message; it shows under **Requests**, and the sender can't send a second one until you accept
- [ ] From another account you're not connected with, send a request, then choose **Block & report**; that account can't message you again until you unblock it in **Settings**
- [ ] In **Settings → Messaging**, choose **Connections only**, then try messaging that account from one you're not connected with; it's refused
- [ ] Turn **Message requests** off; the Requests tab goes away and requests show in your Inbox marked "Not connected"
- [ ] As a Forge admin, open **Your organization** from the menu and add an event; it shows under **Events**
- [ ] From another account, RSVP and bookmark that event, then check **Saved events** and **Add to calendar**
- [ ] Sign up with a work email, register your company, and add an event; a personal email can't register one
- [ ] Edit your headline and bio on your profile
- [ ] Log out, click **Forgot password?**, follow the email link and choose a new password
- [ ] In Settings, switch between Dark, Light and Match device
- [ ] Open the side menu and pick an item; it should close on its own
- [ ] Log out and log back in; you should see the welcome screen

## Optional: run it on your computer

1. Copy `public/js/supabase-config.example.js` to `public/js/supabase-config.js` and fill in your Supabase URL and anon key (Supabase dashboard → **Project Settings → API**).
2. From this folder, run `npx serve public` and open the address it prints. It uses your real Supabase project, so accounts and posts you make here are real. Add that local address to **Redirect URLs** (step 4) so email links work.

---

## What's in this first version

| Built and working | Coming next (designed in the prototype) |
| --- | --- |
| Landing page | Company and school pages, more organization admins |
| Sign-up (student or professional, 18+, university email check) | Group messages, attachments |
| Email verification and log-in, password reset | Projects with build logs and critiques |
| Interests and field (onboarding) | Community events, invite-only communities |
| Network: connections, requests with notes, following, People you may know | |
| Messages: one-to-one, live, with Inbox, Unread and Requests; one message until accepted, block and report, and settings for who can message you | Message spam filter |
| Events: matched to your interests, filters, RSVP, saved events, add to calendar; leave the tab 24 hours after they end | |
| Organizations: companies and schools verified by work email, hosting events with a past-events log | |
| Feed with live posts, likes, comments, topics and saving; For you, Latest, Following and Communities tabs | |
| Profiles with posts, posting, headline, bio, connect and follow | Saved folders and saved events |
| Communities: discover, create, join or request, roles, moderation, auto-moderation | Organizations (companies and schools), admin console |
| Settings: theme, accent, text size, reduce motion, messaging, blocked people, interests | |
| Side menu, page transitions, light and dark themes | Analytics, marketplace and NDA process (stay off until launch) |

## If something goes wrong

- **The site says "Almost there: connect Supabase."** The Supabase settings aren't in the Vercel project yet. Redo step 2, then redeploy (step 5).
- **"You don't have permission to do that," or pages stay empty.** The tables weren't created. Redo step 3.
- **Email links open localhost or say they're invalid.** Redo step 4.1.
- **No verification email.** Check spam, then use **Resend link**. If it never arrives, set up your own email sender (step 4.3).
- **Anything else:** copy the exact message from the page and send it to me.

## Updates and undo

Every change pushed to GitHub's `main` branch goes live on its own within a minute or two. If an update breaks something, open **Deployments** in Vercel, click **⋮** on the last good one and choose **Promote to Production** (it's instant), then tell me what went wrong.
