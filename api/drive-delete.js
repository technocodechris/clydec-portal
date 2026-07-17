import { verifyUser, getDriveClient, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const { fileId, folderKey } = req.query;
    const allowed = FOLDER_ACCESS[folderKey];
    if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
      return res.status(403).json({ error: "Not allowed" });
    }
    const drive = getDriveClient();
    try {
      await drive.files.delete({ fileId });
    } catch (e) {
      const status = e.code || e.response?.status;
      if (status !== 404) throw e; // already gone — that's fine, not an error
    }
    res.status(200).json({ deleted: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
