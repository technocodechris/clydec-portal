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
Firebase for login regardless of where files live). Then add Drive:

### 1. Create a Google Cloud service account for Drive
1. https://console.cloud.google.com → select the **same project** your
   Firebase project uses (Firebase projects are also GCP projects).
2. **APIs & Services > Library** → search "Google Drive API" → Enable.
3. **APIs & Services > Credentials** → **Create credentials > Service
   account** → name it (e.g. "clydec-drive-bot") → Create and continue
   → skip role grants → Done.
4. Click the new service account → **Keys** tab → **Add key > Create
   new key > JSON** → downloads a file. Open it — you'll need
   `client_email` and `private_key` from it.

### 2. Create Drive folders and share them with the service account
1. In your own Google Drive, create 4 folders: e.g. "Clydec Creative",
   "Clydec Data", "Clydec Finance", "Clydec Client Aurora".
2. Right-click each → **Share** → paste the service account's
   `client_email` → give it **Editor** access.
3. Open each folder and copy the ID from the URL:
   `drive.google.com/drive/folders/`**`THIS_PART`**.

### 3. Create a Firebase Admin service account (separate from Drive's)
This lets the server verify who's logged in before touching Drive.
1. Firebase console → **Project settings > Service accounts** →
   **Generate new private key** → downloads a JSON file.
2. You'll need `project_id`, `client_email`, `private_key` from it.

### 4. Set environment variables on your hosting platform
On Vercel: **Project > Settings > Environment Variables**. Add all the
`FIREBASE_*` and `GDRIVE_*` values from `.env.example`'s server-side
section, using the values from steps 1 and 3 above. Also set
`VITE_STORAGE_PROVIDER=drive`.

**Important:** paste `private_key` exactly as it appears in the JSON,
including the `\n` sequences — the code un-escapes them automatically.

### 5. Deploy to Vercel
Push to GitHub → Vercel → **Add New > Project** → import repo → add the
env vars above → Deploy. `vercel.json` already handles routing and
`/api` functions are picked up automatically.

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

