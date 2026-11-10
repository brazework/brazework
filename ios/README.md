# Forge for iPhone

Native SwiftUI app on the same Supabase backend as `web/`: same tables, same row-level security, same feed ranking (`FeedRank.swift` is a port of `web/src/lib/feed-rank.ts`, with tests that pin the numbers).

`ForgeKit/` is the data layer (models, ranking, every read and write in `API.swift`, the feed and inbox stores). The app compiles those sources directly; `swift test` runs them on the Mac against the local stack. `Forge/` is the SwiftUI app.

## What's in it

| Tab | |
|---|---|
| **Feed** | For you (ranked, with why each post is there; your new post first), Latest, Following. Like, save, share, reply/answer, post updates, questions and results with up to 4 photos or a video (preview before posting; photos shrink to 2000 px with location data stripped, videos convert to H.264 MP4 so they play everywhere). Videos play as you scroll with sound (following the ringer switch), one at a time; tap to pause, then speed and fullscreen; a thin scrubber |
| **Clubs** | Your clubs and discover, search, a club's page with its posts, join or ask to join. **Events**: upcoming club and organization events, a map of the place with directions, I'm going, join online |
| **Profiles** | Anyone's profile from a post, reply, alert or thread: headline, field, interests, posts; follow and message them |
| **Messages** | Club, event and team chats (officers post announcements; Ember's answers show as Ember's), plus direct messages with requests, accept or decline. Long-press any message to react (8 emoji), reply with a quote, copy, or unsend your own (direct messages within 15 minutes). Threads update live (Realtime, with polling as a fallback). Open a club's chat from its page, an event's from its page once you're going |
| **Alerts** | Likes, replies, mentions, follows, club and milestone news; marked read once seen; tap to open the post or person |
| **You** | Profile, light/dark and the web's five themes, links to settings and Ember on the web, sign out |

Sign-up, onboarding and Ember open on the web for now.

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
                      # local stack (photo upload → post with it, and the folder rule; post → first in feed → like, save → reply; message from a profile → they see it
                      # unread → accept → reply; reactions, replies and unsend (in DMs
                      # and club chats); club chat and announcements (officers only, members can't,
                      # non-members can't read); event chat for people going; follow; join a club; RSVP; alerts)
scripts/test.sh       # the same, then UI journeys on a simulator (XCUITest; macOS asks once to allow UI automation)
```

## Next

1. Push notifications (APNs + a Supabase webhook on `notifications` and `messages`).
2. Team chats; @mentions in posts.
3. Native sign-up and onboarding; TestFlight.
