import { verifyUser, getAccessToken, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  try {
    const user = await verifyUser(req);
    const { folder } = req.query;
    const drive = getDriveClient();
    const resolved = await resolveFolder(folder, drive);
    if (!resolved) return res.status(400).json({ error: "Folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed" });

    // Short-lived (~1hr) token, scoped to your connected Drive. The browser
    // uses it to fetch the file directly from Google, so multi-GB files
    // stream straight to disk instead of buffering through our function.
    const accessToken = await getAccessToken();
    res.status(200).json({ accessToken });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
