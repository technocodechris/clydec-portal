# Clydec Studio Portal — setup guide

There's now a **single Owner** (you, the founder) baked into the rules —
"OWNER" can no longer be assigned to anyone else through Admin settings.
You manage Admins, Employees, and Clients from there as before.

You can run file storage on **Firebase** or **Google Drive** — pick one
with `VITE_STORAGE_PROVIDER` in `.env` (defaults to `firebase`). Login
always goes through Firebase Auth either way — Drive only replaces where
the *files* live, not who's allowed to log in.

**Platform note:** the Drive option uses serverless functions in `/api`,
written in Vercel's format. If you go Drive + Netlify, those need
porting to Netlify's function format first — tell me and I'll do it.
Firebase-only works identically on both Vercel and Netlify as-is.

## Option A — Firebase (simplest)

### 1. Create the Firebase project (~10 min)
1. https://console.firebase.google.com → **Add project**.
2. **Build > Authentication** → Get started → enable **Email/Password**.
3. **Build > Firestore Database** → Create database → **production mode**.
4. **Build > Storage** → Get started → production mode, same region.
5. **Project settings (gear) > General** → "Your apps" → `</>` icon →
   register a web app → copy the `firebaseConfig` values into `.env`
   (copy `.env.example` → `.env` first).

### 2. Deploy security rules
```
npm install -g firebase-tools
firebase login
firebase init firestore storage   # select the project you just made
firebase deploy --only firestore:rules,storage:rules
```
*(This repo doesn't include a `storage.rules` file — this project actually runs on Option B/Google Drive below, not Firebase Storage. If you're setting up Option A for real, `firebase init storage` generates a default `storage.rules` for you as part of that command.)*

### 3. Create your first owner account
Firestore starts empty — bootstrap yourself manually, once:
1. **Authentication > Users > Add user** → your email + a password.
2. Copy the **User UID** shown.
3. **Firestore Database > Start collection** → ID `users` → document ID =
   that UID → fields: `email` (string), `name` (string), `role` (string,
   value `OWNER`), `status` (string, value `ACTIVE`), `createdAt`
   (number, e.g. `1700000000000`).
4. Log in with that email/password — you're the owner. Add everyone
   else from **Admin settings > Users** — it creates their real account
   and emails them a password-setup link.

## Option B — Google Drive (files live in your Drive)

Auth still runs on Firebase (do Option A steps 1–3 first — you need
Firebase for login regardless of where files live). Files themselves go
into **your own Google Drive**, authorized once via OAuth2 (not a
service account — personal Gmail accounts don't get Drive storage quota
for service accounts, so a service account can't actually hold the files).

### 1. Create an OAuth 2.0 Client ID
1. https://console.cloud.google.com → select the **same project** your
   Firebase project uses (Firebase projects are also GCP projects).
2. **APIs & Services > Library** → search "Google Drive API" → Enable.
3. **APIs & Services > OAuth consent screen** → set it up (External user
   type is fine for a single-owner tool) → add the Drive scope you'll
   use (`.../auth/drive` for full access, or `.../auth/drive.file` for
   file-level-only access) → add your own Google account under **Test
   users** for now.
4. **APIs & Services > Credentials** → **Create credentials > OAuth
   client ID** → Application type **Web application** → add
   `https://developers.google.com/oauthplayground` as an authorized
   redirect URI (needed for the one-time token step below) → Create.
   Copy the **Client ID** and **Client secret**.

### 2. Mint a refresh token (one-time, no code)
1. Go to https://developers.google.com/oauthplayground
2. Click the gear icon (top right) → check **"Use your own OAuth
   credentials"** → paste the Client ID/secret from step 1.
3. In the left panel, find **Drive API v3**, check the scope you
   configured (e.g. `https://www.googleapis.com/auth/drive`) →
   **Authorize APIs**.
4. Sign in with the Google account whose Drive should hold the files
   (the founder's account) → allow it — you may see an "unverified app"
   warning since the app isn't published/reviewed; click **Advanced >
   Go to (app name) (unsafe)** to continue (safe here, since it's your
   own app and your own account).
5. Back on the Playground, click **Exchange authorization code for
   tokens** → copy the **Refresh token** shown. This is `GDRIVE_REFRESH_TOKEN`.

### 3. Create Drive folders and get their IDs
1. In your own Google Drive, create 4 folders: e.g. "Clydec Creative",
   "Clydec Data", "Clydec Finance", "Clydec Client Aurora".
2. Open each folder and copy the ID from the URL:
   `drive.google.com/drive/folders/`**`THIS_PART`**.
3. No sharing step needed — it's all in your own account already.

### 4. Create a Firebase Admin service account (separate from Drive's OAuth client)
This lets the server verify who's logged in before touching Drive.
1. Firebase console → **Project settings > Service accounts** →
   **Generate new private key** → downloads a JSON file.
2. You'll need `project_id`, `client_email`, `private_key` from it.

### 5. Set environment variables on your hosting platform
On Vercel: **Project > Settings > Environment Variables**. Add all the
`FIREBASE_*` and `GDRIVE_*` values from `.env.example`'s server-side
section, using the values from steps 1, 2, 3, and 4 above. Also set
`VITE_STORAGE_PROVIDER=drive`.

**Important:** paste `private_key` exactly as it appears in the JSON,
including the `\n` sequences — the code un-escapes them automatically.

### 6. Deploy to Vercel
Push to GitHub → Vercel → **Add New > Project** → import repo → add the
env vars above → Deploy. `vercel.json` already handles routing and
`/api` functions are picked up automatically.

### Renewing the Drive connection (fixes "invalid_grant" errors)
If Drive uploads or the Dashboard's storage widget start failing with
an error mentioning `invalid_grant`, `invalid_client`, or
`unauthorized_client`, the refresh token behind `GDRIVE_REFRESH_TOKEN`
has expired or been revoked. The most common cause by far:

- **Your OAuth consent screen's Publishing status is still "Testing."**
  While it's in Testing, Google expires every refresh token after
  **exactly 7 days**, no matter how often it's used — this is a Google
  policy for unverified/testing apps, not a bug here. Go to **APIs &
  Services > OAuth consent screen** in Google Cloud Console and check
  the Publishing status. If it says "Testing," click **Publish App** to
  move it to **"In production."** For an internal single-owner tool
  like this, that doesn't require Google's full verification review —
  you (and anyone else who authorizes it) will still see an "unverified
  app" warning to click through, but the 7-day expiry goes away.

Other, less common causes of the same error: the connected Google
account's password changed, access was manually revoked at
myaccount.google.com → Security → Third-party access, the refresh token
sat completely unused for 6+ months, or more than 100 refresh tokens
have been issued for this OAuth client (each one silently invalidates
the oldest — avoid re-running the Playground step above more than
necessary once it's working).

**Switching to Production does not fix an already-dead token** — it
only prevents newly-issued tokens from expiring on the 7-day timer.
After publishing, redo **step 2 above** once to mint a fresh refresh
token, then update `GDRIVE_REFRESH_TOKEN` in Vercel and redeploy (Vercel
→ Deployments → the latest → ⋯ → Redeploy — environment variable
changes need a redeploy to take effect).

## Switching later
Change `VITE_STORAGE_PROVIDER` and redeploy — existing file records
stay tagged with whichever provider stored them, so nothing already
uploaded breaks; only new uploads use the new provider.

## Run it locally
```
npm install
npm run dev
```
(For local testing of the Drive functions specifically, use
`vercel dev` instead of `npm run dev`, with a `.env` that includes the
server-side vars — `vite dev` alone doesn't run `/api` functions.)

## What changed from the original artifact
- `window.storage` (Claude-artifact-only, doesn't exist outside claude.ai)
  → replaced with real Firebase Auth + a swappable storage backend
  (Firebase Storage or Google Drive) in `src/firebase.js` /
  `src/driveStorage.js`.
- Plaintext passwords in seed data → removed. Real accounts live in
  Firebase Auth; Firestore only stores the profile (name/role/status).
- Owner is now a fixed singleton (you) — it's no longer an assignable
  role when adding users.
- Adding a user creates a real account and emails them a
  password-setup link, instead of a fake `temp1234` password.

## Known limitation
File *metadata* (name/size/uploader) in Firestore is readable by any
signed-in user; folder-level filtering happens in the UI. Actual file
*bytes* are properly locked per-role (Storage rules for the Firebase
path, the `/api/drive-*` role checks for the Drive path). If clients
seeing other projects' filenames is a concern, say so and I'll tighten
`firestore.rules` to check folder membership per document.

## Workspace (Orbit project-management workspaces)
The "Workspace" sidebar folder holds one or more **Orbit Workspaces** —
a full ClickUp/Asana-style project-management tool, merged in from a
separate project (`src/orbit/OrbitApp.jsx`). Each workspace is grouped
under one of the four Wings (same set Storage uses) and lives as its
own document in the `orbit-workspaces` Firestore collection, with its
entire content (Spaces/Lists/Tasks/Goals/Dashboards/Whiteboards/Docs/
Forms/Chat/Automations) stored as one JSON blob in that doc's `data`
field. Creating or deleting a workspace is Admin/Owner-only; anyone who
can see the Workspace tab (everyone except Client) can open and work
inside any existing one.

- **Requires Tailwind CSS** (`tailwind.config.js`/`postcss.config.js`,
  new this sync) — Orbit's UI is written in Tailwind utility classes,
  unlike the rest of this portal (100% inline styles). Tailwind's
  `content` glob is scoped to `src/orbit/**` and `preflight` is
  disabled, so it can't affect the rest of the app's styling. Run
  `npm install` again after pulling this sync to pick up the new
  `devDependencies` (`tailwindcss`, `postcss`, `autoprefixer`).
- **Team members are not managed per-workspace.** Orbit's own
  add/rename/remove-member UI is disabled — the member list Orbit sees
  is read live from this portal's real `users` (everyone except
  Client), via `membersForOrbit()` in `App.jsx`. Manage who's on the
  team in People Management, same as everywhere else in the portal.
- **AI assist is disabled.** Orbit's "AI draft description" / "AI
  suggest subtasks" buttons originally called `api.anthropic.com`
  directly from the browser — that only works inside the Claude.ai
  artifact sandbox (which auto-injects the connection with no exposed
  key). A real deployment needs its own serverless route holding a
  server-side `ANTHROPIC_API_KEY` (same pattern as `/api/drive-*.js`
  for Google Drive) — not built yet. Clicking either button shows a
  clear in-app error rather than silently failing or leaking a key.
- **One JSON blob per workspace, not normalized collections.** Simple
  to build and matches how the original Orbit artifact already shaped
  its state, but means a whole workspace is read/written as one
  document — Firestore's 1MiB-per-document limit is a real ceiling for
  a single very large, very long-lived workspace (many tasks, big
  whiteboards, big docs). Not a problem at normal usage levels; worth
  splitting into subcollections (e.g. `orbit-workspaces/{id}/tasks`) if
  a workspace ever grows large enough to approach it.
- **Two people editing the same workspace at the same time** last-write-
  wins on the whole `data` blob (autosaved 1.2s after the last change,
  same debounce idea used elsewhere in this app for free-typed fields) —
  there's no field-level merge. Fine for how a small team is likely to
  use one Workspace, but flagged honestly rather than silently assumed
  away.


