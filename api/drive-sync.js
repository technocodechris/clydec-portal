import { verifyUser, getDriveClient, FOLDER_ACCESS, FOLDER_DRIVE_IDS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const { folderKey, knownFileIds } = req.body;
    const allowed = FOLDER_ACCESS[folderKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed in this folder" });
    if (!Array.isArray(knownFileIds)) return res.status(400).json({ error: "knownFileIds must be an array" });

    const drive = getDriveClient();
    const listRes = await drive.files.list({
      q: `'${FOLDER_DRIVE_IDS[folderKey]}' in parents and trashed = false`,
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

