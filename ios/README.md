# Brazework for iPhone

Native SwiftUI app on the same Supabase backend as `web/`: same tables, same row-level security, same feed ranking (`FeedRank.swift` is a port of `web/src/lib/feed-rank.ts`, with tests that pin the numbers).

Members see Brazework everywhere (the home-screen name, sign-up, copy). The code keeps its older Forge names (`ForgeKit`, the `Forge` scheme, `FORGE_*` settings), as the web keeps `/feed` and `forge.test`. The bundle id is `com.brazework.app` (it was `com.shualabs.forge` until the first TestFlight build); it is now permanent, since changing it would make it a different app in the App Store.

`ForgeKit/` is the data layer (models, ranking, every read and write in `API.swift`, the feed and inbox stores). The app compiles those sources directly; `swift test` runs them on the Mac against the local stack. `Forge/` is the SwiftUI app.

## The five places (redesign, November 2026)

The tab bar matches the web app's five places (`web/src/lib/places.ts`): **Home** (the feed, led by the one next step on your newest project; alerts are the bell at the top), **Projects** (what you're making: where each project stands, built then signed, and one next step), **Clubs**, **Record** (your signed work first, then your profile and settings) and **Inbox** (messages). Projects and Record read projects and milestones (`ForgeKit/Builds.swift`); starting a project and asking for a signature open the web for now. In code the tabs keep their older names (`AppTab.feed`, `.build`, `.clubs`, `.me`, `.messages`) so `FORGE_TEST_TAB` and links don't change.

The table below describes the screens behind those tabs (it predates the rename: Feed is Home, You is Record, Messages is Inbox, and Alerts is the bell on Home).

## What's in it

| Tab | |
|---|---|
| **Feed** | A composer prompt with one-tap Photo / Question / Result; your **messages inline** in a collapsible card (unread first, tap through, remembers open or closed); For you (ranked, with reasons; your new post first), Latest and Following, filtered by Questions, Results, Projects or Photos & video; infinite scroll and a "new posts" pill; upcoming events, people to follow and clubs to join between posts. Posts: double-tap to like, long-press for save/share/copy/edit/delete, the latest replies inline, @mentions, edit or delete your own. Videos play as you scroll with sound (following the ringer switch), one at a time; tap to pause, then speed and fullscreen |
| **Settings & safety** | Message requests and who can message you, blocked people, video sound, change password, send feedback. Report any post, reply, person or message; block someone from their profile or a post (no messages, no follows, their posts hidden). Needs `supabase/reports.sql` |
| **Search** | People, clubs, events and posts in one search; people who share your interests first |
| **Clubs** | Your clubs and discover, search, a club's page with its posts, join or ask to join. **Events**: upcoming club and organization events, a map of the place with directions, I'm going, join online |
| **Profiles** | Anyone's profile from a post, reply, alert or thread: headline, field, interests, posts; follow and message them |
| **Messages** | Club, event and team chats (start a team chat from a club with the people you pick; add clubmates, leave) (officers post announcements; Ember's answers show as Ember's), plus direct messages with requests, accept or decline. Long-press any message to react (8 emoji), reply with a quote, copy, or unsend your own (direct messages within 15 minutes). Threads update live (Realtime, with polling as a fallback). Open a club's chat from its page, an event's from its page once you're going |
| **Alerts** | Likes, replies, mentions, follows, club and milestone news; marked read once seen; tap to open the post or person |
| **You** | Edit your profile (photo, name, headline, field, about, interests; the web's rules), your saved posts, light/dark and the web's five themes, links to settings and Ember on the web, sign out |

Sign-up (student or professional; personal, work, or school email; 18+), email confirmation, password reset and onboarding (major, field, 3+ interests) are native. So is Ember (`Features/Ember`), on the same `/api/copilot` as the web.

## Build and run

Needs Xcode 27 (`/Applications/Xcode-beta.app`; devices on iOS 27 need it), [xcodegen](https://github.com/yonaskolb/XcodeGen) and Docker.

```sh
cd web && e2e/local-supabase.sh up && cd ../ios   # local Supabase with the e2e seed data
scripts/use-local.sh                               # Config/Local.xcconfig → the local stack
xcodegen generate && open Forge.xcodeproj          # run the Forge scheme on an iPhone simulator
```

Log in as `josh@forge.test` / `forge-test-pass-1` (or `maya`, `ben`, `cara`).

The app connects to whatever `Config/Local.xcconfig` names (gitignored). It defaults to the local stack so development never writes to production. To point at another project, set `FORGE_SUPABASE_URL` (write `https:/$()/…`, since `//` starts a comment in xcconfig) and `FORGE_SUPABASE_ANON_KEY` there.

## Tests

```sh
scripts/test-kit.sh   # on the Mac, no simulator: ranking and dates, plus the app's real reads and writes against the
                      # local stack (sign-up rules and onboarding; team chats and who can read them; settings, reports and blocking, password change, feedback; edit your profile and photo, and the web's validation; saved posts; edit/delete your own posts and not others'; @mention → they're notified, fake mentions dropped; photo upload → post with it, and the folder rule; post → first in feed → like, save → reply; message from a profile → they see it
                      # unread → accept → reply; reactions, replies and unsend (in DMs
                      # and club chats); club chat and announcements (officers only, members can't,
                      # non-members can't read); event chat for people going; follow; join a club; RSVP; alerts)
scripts/test.sh       # the same, then UI journeys on a simulator (XCUITest; macOS asks once to allow UI automation)
```

## TestFlight

TestFlight builds point at production and last 90 days (a free Personal Team's installs expire after 7). Once, with the paid Apple Developer account:

1. Xcode → Settings → Accounts: add the account.
2. [App Store Connect](https://appstoreconnect.apple.com) → Apps → New App: iOS, name Brazework, bundle id `com.brazework.app`, SKU `brazework-ios`.
3. Users and Access: invite each tester (internal testers need a role on the team; up to 100, no review). For a public link, add an external group in TestFlight; its first build waits for Apple's beta review.

Then each build is one command (the team ID is under developer.apple.com → Membership):

```sh
TEAM=ABCDE12345 scripts/testflight.sh              # build for production, sign, upload
TEAM=ABCDE12345 scripts/testflight.sh --no-upload  # the same, stopping at build/export/Forge.ipa
```

The build number is the UTC time (`yymmdd.HHMM`), so each upload is higher than the last; the version is `MARKETING_VERSION` in `project.yml`. The production URL and anon key are passed to that build only (from `FORGE_SUPABASE_URL` / `FORGE_SUPABASE_ANON_KEY`, or the public values in `web/.env.local`), so `Config/` keeps pointing at the local stack. To upload without Xcode's account (for CI later), set `ASC_KEY_PATH`, `ASC_KEY_ID` and `ASC_ISSUER_ID` to an App Store Connect API key. `ITSAppUsesNonExemptEncryption` is false (the app only uses the system's HTTPS), and `Forge/Resources/PrivacyInfo.xcprivacy` declares what the app collects: keep it in step when the app starts collecting something new.

## Next

1. Push notifications (APNs + a Supabase webhook on `notifications` and `messages`).
2. Upload from CI on each merge, with an App Store Connect API key.
