import { verifyUser, getDriveClient, resolveFolder, FOLDER_ACCESS, FOLDER_DRIVE_IDS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const { folderId } = req.body;
    if (Object.values(FOLDER_DRIVE_IDS).includes(folderId)) {
      return res.status(403).json({ error: "The Wings themselves can't be deleted here" });
    }

    const drive = getDriveClient();
    const resolved = await resolveFolder(folderId, drive);
    if (!resolved) return res.status(400).json({ error: "Folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
      return res.status(403).json({ error: "Not allowed" });
    }

    // Moves to Trash (recoverable for 30 days in Drive), not a permanent
    // delete — matches how deleting a folder in Drive's own UI behaves.
    // Everything inside it (subfolders and files) goes to Trash with it.
    await drive.files.update({ fileId: folderId, requestBody: { trashed: true } });
    res.status(200).json({ deleted: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
