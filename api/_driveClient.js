// Shared by the /api/drive-* serverless functions. Runs server-side only —
// never imported by src/ (browser) code. Holds the two secrets that must
// never reach the client: the Firebase Admin service account and the
// Google OAuth client (delegated to the founder's own Drive).
import admin from "firebase-admin";
import { google } from "googleapis";

let inited = false;
function initAdmin() {
  if (inited) return;
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
  inited = true;
}

// Confirms the request carries a valid Firebase ID token and returns the
// caller's workspace role by looking up their Firestore profile.
export async function verifyUser(req) {
  initAdmin();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw Object.assign(new Error("Missing auth token"), { status: 401 });
  const decoded = await admin.auth().verifyIdToken(token);
  const snap = await admin.firestore().collection("users").doc(decoded.uid).get();
  if (!snap.exists) throw Object.assign(new Error("No workspace profile"), { status: 403 });
  return { uid: decoded.uid, role: snap.data().role };
}

// A lighter check for high-frequency endpoints (the per-chunk upload
// relay, called 1,000+ times for a large file) — confirms the token
// itself is valid without the extra Firestore round-trip on every call.
// Safe here because the full role/folder check already happened once in
// drive-upload-init before this session URL was ever issued.
export async function verifyUserFast(req) {
  initAdmin();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw Object.assign(new Error("Missing auth token"), { status: 401 });
  const decoded = await admin.auth().verifyIdToken(token);
  return { uid: decoded.uid };
}

// Files uploaded through this land directly in the founder's own Google
// Drive (using the refresh token from the one-time OAuth authorization) —
// not a service account, since personal Gmail accounts don't get Drive
// storage quota for service accounts. The googleapis client auto-refreshes
// the access token from this refresh token as needed.
export function getDriveClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GDRIVE_REFRESH_TOKEN });
  return google.drive({ version: "v3", auth: oauth2Client });
}

// A short-lived (~1hr) access token, minted fresh from the refresh token.
// Used to let the browser talk to Google directly for large file transfers,
// instead of routing bytes through our serverless function.
export async function getAccessToken() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GDRIVE_REFRESH_TOKEN });
  const { token } = await oauth2Client.getAccessToken();
  return token;
}

// Mirrors SEED_FOLDERS access in src/App.jsx — keep both in sync.
export const FOLDER_ACCESS = {
  creative: ["OWNER", "ADMIN", "EMPLOYEE"],
  data: ["OWNER", "ADMIN", "EMPLOYEE"],
  finance: ["OWNER", "ADMIN"],
  "client-aurora": ["OWNER", "ADMIN", "CLIENT"],
};

// Each value is the Drive folder ID for a folder you created in your own
// Drive (see README "Google Drive setup") — no sharing step needed since
// it's all in your account already.
export const FOLDER_DRIVE_IDS = {
  creative: process.env.GDRIVE_FOLDER_CREATIVE,
  data: process.env.GDRIVE_FOLDER_DATA,
  finance: process.env.GDRIVE_FOLDER_FINANCE,
  "client-aurora": process.env.GDRIVE_FOLDER_CLIENT_AURORA,
};

// Accepts either one of the 4 fixed Wing keys ("creative") or a raw Drive
// folder ID (a subfolder created inside a Wing), and resolves both the
// actual Drive folder ID to operate on and which Wing's role list governs
// it — by walking Drive's own parent chain rather than maintaining a
// separate folder database that could drift out of sync. A subfolder's
// access is always inherited from whichever Wing it's nested under,
// however deep; there's no separate per-subfolder permission to manage.
export async function resolveFolder(folderParam, drive) {
  if (!folderParam) return null;
  if (Object.prototype.hasOwnProperty.call(FOLDER_ACCESS, folderParam)) {
    // It's meant to be one of the 4 fixed Wings.
    const driveId = FOLDER_DRIVE_IDS[folderParam];
    if (!driveId) {
      throw Object.assign(
        new Error(`Server misconfiguration: no Drive folder ID is set for "${folderParam}" — check the matching GDRIVE_FOLDER_* environment variable in Vercel.`),
        { status: 500 }
      );
    }
    return { driveId, rootKey: folderParam };
  }
  let currentId = folderParam;
  for (let i = 0; i < 20; i++) { // safety cap against pathological/cyclic parent chains
    let meta;
    try {
      meta = await drive.files.get({ fileId: currentId, fields: "id, parents" });
    } catch (e) {
      return null; // folder doesn't exist / no access
    }
    const parents = meta.data.parents || [];
    if (parents.length === 0) return null;
    const parentId = parents[0];
    for (const [key, id] of Object.entries(FOLDER_DRIVE_IDS)) {
      if (id === parentId) return { driveId: folderParam, rootKey: key };
    }
    currentId = parentId;
  }
  return null; // too deep, or not actually under any known Wing
}
