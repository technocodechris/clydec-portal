import { verifyUser, getDriveClient, resolveFolder, FOLDER_ACCESS, FOLDER_DRIVE_IDS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const { folderId, newName } = req.body;
    if (!newName || !newName.trim()) return res.status(400).json({ error: "New name is required" });
    if (Object.values(FOLDER_DRIVE_IDS).includes(folderId)) {
      return res.status(403).json({ error: "The Wings themselves can't be renamed here" });
    }

    const drive = getDriveClient();
    const resolved = await resolveFolder(folderId, drive);
    if (!resolved) return res.status(400).json({ error: "Folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
      return res.status(403).json({ error: "Not allowed" });
    }

    const updated = await drive.files.update({
      fileId: folderId,
      requestBody: { name: newName.trim() },
      fields: "id, name",
    });
    res.status(200).json({ id: updated.data.id, name: updated.data.name });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
