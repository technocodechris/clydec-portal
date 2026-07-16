import { verifyUser, getDriveClient, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  try {
    const user = await verifyUser(req);
    const { fileId, folderKey } = req.query;
    const allowed = FOLDER_ACCESS[folderKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed" });

    const drive = getDriveClient();
    const meta = await drive.files.get({ fileId, fields: "name, mimeType" });
    const stream = await drive.files.get({ fileId, alt: "media" }, { responseType: "stream" });

    res.setHeader("Content-Disposition", `attachment; filename="${meta.data.name}"`);
    res.setHeader("Content-Type", meta.data.mimeType || "application/octet-stream");
    stream.data.pipe(res);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
