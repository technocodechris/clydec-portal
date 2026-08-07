# Deployment Playbook: Forking the Portal for a New Company

This document details the exact process for taking the portal codebase and standing it up as a fully separate, working product for Tago Life — including its own GitHub repository, Vercel project, Firebase project, and Google Drive storage. Everything outlined here is account-level configuration (no custom code needed for standard deployments), making this sequence fully reusable when forking the portal for additional organizations.

Role access is controlled via **Admin**, **Employee**, **Client**, and **Intern** permission levels. The highest permission level is **Admin**, providing full read/write access to all portal settings and modules. Access for lower roles is configured via a granular, per-user folder and panel access management system inside the People Information module.

**Account-Specific Components:**
- **GitHub:** New repository hosting the source code.
- **Firebase:** New project for Authentication & Firestore Database.
- **Google Cloud / Drive / Calendar:** New OAuth Client, enabled Drive & Calendar APIs, and designated Google Drive storage account/folders.
- **Vercel:** New deployment project with configured server-side and client-side environment variables.

---

## Part 1 — GitHub: Getting the Code Hosted

1. Go to [github.com/new](https://github.com/new). Enter your repository name (e.g., `tago-life-portal`). Leave it empty — do **not** initialize with a README, `.gitignore`, or license. Click **Create repository**.
2. Unzip the project source code locally to expose the root directory containing `src/`, `api/`, `package.json`, `firestore.rules`, etc.
3. On the empty GitHub repository page, click **uploading an existing file**. Select all files and folders *inside* the project directory (preserving the `src/` and `api/` subfolder structure) and drag them into the upload field.
4. Enter a commit message (e.g., `Initial portal codebase`) and click **Commit changes**.

*Vercel connects directly to this repository for automated builds and continuous deployment (see Part 7).*

---

## Part 2 — Firebase: Authentication + Firestore Backend

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g., `tago-life-portal`). *Always create a separate project for each organization.*
2. Navigate to **Build → Authentication → Get started** → enable the **Email/Password** sign-in method. *(New user accounts are provisioned manually by an Admin; no public sign-up form exists).*
3. Navigate to **Build → Firestore Database → Create database** → select **Production mode** → choose your preferred regional location.
4. **Publish Security Rules:**
   - Open `firestore.rules` from the project repository.
   - Copy its entire contents.
   - In the Firebase Console, open **Firestore Database → Rules**.
   - Paste the code into the editor and click **Publish**. *(This step activates security rules for user profiles, activity logs, screenshots, time entries, EOD reports, calendar events, leave requests, team conversations, and video call signaling).*
5. **Retrieve Client Configuration Keys** (for `VITE_FIREBASE_*` environment variables):
   - Go to **Project settings (Gear icon) → General → Your apps**.
   - If no web application exists, click the `</>` icon to register one.
   - Copy the following configuration parameters: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
6. **Retrieve Admin Service Account Credentials** (for `FIREBASE_*` environment variables):
   - Go to **Project settings → Service accounts** tab.
   - Click **Generate new private key** to download the JSON service account key.
   - From the JSON file, extract: `project_id`, `client_email`, and the full `private_key` (including `-----BEGIN PRIVATE KEY-----` and `\n` line breaks).

---

## Part 3 — Google Cloud: Enabling Drive & Calendar APIs

Firebase projects run on Google Cloud infrastructure. API management occurs within the matching Google Cloud project console.

1. Open [console.cloud.google.com](https://console.cloud.google.com) and confirm the top left project selector matches your Firebase project name.
2. Navigate to **APIs & Services → Library**.
3. Search for **Google Drive API** → click **Enable**.
4. Search for **Google Calendar API** → click **Enable**.

*Both APIs must be enabled for file storage and Google Meet link generation to function.*

---

## Part 4 — Google Auth Platform: OAuth Consent Screen & Client

1. Open **APIs & Services → Google Auth Platform** (or OAuth consent screen).
2. **Branding Tab:** Set your **App name** (e.g., "Tago Life Portal"), **User support email**, and **Developer contact information**. Click **Save**.
3. **Audience Tab:** Leave the Publishing status as **Testing** during initial setup. Under **Test users**, click **Add users** and enter the email address of the Google account holding the company's Google Drive storage and Google Calendar.
4. **Data Access Tab:** Click **Add or remove scopes**:
   - Search for `Drive API` and select `https://www.googleapis.com/auth/drive`.
   - Search for `Calendar API` and select `https://www.googleapis.com/auth/calendar.events`.
   - Click **Update** → **Save**.
5. **Clients Tab:** Click **+ Create Client**:
   - Application type: **Web application**.
   - Under **Authorized redirect URIs**, click **Add URI** and enter:
     `https://developers.google.com/oauthplayground` *(Ensure there is no trailing slash).*
   - Click **Create**. Copy the generated **Client ID** and **Client Secret**.

---

## Part 5 — OAuth Playground: Minting the Refresh Token

1. Open [developers.google.com/oauthplayground](https://developers.google.com/oauthplayground).
2. Click the gear icon (top right corner) → check **Use your own OAuth credentials**.
3. Paste the **Client ID** and **Client Secret** obtained in Part 4.
4. In the left scope selection list:
   - Expand **Drive API v3** → check `https://www.googleapis.com/auth/drive`.
   - Expand **Google Calendar API v3** → check `https://www.googleapis.com/auth/calendar.events`.
5. Click **Authorize APIs**.
6. Sign in with the **Test user Google account** specified in Part 4.
7. If an "Unverified App" warning appears, click **Advanced → Go to [App Name] (unsafe) → Allow**.
8. After returning to the OAuth Playground, click **Exchange authorization code for tokens** immediately.
9. Copy the value in the **Refresh token** field (`GDRIVE_REFRESH_TOKEN`).

---

## Part 6 — Google Drive: Folder Structure & Meet Recordings Setup

1. Log into the company Google Drive storage account.
2. Create root folders corresponding to your organizational departments (e.g., **Operations & Admin**, **Marketing Growth**, **PR & Branding**, **Multimedia & Content Studio**, **Sales**, **Company Admin** — matching `SEED_FOLDERS` or custom department definitions).
3. Open each folder and copy its unique folder ID from the browser address bar (the alphanumeric string immediately following `/folders/`).
4. **Meet Recordings Folder:** Ensure a folder named `Meet Recordings` exists in the Drive root directory (Google Meet automatically creates this when recording meetings, or you can create it manually). The `listMeetRecordings` API automatically queries this folder for video files (`.mp4`).

---

## Part 7 — Vercel: Environment Variables & Deployment

1. Log into [vercel.com](https://vercel.com) → **Add New → Project → Import Git Repository** → select your GitHub repository. Vercel auto-detects Vite.
2. Before clicking Deploy, expand **Environment Variables** and add all required variables (18 total) for **Production** and **Preview** environments:

### Client-side Firebase Variables (6)
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Storage Provider Flag (1)
- `VITE_STORAGE_PROVIDER` = `drive` *(Must be lowercase literal `drive`. If omitted or incorrect, file uploads fail over CORS or fall back to Firebase Storage).*

### Firebase Admin Credentials (3)
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` *(Include full key string with `-----BEGIN PRIVATE KEY-----` and `\n` characters).*

### Drive & Calendar OAuth Credentials (3)
- `GDRIVE_CLIENT_ID`
- `GDRIVE_CLIENT_SECRET`
- `GDRIVE_REFRESH_TOKEN`

### Drive Department Folder IDs (6)
- `GDRIVE_FOLDER_OPERATIONS`
- `GDRIVE_FOLDER_MARKETING`
- `GDRIVE_FOLDER_PR`
- `GDRIVE_FOLDER_MULTIMEDIA`
- `GDRIVE_FOLDER_SALES`
- `GDRIVE_FOLDER_COMPANY_ADMIN`

3. Click **Deploy**.

> [!IMPORTANT]
> **Build-Time Bundle Gotcha:** All `VITE_`-prefixed environment variables are compiled directly into client-side JavaScript bundles at **build time**. If you edit any `VITE_` variable in Vercel after initial deployment, simply saving will not update the live application. You **must** trigger a fresh build via **Deployments → ⋯ (menu) → Redeploy**, ensuring **"Use existing Build Cache"** is unchecked. Server-side environment variables (Firebase Admin, Drive OAuth, Folder IDs) take effect immediately on new serverless requests without requiring a re-build.

---

## Part 8 — Publishing OAuth App to Production

Perform this step after confirming Drive and Calendar integrations function properly:

1. Open **Google Auth Platform → Audience** tab.
2. Click **Publish app** and confirm the prompt.
3. *Publishing removes Google's default 7-day refresh token expiration limit enforced on Testing mode.*
4. If tokens were minted prior to publishing, re-run Part 5 once more to generate a permanent refresh token, update `GDRIVE_REFRESH_TOKEN` in Vercel, and redeploy.

---

## Part 9 — Bootstrapping the First (Admin) Account

Initial portal setup requires manually seeding an Admin user directly in Firebase:

1. Open **Firebase Console → Authentication → Users → Add user**.
2. Enter an email address and password. Click **Add user**.
3. Click the newly created user row and copy the generated **User UID** string.
4. Navigate to **Firestore Database → Data → Start collection**.
5. Set Collection ID to `users` → click **Next**.
6. Set **Document ID** to the exact **User UID** copied from Step 3.
7. Add the following fields:
   - `email` (string) — matching the Auth email
   - `name` (string) — Admin display name
   - `role` (string) — `ADMIN` *(Must be exact uppercase literal)*
   - `status` (string) — `ACTIVE`
   - `createdAt` (number) — epoch timestamp (e.g., `1700000000000`)
8. Click **Save**.
9. Log into the live portal URL with these credentials to access full Admin dashboard capabilities.

---

## Part 10 — Feature Architecture, System Updates & Security Fixes

### 1. Activity Logs & Presence Security Rule Fix
If user accounts appear permanently offline or the live presence dashboard fails to report activity, check `firestore.rules`. The `activity-logs` match block must use `request.resource.data.id == request.auth.uid` instead of `request.resource.data.userId` to validate write requests against the log document structure.

### 2. Flexible Time Tracking Modes
Admins can configure three distinct time-tracking operational modes per user profile:
- **Disabled:** Disables clock-in and presence interactions.
- **Hourly (Clock in):** Traditional time tracking recording clock-in, clock-out, and active duration.
- **Presence (I'm here):** Allows team members/interns with flexible hours to signal active presence. Replaces "Clock In" with "Hey, I'm here" and hides elapsed hour timers. Open schedule hours are automatically displayed across the portal for presence-mode users.

### 3. Live Presence & Activity Dashboard
The Live Presence & Activity dashboard provides real-time oversight for active team members:
- **Granular Activity Metrics:** Measures `mouse movements`, `clicks`, `scrolls`, and `keystrokes`. Hovering over activity bars displays per-hour interaction counts.
- **Automated Portal Screenshot Capture:** Captures browser app snapshots every **2 minutes** using `html2canvas` while a user is actively clocked in or marked present. Screenshots are stored in the `activity-logs/{uid}/screenshots` subcollection.
- **Daily Timeline & Offline Tracking:** Admins can view comprehensive daily reports summarizing total daily clicks/keystrokes along with a chronological screenshot timeline. Full 2-minute intervals without activity generate empty idle/offline snapshots.
- **Data Management & Retention:** Admins can purge screenshot history for specific users using the "Clear Day's History" action to optimize database storage.
- *Dependency Note:* `html2canvas` is included in `package.json` and automatically bundled during Vercel deployment.

### 4. End-of-Day (EOD) Reports Module
A dedicated **EOD Reports** tab under Time & Attendance allows employees to submit daily work summaries:
- **Employee Submission:** Captures accomplishments, project progress, planned tasks for tomorrow, and active blockers.
- **Admin Review:** Admins can inspect and filter EOD submissions across Daily, Weekly, or Monthly views, with user-specific filtering.
- *Deployment Requirement:* Re-publish `firestore.rules` to enable the `eod-reports` collection rules.

### 5. Personal Account Settings & Profile Management
Users can open their **Account Settings** modal directly by clicking their avatar/name at the bottom of the navigation sidebar. Capabilities include updating personal profile avatars and changing login passwords.

### 6. Navigation & Sidebar Restructuring
- **Storage:** Renamed from "Storage Settings".
- **Portal Settings:** Consolidates core workspace parameters and dashboard views.
- **Admin Settings:** Holds user management, panel access configurations, and Access Requests.

### 7. Integrated Calendar & Google Meet Conferencing
The native **Calendar** module supports event planning and meeting links:
- **Google Meet Auto-Generation:** Uses serverless endpoint `/api/createMeet` to create Google Calendar events with embedded Google Meet video URLs.
- **Meet Recordings Viewer:** `/api/listMeetRecordings` fetches `.mp4` meeting recordings stored in the Google Drive `Meet Recordings` folder.
- *Deployment Requirements:*
  1. Re-publish `firestore.rules` for the `calendar-events` collection.
  2. Re-mint OAuth Refresh Tokens with both `drive` and `calendar.events` scopes enabled (see Parts 4 & 5).
  3. Ensure `/api/createMeet.js` and `/api/listMeetRecordings.js` are deployed to Vercel.

### 8. Internal Communication & 1:1 Video Calls
The portal includes real-time messaging and peer-to-peer video calling:
- **Team Chat:** Multi-user conversations and direct messaging stored in `conversations/{id}/messages`.
- **1:1 WebRTC Video Calls:** Direct WebRTC video call signaling using `calls/{callId}` subcollections for ICE candidates and offer/answer handshakes.
- *Security Enforcement:* Client roles are restricted from initiating chat conversations or video calls.

### 9. Hollywood Luxury & Pure Elegance Glassmorphism Design System
The user interface has been updated to reflect Tago Life's high-end, Hollywood luxury aesthetic (`https://www.tago.life/` inspired):
- **Typography:** Integrates Google Fonts (`Cinzel` for high-contrast luxury serif titles/branding, and `Plus Jakarta Sans` for ultra-clean UI typography).
- **Color Palette & Accents:** Features a deep midnight obsidian backdrop (`#06070B`) with multi-layered gold ambient light leaks, metallic champagne gold gradients (`linear-gradient(135deg, #E5C158 0%, #B88E28 100%)`), and glowing sub-accents (`#F7E5A9`, `#D4AF37`).
- **Refined Glassmorphism Surfaces:** Crystalline frosted glass panels (`backdrop-filter: blur(24px) saturate(190%)`, `border: 1px solid rgba(229, 193, 88, 0.16)`) with subtle hover elevation and ambient glow effects.
- **Sidebar & Branding:** Metallic gold tracked serif logo ("TAGO LIFE"), uppercase category sub-headers with gold sub-accents, active item gold bar indicators, and a frosted user profile card.
- **Stat Cards & Quota Indicators:** High-contrast glass stat cards with gold icon badges, large metric typography, and glowing progress bars.

---

## Troubleshooting Quick Reference

| Symptom | Primary Cause | Solution |
| :--- | :--- | :--- |
| `redirect_uri_mismatch` during OAuth authorization | Mismatch between Client Authorized Redirect URI and OAuth Playground URL | Update URI in **Google Auth Platform → Clients** to `https://developers.google.com/oauthplayground` (remove trailing slash). Save and retry after 2 minutes. |
| `invalid_grant` during token exchange | Reused, expired, or invalid authorization code | Re-run Authorize APIs → sign-in → Exchange Code sequence in one continuous flow without delay. |
| Drive / Calendar tokens expire after 7 days | OAuth consent screen left in **Testing** status | Publish app to **Production** in Google Auth Platform (Part 8), then re-mint refresh token. |
| File uploads stall at 0% or return CORS errors to `firebasestorage.googleapis.com` | `VITE_STORAGE_PROVIDER` missing or not set to `drive` | Set `VITE_STORAGE_PROVIDER=drive` in Vercel environment variables, then trigger a fresh rebuild without build cache. |
| Google Meet link generation fails (`createMeet` error) | Missing `calendar.events` scope or Google Calendar API not enabled | Enable Google Calendar API in Google Cloud Console (Part 3), add `calendar.events` scope in OAuth Consent Screen & Playground (Parts 4 & 5), re-mint `GDRIVE_REFRESH_TOKEN`, update Vercel, and redeploy. |
| User activity/presence indicators stuck offline | Firestore security rule validation error on `activity-logs` | Verify `firestore.rules` uses `request.resource.data.id == request.auth.uid` for `activity-logs` match rules and re-publish rules in Firebase Console. |
| `.env.example` parameter confusion | Legacy naming in older documentation templates | Verify Vercel uses `GDRIVE_CLIENT_ID`, `GDRIVE_CLIENT_SECRET`, and `GDRIVE_REFRESH_TOKEN` as expected by `api/_driveClient.js`. |

---

## Organizational Customization Guidelines

**Zero Code Changes Required (Account Swap Only):**
- GitHub Repository
- Firebase Project & Firestore Database
- Google Cloud Project, OAuth Client, Drive Account & Department Folders
- Vercel Project & Environment Variable Values

**Code Modifications Required for New Organizations:**
- **Branding & Department Definitions:** Update `SEED_FOLDERS` and branding metadata in `src/App.jsx`.
- **Drive Folder Mapping:** Update `FOLDER_DRIVE_IDS` in `api/_driveClient.js` alongside matching `GDRIVE_FOLDER_*` environment variables in Vercel if department names or keys change.
