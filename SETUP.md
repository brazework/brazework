# Putting Forge online with Firebase

This guide takes you from this folder to a live website with real accounts. It takes about 30 to 45 minutes the first time. You don't need to write any code. Everything here is free on Firebase's starting plan (called "Spark").

You'll do three kinds of things:

- **Clicks in the Firebase website** (steps 1 to 4)
- **One file edit** (step 4)
- **A few typed commands** (steps 5 and 6). Copy and paste them exactly.

---

## Step 1: Create a Firebase project

1. Go to **https://console.firebase.google.com** and sign in with your Google account.
2. Click **Create a project** (or **Add project**).
3. Name it, for example `forge-app`. Firebase shows a **Project ID** under the name, like `forge-app-1a2b3`. **Write this down**; you'll need it in step 4.
4. Google Analytics: you can turn it off for now. Click **Create project**, wait, then **Continue**.

## Step 2: Turn on sign-in

1. In the left menu, open **Build → Authentication**, then click **Get started**.
2. Under **Sign-in method**, click **Email/Password**, switch on the first toggle (**Email/Password**), and click **Save**.

## Step 3: Create the database

1. In the left menu, open **Build → Firestore Database**, then **Create database**.
2. Choose a location close to your users (for the US, `nam5 (United States)` is fine). **You can't change this later.**
3. Choose **Start in production mode** and click **Create**. Forge's own security rules get uploaded in step 6.

## Step 4: Connect this folder to your project

1. Click the **gear icon ⚙** next to "Project Overview" → **Project settings**.
2. Scroll to **Your apps** and click the **web icon `</>`**.
3. Give it a nickname like `forge-web`. Leave "Firebase Hosting" unchecked. Click **Register app**.
4. Firebase shows a block of code containing `const firebaseConfig = { ... }`. Keep that page open.
5. In this folder, open **`public/js/firebase-config.js`** in any text editor (Notepad on Windows, TextEdit on Mac).
6. Replace each `PASTE-...` value with the matching value from Firebase (`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`). Keep the quotation marks. Save the file.
7. Open **`.firebaserc`** in this folder (on Mac, press **Cmd + Shift + .** in Finder to show hidden files). Replace `PASTE-YOUR-PROJECT-ID` with your Project ID from step 1. Save.

> These config values are safe to have in a website. What protects your data is the security rules file, `firestore.rules`.

## Step 5: Install the Firebase tools (one time only)

1. Install **Node.js**: go to **https://nodejs.org**, download the **LTS** version, and install it with the default options.
2. Open a terminal:
   - **Mac:** open **Terminal** (search for it with Spotlight).
   - **Windows:** open **Command Prompt** from the Start menu.
3. Paste this and press Enter:

   ```
   npm install -g firebase-tools
   ```

   On Mac, if you see a permission error, use `sudo npm install -g firebase-tools` and type your Mac password.

## Step 6: Upload Forge

1. In the terminal, move into this folder. Type `cd ` (with a space), drag the `forge-app` folder onto the terminal window, and press Enter.
2. Sign in to Firebase (a browser window opens; choose your Google account):

   ```
   firebase login
   ```

3. Upload the website, security rules and database index:

   ```
   firebase deploy
   ```

4. When it finishes, it prints a **Hosting URL** like `https://forge-app-1a2b3.web.app`. That's your live site.

Whenever I send you an updated version, replace the files and run `firebase deploy` again.

## Step 7: Wait a few minutes, then test

The database needs a few minutes after an upload to build the indexes used by profiles and communities. If a page shows "The database needs a one-time setup step," wait five minutes and refresh.

Try this checklist on your live site:

- [ ] Sign up as a professional with your own email
- [ ] Find the verification email (check spam), click the link, then click **I've verified my email**
- [ ] Pick your major or profession, field and at least 3 interests
- [ ] Post something on the feed with a topic; like it, comment on it and save it
- [ ] Post from your profile page; open Saved from the menu
- [ ] Create a community, post in it, and check the Communities tab on your feed
- [ ] From your second account, join (or request to join) the community; approve the request from **Manage**, then make that account a Moderator
- [ ] From your second account, open your main profile and click **Connect**; on your main account, accept it under **Network**, then check the **Following** tab on your feed
- [ ] Edit your headline and bio on your profile
- [ ] In Settings, switch between Dark, Light and Match device
- [ ] Open the side menu and pick an item; it should close on its own
- [ ] Log out and log back in; you should see the welcome screen
- [ ] Sign up a second account in a private browser window and like the first account's post

## Optional: try changes on your computer before uploading

From this folder, run:

```
firebase serve --only hosting
```

Then open **http://localhost:5000**. It uses your real Firebase project, so accounts and posts you make here are real.

## Optional: nicer verification emails

In **Authentication → Templates**, you can change the sender name to "Forge" and edit the wording of the verification and password reset emails.

---

## What's in this first version

| Built and working | Coming next (designed in the prototype) |
| --- | --- |
| Landing page | Messages with request inbox |
| Sign-up (student or professional, 18+, university email check) | Events |
| Email verification and log-in, password reset | Projects with build logs and critiques |
| Interests and field (onboarding) | Community events, invite-only communities |
| Network: connections, requests with notes, following, People you may know | |
| Feed with live posts, likes, comments, topics and saving; For you, Latest, Following and Communities tabs | |
| Profiles with posts, posting, headline, bio, connect and follow | Saved folders and saved events |
| Communities: discover, create, join or request, roles, moderation, auto-moderation | Organizations (companies and schools), admin console |
| Settings: theme, accent, text size, reduce motion, interests | |
| Side menu, page transitions, light and dark themes | Analytics, marketplace and NDA process (stay off until launch) |

## If something goes wrong

- **The site says "Almost there: connect Firebase."** The values in `public/js/firebase-config.js` weren't saved, or still start with `PASTE`. Re-check step 4, then run `firebase deploy` again.
- **`firebase: command not found`.** Close and reopen the terminal after step 5. If it still fails, redo step 5.
- **"You don't have permission to do that."** The security rules didn't upload. Run `firebase deploy --only firestore`.
- **No verification email.** Check spam, then use **Resend link**.
- **Anything else:** copy the exact message from the terminal or the page and send it to me.

---

## Installing updates

Every update I send leaves out your two settings files (`public/js/firebase-config.js` and `.firebaserc`), so copying it in never erases your connection to Firebase.

1. **Back up first:** copy your `forge-app` folder and rename the copy `forge-app-backup` (keep only the most recent backup).
2. **Unzip the update.**
3. **Copy everything inside the update's `forge-app` folder into your `forge-app` folder.** When Windows asks, choose **Replace the files in the destination**.
4. **Open Command Prompt in your `forge-app` folder** (click the address bar, type `cmd`, press Enter) and run:

   ```
   firebase deploy
   ```

5. **Check the live site.** If it looks unchanged, press **Ctrl + F5** to reload without the old copy.

If an update breaks something, you can undo it instantly: in the Firebase website go to **Hosting**, find **Release history**, click the **⋮** menu next to the previous release, and choose **Roll back**. Then tell me what went wrong.
