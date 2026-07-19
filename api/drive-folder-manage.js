import { verifyUser, getDriveClient, resolveFolder, FOLDER_ACCESS, FOLDER_DRIVE_IDS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  const action = req.query.action;
  try {
    const user = await verifyUser(req);
    const drive = getDriveClient();

    if (action === "list") {
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
      return res.status(200).json({ folders: listRes.data.files || [], rootKey: resolved.rootKey });
    }

    if (action === "create") {
      const { folder, name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: "Folder name is required" });
      const resolved = await resolveFolder(folder, drive);
      if (!resolved) return res.status(400).json({ error: "Parent folder not found" });
      const allowed = FOLDER_ACCESS[resolved.rootKey];
      if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
        return res.status(403).json({ error: "Not allowed" });
      }
      const created = await drive.files.create({
        requestBody: { name: name.trim(), mimeType: "application/vnd.google-apps.folder", parents: [resolved.driveId] },
        fields: "id, name",
      });
      return res.status(200).json({ id: created.data.id, name: created.data.name });
    }

    if (action === "rename") {
      const { folderId, newName } = req.body;
      if (!newName || !newName.trim()) return res.status(400).json({ error: "New name is required" });
      if (Object.values(FOLDER_DRIVE_IDS).includes(folderId)) {
        return res.status(403).json({ error: "The Wings themselves can't be renamed here" });
      }
      const resolved = await resolveFolder(folderId, drive);
      if (!resolved) return res.status(400).json({ error: "Folder not found" });
      const allowed = FOLDER_ACCESS[resolved.rootKey];
      if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
        return res.status(403).json({ error: "Not allowed" });
      }
      const updated = await drive.files.update({ fileId: folderId, requestBody: { name: newName.trim() }, fields: "id, name" });
      return res.status(200).json({ id: updated.data.id, name: updated.data.name });
    }

    if (action === "delete") {
      const { folderId } = req.body;
      if (Object.values(FOLDER_DRIVE_IDS).includes(folderId)) {
        return res.status(403).json({ error: "The Wings themselves can't be deleted here" });
      }
      const resolved = await resolveFolder(folderId, drive);
      if (!resolved) return res.status(400).json({ error: "Folder not found" });
      const allowed = FOLDER_ACCESS[resolved.rootKey];
      if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
        return res.status(403).json({ error: "Not allowed" });
      }
      // Moves to Trash (recoverable for 30 days), not a permanent delete —
      // matches how deleting a folder in Drive's own UI behaves.
      await drive.files.update({ fileId: folderId, requestBody: { trashed: true } });
      return res.status(200).json({ deleted: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
