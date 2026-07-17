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
