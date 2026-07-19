import { verifyUser, getAccessToken, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

// Mints a short-lived access token + the target Drive folder ID so the
// browser can initiate and complete an upload directly with Google in a
// single request — no chunk relay needed. This only works because a
// single-request upload never produces Google's mid-transfer 308
// "continue" response (that only appears between chunks), which is the
// thing that breaks a plain browser fetch(). Kept as an ADDITIONAL fast
// path — the existing chunked relay (drive-upload-init/chunk/status)
// stays as-is and is used automatically if this fails for any reason.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const { folder } = req.body || {};
    const drive = getDriveClient();
    const resolved = await resolveFolder(folder, drive);
    if (!resolved) return res.status(400).json({ error: "Folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed in this folder" });
    if (user.role === "CLIENT") return res.status(403).json({ error: "Clients can't upload" });

    const accessToken = await getAccessToken();
    res.status(200).json({ accessToken, folderId: resolved.driveId });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
