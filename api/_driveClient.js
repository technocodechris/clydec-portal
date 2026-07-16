// Shared by the /api/drive-* serverless functions. Runs server-side only —
// never imported by src/ (browser) code. Holds the two secrets that must
// never reach the client: the Firebase Admin service account and the
// Google Drive service account.
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

export function getDriveClient() {
  const auth = new google.auth.JWT(
    process.env.GDRIVE_CLIENT_EMAIL,
    null,
    (process.env.GDRIVE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/drive"]
  );
  return google.drive({ version: "v3", auth });
}

// Mirrors SEED_FOLDERS access in src/App.jsx — keep both in sync.
export const FOLDER_ACCESS = {
  creative: ["OWNER", "ADMIN", "EMPLOYEE"],
  data: ["OWNER", "ADMIN", "EMPLOYEE"],
  finance: ["OWNER", "ADMIN"],
  "client-aurora": ["OWNER", "ADMIN", "CLIENT"],
};

// Each value is the Drive folder ID you created and shared with the
// service account (see README "Google Drive setup").
export const FOLDER_DRIVE_IDS = {
  creative: process.env.GDRIVE_FOLDER_CREATIVE,
  data: process.env.GDRIVE_FOLDER_DATA,
  finance: process.env.GDRIVE_FOLDER_FINANCE,
  "client-aurora": process.env.GDRIVE_FOLDER_CLIENT_AURORA,
};
