# Deployment Playbook: Forking the Portal for a New Company

This documents exactly what we did to take the original portal codebase
and stand it up as a fully separate, working product for Tago Life â€” its own
GitHub repo, its own Vercel project, its own Firebase project, its own Google
Drive account. Everything here is account-level setup (no new code), so the
same sequence works for forking this again for a *third* company â€” just
swap the accounts.

There is no longer an "Owner" role. The highest permission level is **Admin**, which gives full read/write access to everything. Access for lower roles (Employee, Client, Intern) is configured via a granular, per-user folder and panel access system in the People Information page.

**Where the account-specific pieces are:** GitHub (new repo), Firebase (new
project), Google Cloud/Drive (new OAuth client + new Drive account or
folders), Vercel (new project + its own copy of every env var below). The
code itself doesn't change between deployments unless you also want new
branding/Departments â€” see Part 8.

---

## Part 1 â€” GitHub: getting the code hosted

1. Go to `github.com/new`. Name the repo (e.g. `tago-life-portal`). Leave
   it empty â€” don't initialize with a README, `.gitignore`, or license.
   Click **Create repository**.
2. Unzip the project locally so you have a plain folder (`src/`, `api/`,
   `package.json`, etc.) rather than a `.zip`.
3. On the empty repo page, click **uploading an existing file**. Select
   *everything inside* that folder (not the folder itself) and drag it into
   the upload box â€” this preserves the `src/` and `api/` subfolder
   structure. Write a commit message and click **Commit changes**.

That's the entire GitHub side. No branches, no PRs, no local git needed â€”
Vercel watches this repo directly once connected (Part 5).

---

## Part 2 â€” Firebase: auth + database backend

1. **console.firebase.google.com** â†’ **Add project** â†’ name it (e.g.
   `tago-life-portal`). This is a brand new project â€” never share one
   across two companies' portals.
2. **Build â†’ Authentication â†’ Get started** â†’ enable the **Email/Password**
   sign-in method. (No sign-up flow exists in the app itself â€” every user
   account is created manually in the console, see Part 6.)
3. **Build â†’ Firestore Database â†’ Create database** â†’ **Production mode** â†’
   pick a region.
4. **Publish the security rules:** open `firestore.rules` from the repo,
   copy its entire contents, go to **Firestore Database â†’ Rules** tab in
   the console, paste over everything in the editor, click **Publish**.
   GitHub having the file does nothing on its own â€” this manual paste is
   the only thing that actually activates the rules.
5. **Get the client config** (for the `VITE_FIREBASE_*` Vercel variables):
   **Project settings (gear icon) â†’ General â†’ Your apps**. If no web app
   exists yet, click the `</>` icon to register one. Copy: `apiKey`,
   `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
6. **Get the admin credentials** (for the `FIREBASE_*` Vercel variables):
   **Project settings â†’ Service accounts** tab â†’ **Generate new private
   key** â†’ downloads a JSON file. From it you need `project_id`,
   `client_email`, and the full `private_key` (including the
   `-----BEGIN/END-----` lines and `\n` sequences â€” paste it exactly as-is,
   the app un-escapes them automatically).

---

## Part 3 â€” Google Cloud: enabling Drive access

A Firebase project *is* a Google Cloud project under the hood, so this
happens in the same project as Part 2.

1. **console.cloud.google.com** â†’ confirm the project selector (top left)
   shows your Firebase project's name.
2. **APIs & Services â†’ Library** â†’ search **Google Drive API** â†’ **Enable**.
   Without this, every Drive call from the app fails outright.

---

## Part 4 â€” Google Auth Platform: OAuth consent screen + client

Google's consent-screen setup now lives under **APIs & Services â†’ Google
Auth Platform**, split into tabs instead of one wizard.

1. **Branding** tab: set an App name (e.g. "Tago Life Portal"), your email
   as User support email, and again as Developer contact info. Save.
2. **Audience** tab: leave Publishing status as **Testing** for now (we
   move this to Production at the very end, in Part 7 — doing it too early
   just adds friction). Under **Test users**, click **Add users** and add
   the Google account that should actually hold the company's files.
3. **Data Access** tab: click **Add or remove scopes** -> search "Drive
   API" -> check `https://www.googleapis.com/auth/drive`. Then search "Calendar API" -> check `https://www.googleapis.com/auth/calendar.events` -> **Update** ->
   **Save**.
4. **Clients** tab: **+ Create Client** → Application type **Web
   application** → under **Authorized redirect URIs**, **Add URI** and
   paste exactly `https://developers.google.com/oauthplayground` (no
   trailing slash — a mismatched trailing slash is the #1 cause of a
   `redirect_uri_mismatch` error later). **Create**. Copy the **Client ID**
   and **Client secret** shown â€” you need these twice: next in the
   Playground, and again later in Vercel.

---

## Part 5 â€” OAuth Playground: minting the refresh token

1. Go to **developers.google.com/oauthplayground**. Click the gear icon
   (top right) â†’ check **Use your own OAuth credentials** â†’ paste the
   Client ID and Client secret from Part 4 step 4.
2. In the left panel, find and expand **Drive API v3**, check the
   `.../auth/drive` scope. Then find and expand **Google Calendar API v3**, and check the `.../auth/calendar.events` scope. Click **Authorize APIs**.
3. Sign in with the *same* Google account you added as a Test user. You'll
   likely see an "unverified app" warning â€” this is expected for a private
   single-owner tool. Click **Advanced â†’ Go to [app name] (unsafe) â†’
   Allow**.
4. Back on the Playground, the authorization code is auto-filled. Click
   **Exchange authorization code for tokens** *immediately* â€” don't switch
   tabs or wait, the code is single-use and short-lived. Copy the
   **Refresh token** field that appears â€” that's your `GDRIVE_REFRESH_TOKEN`.
   (Ignore the Access token â€” it's short-lived and the app doesn't need it
   directly.)

---

## Part 6 â€” Google Drive: creating the folder structure

In that same Drive account, create one folder per root folder the app
expects (for Tago Life: **Operations & Admin**, **Marketing Growth**, **PR & Branding**, **Multimedia & Content Studio**, **Sales**, **Company Admin** â€” this list is whatever `SEED_FOLDERS` in
`src/App.jsx` defines, so it'll differ if you rename Departments for a future
company). Open each folder and copy the ID from the browser URL â€” the
segment right after `/folders/`. You'll paste these into Vercel next.

---

## Part 7 â€” Vercel: wiring it together and deploying

1. **Add New â†’ Project â†’ Import Git Repository** â†’ pick the new repo (not
   an old company's). Vercel auto-detects it as a Vite app.
2. Before deploying, open **Environment Variables** and add all of the
   following (18 total), scoped to **Production** (and Preview, if you
   want preview branches to work too):

   **Client-side Firebase (7)** â€” from Part 2 step 5:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`

   **Plus one manual flag:**
   `VITE_STORAGE_PROVIDER` = literal value `drive` (lowercase, no quotes,
   no URL â€” this is the single most common thing to get wrong; if it's
   missing or misspelled, the app silently falls back to Firebase Storage
   instead of Drive and uploads fail with a CORS error)

   **Firebase Admin (3)** â€” from Part 2 step 6:
   `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`

   **Drive OAuth (3)** â€” from Parts 4â€“5:
   `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, `GDRIVE_REFRESH_TOKEN`

   **Drive folder IDs (6)** â€” from Part 6:
   `GDRIVE_FOLDER_OPERATIONS`, `GDRIVE_FOLDER_MARKETING`, `GDRIVE_FOLDER_PR`,
   `GDRIVE_FOLDER_MULTIMEDIA`, `GDRIVE_FOLDER_SALES`, `GDRIVE_FOLDER_COMPANY_ADMIN`
   (these 6 exact names are Tago Life's Departments â€” a future company with
   different Department names needs matching env var names, which also means a
   matching code change in `api/_driveClient.js`'s `FOLDER_DRIVE_IDS`)

3. Click **Deploy**.

### The one gotcha that will bite you later
Every `VITE_`-prefixed variable gets baked into the JavaScript bundle **at
build time**, not read at runtime. If you ever add or fix one of the 7
`VITE_FIREBASE_*` vars or `VITE_STORAGE_PROVIDER` *after* the first deploy,
saving it in Vercel does nothing by itself â€” you must trigger a genuinely
fresh build: **Deployments â†’ â‹¯ on the latest deployment â†’ Redeploy**, with
**"Use existing Build Cache" turned off**. The non-`VITE_` server-side vars
(Firebase Admin, Drive OAuth, folder IDs) don't have this restriction â€”
those are read live by the serverless functions on every request.

---

## Part 8 (final step) â€” Publish the OAuth app to Production

Do this only *after* confirming the Drive connection works at least once â€”
it's the step that makes the connection permanent instead of expiring.

1. **Google Auth Platform â†’ Audience** tab â†’ click **Publish app** â†’
   confirm through the warning dialog. (The "unverified" warning users see
   when signing in doesn't go away â€” that only happens with full Google
   verification, which isn't necessary for a private internal tool. What
   *does* change is that Testing-mode's automatic 7-day refresh token
   expiry goes away.)
2. If you publish *after* already minting a token, that old token may
   still be tied to the old Testing state â€” safest to redo Part 5 once
   more after publishing, and update `GDRIVE_REFRESH_TOKEN` in Vercel with
   the new one, then redeploy.

---

## Part 9 â€” Bootstrapping the first (Admin) login

There's no sign-up screen by design â€” the very first account has to be
created by hand, once, directly in Firebase.

1. **Firebase Console â†’ Authentication â†’ Users â†’ Add user** â†’ enter any
   email + password (doesn't need to be a real inbox â€” no verification
   email is sent). **Add user**.
2. Click that new row to reveal the **User UID** (a long string) â†’ copy it.
3. **Firestore Database â†’ Data â†’ Start collection** â†’ Collection ID:
   `users` (exact, lowercase) â†’ **Next**.
4. For **Document ID**, paste the User UID from step 2 â€” don't let it
   auto-generate one, it has to match exactly. Add fields:
   - `email` (string) â€” same email as step 1
   - `name` (string)
   - `role` (string) â€” must be the exact literal `ADMIN`, all caps
   - `status` (string) â€” `ACTIVE`
   - `createdAt` (number) â€” any timestamp-looking number, e.g. `1700000000000`

   Click **Save**.
5. Go to the live Vercel URL and log in with that email/password. You
   should land in the dashboard with full Admin access.

---

## Troubleshooting quick reference (all confirmed fixes, not guesses)

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` during Playground authorization | Redirect URI on the OAuth Client doesn't exactly match `https://developers.google.com/oauthplayground` (often a stray trailing slash) | Edit the Client in **Google Auth Platform â†’ Clients**, fix the URI exactly, save, wait ~2 min, retry |
| `invalid_grant` when exchanging the code for tokens | The authorization code was reused, expired, or generated before a Client edit | Redo the whole Authorize â†’ sign-in â†’ Exchange sequence in one uninterrupted pass; don't reuse an old code |
| Drive connection works briefly then says "expired or revoked" again | OAuth consent screen still in **Testing** status â€” Google hard-expires those tokens (as fast as 7 days) | Publish the app to Production (Part 8), then re-mint the refresh token |
| Files page loads folders fine but every upload hangs at 0%, browser console shows CORS errors to `firebasestorage.googleapis.com` | `VITE_STORAGE_PROVIDER` isn't set to the exact value `drive`, so the app defaults to Firebase Storage instead of Drive | Set the var correctly in Vercel, then force a fresh rebuild (see Part 7's gotcha) â€” a normal save/redeploy alone won't apply it |
| `.env.example` in the repo lists `GDRIVE_CLIENT_EMAIL` / `GDRIVE_PRIVATE_KEY` | Stale leftover naming from an earlier draft of the template | The code actually reads `GDRIVE_CLIENT_ID` / `GDRIVE_CLIENT_SECRET` / `GDRIVE_REFRESH_TOKEN` â€” already corrected in the current repo, but worth knowing if an old copy resurfaces |

---

## What changes vs. stays the same for a *third* company

**Pure account swap (no code changes needed):** GitHub repo, Firebase
project, Google Cloud/Drive OAuth client + account, Vercel project, and
every environment variable value in Part 7.

**Needs an actual code change** (in `src/App.jsx` and
`api/_driveClient.js`, plus matching new `GDRIVE_FOLDER_*` env var names):
company branding text/colors, and the Department names/structure (currently
Operations & Admin / Marketing Growth / PR & Branding / Multimedia & Content Studio / Sales / Company Admin for Tago Life). If the new
company's Departments map cleanly onto one of these existing structures, you
could reuse the code as-is and just relabel; otherwise it's a rename job.


## Part 10 — New Feature Additions and Fixes

### Activity Logs Security Rule Fix
If the Intern Tracking 'Working Now / Idle / Offline' indicator is broken and user accounts appear Offline despite being logged in, ensure the irestore.rules file has the ctivity-logs match rule configured using equest.resource.data.id == request.auth.uid instead of equest.resource.data.userId.

### Presence Tracking (Time Tracking Mode)
Time Tracking can now be set to one of three modes by an Admin:
- **Disabled**: User cannot clock in or out.
- **Hourly (Clock in)**: Standard clock-in/out tracking showing elapsed duration.
- **Presence (I'm here)**: An alternative feature for interns/users who don't have set hours but want to signal active presence. It replaces 'Clock in' with 'Hey, I'm here' and hides elapsed duration.

### Advanced Live Presence & Activity Tracking
The "Live Presence & Activity" dashboard has been upgraded with the following capabilities:
1. **Granular Interaction Metrics**: Instead of a generic interaction count, the system now independently tracks `mouse moves`, `clicks`, `scrolls`, and `keystrokes`. Hovering over activity bars on the dashboard reveals exact numbers for clicks and keystrokes per hour.
2. **Historical Portal Screenshots**: The portal leverages `html2canvas` to capture snapshots of what active users are viewing within the application. These are taken every **2 minutes** and saved permanently to a Firestore subcollection.
3. **Daily Report & Offline Tracking**: Admins can generate a daily report for any user that summarizes their total keystrokes and clicks for the day, and displays a complete timeline of their screenshots. The system now tracks **Offline/Idle time** by capturing empty screenshots if a user is idle for a full 2-minute interval.
4. **Targeted Tracking**: Tracking is only active when a user has explicitly clocked in or marked their presence as "I'm here" using the Time Tracking module. 
5. **Presence Schedule Display**: When a user's time tracking mode is set to "Presence (I'm here)", their work hours are displayed as "Open Schedule Hours" across the portal, reducing confusion around required start/end times.
6. **Data Retention**: The daily report modal includes a "Clear Day's History" button for Admins to manually delete a user's screenshots for a given day to save database storage.

*Note on Dependencies:* To support the screenshot functionality, `html2canvas` was added to `package.json`. No extra deployment steps are needed as Vercel will install this dependency automatically during build time.

### EOD Reports (End of Day Reports)
A new **EOD Reports** tab is available under the Time and Attendance section. 
- Employees can submit a daily breakdown of what they accomplished, what moved forward, tasks for tomorrow, and blockers.
- Admins can view all EOD reports grouped by Daily, Weekly, or Monthly views, and can filter by employee.
- EOD reports include a built-in commenting system for team communication and feedback.
**CRITICAL DEPLOYMENT STEP:** You must re-publish the `firestore.rules` file to the Firebase Console (following Part 2, step 4) because new security rules were added for the `eod-reports` collection.

### Personal Account Settings
Users can now click their own profile name at the bottom left of the sidebar to open the **Account Settings** modal. From here, users can upload/change their own profile picture and change their login password.

### Sidebar & Settings Reorganization
- "Storage Settings" has been renamed to **Storage**.
- The "Dashboard" link has been moved inside **Portal Settings**.
- "Access Requests" has been moved out of Portal Settings and into **Admin Settings**.

### Calendar & Google Meet Integration
A custom Calendar feature is now available that natively supports generating **Google Meet** links for huddles and company events, managing user RSVPs (Going, Maybe, Not Going), and generating/downloading `.ics` Calendar export files, alongside a dedicated **Meet Recordings** viewer pulling directly from Google Drive.
**CRITICAL DEPLOYMENT STEPS:** 
1. **Firestore Rules:** You must re-publish the `firestore.rules` file to the Firebase Console because new security rules were added for the `calendar-events` collection.
2. **Re-mint OAuth Token (Important!):** The `/api/createMeet` route requires access to the Google Calendar API to mint Meet links. If you are upgrading from an older version of the portal, your current `GDRIVE_REFRESH_TOKEN` only has Drive permissions. You **MUST** go back to the Google Cloud Console (Part 4, Step 3) and OAuth Playground (Part 5, Step 2) to authorize both `https://www.googleapis.com/auth/drive` AND `https://www.googleapis.com/auth/calendar.events` at the same time, then copy the new refresh token into Vercel and redeploy.
3. **Vercel Deploy:** The new `api/createMeet.js` and `api/listMeetRecordings.js` endpoints will only go live once you trigger a fresh deployment in Vercel.

### UI/UX, Animations & Dynamic Theming
The portal utilizes `framer-motion` for fluid page transitions and component animations, giving it a premium feel. Additionally, a built-in Light/Dark Mode toggle has been added to the top navigation bar, allowing for dynamic theming via CSS variables. A centralized activity dashboard visualizes metrics using `recharts`.
