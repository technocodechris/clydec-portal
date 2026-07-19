import { verifyUser, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const drive = getDriveClient();
    const { folder } = req.body;
    const resolved = await resolveFolder(folder, drive);
    if (!resolved) return res.status(400).json({ error: "Folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed" });

    const listRes = await drive.files.list({
      q: `'${resolved.driveId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
      fields: "files(id, name)",
      orderBy: "name",
      pageSize: 1000,
    });
    res.status(200).json({ folders: listRes.data.files || [], rootKey: resolved.rootKey });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
