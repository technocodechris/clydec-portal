import { verifyUser, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const { folder, knownFileIds } = req.body;
    const drive = getDriveClient();
    const resolved = await resolveFolder(folder, drive);
    if (!resolved) return res.status(400).json({ error: "Folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed in this folder" });
    if (!Array.isArray(knownFileIds)) return res.status(400).json({ error: "knownFileIds must be an array" });

    const listRes = await drive.files.list({
      // Excludes subfolders — those are handled by drive-folder-list, not
      // treated as files needing their own Firestore records.
      q: `'${resolved.driveId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
      fields: "files(id, name, mimeType, size, createdTime)",
      pageSize: 1000,
    });
    const driveFiles = listRes.data.files || [];
    const driveIds = new Set(driveFiles.map((f) => f.id));
    const knownSet = new Set(knownFileIds);

    const missing = knownFileIds.filter((id) => !driveIds.has(id));
    const added = driveFiles.filter((f) => !knownSet.has(f.id));

    res.status(200).json({ missing, added });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
