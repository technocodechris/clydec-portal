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
// caller's workspace role and allowed folders by looking up their Firestore profile.
export async function verifyUser(req) {
  initAdmin();
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw Object.assign(new Error("Missing auth token"), { status: 401 });
  const decoded = await admin.auth().verifyIdToken(token);
  const snap = await admin.firestore().collection("users").doc(decoded.uid).get();
  if (!snap.exists) throw Object.assign(new Error("No workspace profile"), { status: 403 });
  
  const data = snap.data();
  return { 
    uid: decoded.uid, 
    role: data.role, 
    allowedFolders: data.allowedFolders || [] 
  };
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

export function getCalendarClient() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GDRIVE_CLIENT_ID,
    process.env.GDRIVE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ refresh_token: process.env.GDRIVE_REFRESH_TOKEN });
  return google.calendar({ version: "v3", auth: oauth2Client });
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

// Google's OAuth failures come back as terse codes (e.g. "invalid_grant")
// that mean nothing to someone reading the Dashboard or an upload error
// toast — they just see a cryptic string with no idea what to do next.
// These specific codes all mean the same thing in this app's setup: the
// one-time authorization behind GDRIVE_REFRESH_TOKEN has expired or been
// revoked (common causes: 6+ months of no use, the connected Google
// account's password changed, or access was revoked from myaccount.google.com)
// and needs to be redone. Everything else is passed through as-is.
export function friendlyDriveErrorMessage(err) {
  const raw = (err && err.message) || String(err);
  if (/invalid_grant|invalid_client|unauthorized_client/i.test(raw)) {
    return "Google Drive's connection has expired or been revoked. The workspace Admin needs to redo the one-time Google authorization and update GDRIVE_REFRESH_TOKEN in Vercel's environment variables.";
  }
  return raw;
}

// This check governs security — the client-side canAccessFolder in App.jsx
// must mirror this logic. Granular per-user folder access array is checked.
export function canAccessFolder(user, rootKey) {
  if (user.role === "ADMIN" || user.role === "OWNER") return true;
  return user.allowedFolders && user.allowedFolders.includes(rootKey);
}

// Each value is the Drive folder ID for a folder you created in your own
// Drive (see README "Google Drive setup") — no sharing step needed since
// it's all in your account already.
export const FOLDER_DRIVE_IDS = {
  operations: process.env.GDRIVE_FOLDER_OPERATIONS,
  marketing: process.env.GDRIVE_FOLDER_MARKETING,
  pr: process.env.GDRIVE_FOLDER_PR,
  multimedia: process.env.GDRIVE_FOLDER_MULTIMEDIA,
  sales: process.env.GDRIVE_FOLDER_SALES,
  company_admin: process.env.GDRIVE_FOLDER_COMPANY_ADMIN,
};

// Accepts either one of the 6 fixed root keys or a raw Drive
// folder ID, and resolves both the actual Drive folder ID to operate on and
// which Department's role list governs it — by walking Drive's own parent chain
// rather than maintaining a separate folder database that could drift out of sync.
// A subfolder's access is always inherited from whichever Department it's nested under,
// however deep; there's no separate per-subfolder permission to manage.
export async function resolveFolder(folderParam, drive) {
  if (!folderParam) return null;
  if (Object.prototype.hasOwnProperty.call(FOLDER_DRIVE_IDS, folderParam)) {
    // It's meant to be one of the fixed root folders.
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
  return null; // too deep, or not actually under any known Department
}
