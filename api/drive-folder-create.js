import { verifyUser, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const drive = getDriveClient();
    const { folder, name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Folder name is required" });

    const resolved = await resolveFolder(folder, drive);
    if (!resolved) return res.status(400).json({ error: "Parent folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
      return res.status(403).json({ error: "Not allowed" });
    }

    const created = await drive.files.create({
      requestBody: {
        name: name.trim(),
        mimeType: "application/vnd.google-apps.folder",
        parents: [resolved.driveId],
      },
      fields: "id, name",
    });
    res.status(200).json({ id: created.data.id, name: created.data.name });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
