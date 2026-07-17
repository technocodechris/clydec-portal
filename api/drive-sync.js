import { verifyUser, getDriveClient } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await verifyUser(req);
    const { fileIds } = req.body;
    if (!Array.isArray(fileIds)) return res.status(400).json({ error: "fileIds must be an array" });

    const drive = getDriveClient();
    const missing = [];
    await Promise.all(
      fileIds.map(async (id) => {
        try {
          await drive.files.get({ fileId: id, fields: "id" });
        } catch (e) {
          const status = e.code || e.response?.status;
          if (status === 404) missing.push(id);
          // Other errors (rate limit, transient network) are left alone —
          // we only want to prune files we're sure are actually gone.
        }
      })
    );
    res.status(200).json({ missing });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
