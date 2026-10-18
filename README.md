# Forge (web app, first release slice)

Plain HTML, CSS and JavaScript modules served by Firebase Hosting, with Firebase Authentication and Cloud Firestore. No build step; the Firebase SDK (v10.12.2) is imported from Google's CDN.

- **Set up and deploy:** see [SETUP.md](SETUP.md).
- **Design source of truth:** the Forge prototype canvas and the Forge Build Brief.

## Structure

```
firebase.json            Hosting (single-page app rewrite) and Firestore config
firestore.rules          Security rules: verified members only; authors own their posts; one like per member
firestore.indexes.json   Index for profile post lists (authorId + createdAt)
public/
  index.html             Applies saved theme before first paint
  css/tokens.css         Dark and light color tokens (use these, never fixed colors)
  css/app.css            Shared components, shell, motion (respects reduce motion)
  js/firebase-config.js  Project settings (paste from the Firebase console)
  js/firebase.js         Firebase setup and exports
  js/app.js              Auth state, route guard (sign-in > verify > onboarding > app), transitions
  js/shell.js            Top bar and side menu
  js/theme.js            Appearance settings
  js/posts.js            Composer, post card, live post list, likes, comments, saves, delete
  js/communities.js      Community roles and permissions, joining, requests, moderation, auto-moderation
  js/network.js          Connections (requests, accept, remove) and follows
  js/util.js             Helpers, icons, starter topic list
  js/views/*.js          One file per page
```

## Data

- `users/{uid}`: firstName, lastName, birthday, accountType (student or professional), email, headline, bio, field, interests[], onboarded, createdAt
- `posts/{postId}`: authorId, authorFirst, authorLast, authorHeadline, body, kind (update, question, result, project), tags[] (up to 3 topics), likeCount, commentCount, createdAt
- `posts/{postId}/likes/{uid}`: one document per like
- `posts/{postId}/comments/{commentId}`: authorId, authorFirst, authorLast, body (up to 1000 characters), createdAt
- `users/{uid}/saved/{postId}`: postId, col (where the post lives), authorId, savedAt (private to the owner)
- `connections/{uidA_uidB}`: users[2], from, to, status (pending, accepted), note, people {uid: name, headline, field, accountType}, createdAt, acceptedAt. ID is the two member IDs sorted, so there's only ever one per pair.
- `follows/{follower_target}`: follower, target, followerInfo, targetInfo, createdAt
- `communities/{cid}`: name, nameLower, about, field, type (field, study, project, school), privacy (public, approval), topics[], rules, ownerId, ownerName, memberCount, lastMemberChange, automod {words[], holdNewLinks}, createdAt
- `communities/{cid}/members/{uid}`: uid, role (owner, admin, moderator, helper, member), firstName, lastName, headline, joinedAt
- `communities/{cid}/requests/{uid}`: pending join requests for approval-required communities
- `communities/{cid}/bans/{uid}`: banned members (can't rejoin or request)
- `communities/{cid}/posts/{postId}`: same as feed posts, plus communityId, communityName, status (visible, held); with likes and comments underneath
- `orgInterest/{id}`: company and school interest from the landing page (write-only from the site; read it in the Firebase console under Firestore Database)

## Known limits of this slice

- University email is checked by domain pattern only; a maintained school-domain list comes later.
- Author name on posts is copied at posting time; profile name changes don't update old posts yet.
- Feed loads the latest 60 posts. "For you" ranks them by recency with a boost for your interests; Following and Communities tabs arrive with the network and communities.
- Likes are checked by the rules (the count only moves with a real like). The comment count is trusted to the app, so it could drift if someone tampered with it; moving counts to Cloud Functions later fixes this.
- Deleting a post removes its comments; old like records stay behind (harmless, invisible).
- Saved posts have no folders yet.
- Auto-moderation (word filter, holding links from new members) runs in the app when someone posts. A person tampering with the app could skip it; moderators can still remove anything. Moving it to Cloud Functions later makes it airtight.
- Communities can't be deleted or have ownership transferred yet (needs a Cloud Function to clean up everything inside). Invite-only communities, community events and a moderation log come later.
- Names and headlines stored on connections and follows are copied when created; profile edits don't update them yet.
- The Following feed shows posts from the 30 people you most recently followed. Sending or accepting a connection request follows that person.
- Anyone who was declined can send a new request later; blocking and request limits come with Messages.
- The feed's Communities tab merges the latest posts from up to 10 of your communities.
