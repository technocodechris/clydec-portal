import { verifyUser, getAccessToken, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    const user = await verifyUser(req);
    const drive = getDriveClient();

    if (action === "delete") {
      const { fileId, folder } = req.query;
      const resolved = await resolveFolder(folder, drive);
      if (!resolved) return res.status(400).json({ error: "Folder not found" });
      const allowed = FOLDER_ACCESS[resolved.rootKey];
      if (!allowed || !allowed.includes(user.role) || user.role === "CLIENT") {
        return res.status(403).json({ error: "Not allowed" });
      }
      try {
        await drive.files.delete({ fileId });
      } catch (e) {
        const status = e.code || e.response?.status;
        if (status !== 404) throw e; // already gone — that's fine, not an error
      }
      return res.status(200).json({ deleted: true });
    }

    if (action === "download-token") {
      const { folder } = req.query;
      const resolved = await resolveFolder(folder, drive);
      if (!resolved) return res.status(400).json({ error: "Folder not found" });
      const allowed = FOLDER_ACCESS[resolved.rootKey];
      if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed" });
      // Short-lived (~1hr) token, scoped to your connected Drive. The
      // browser uses it to fetch the file directly from Google, so
      // multi-GB files stream straight to disk instead of buffering
      // through our function.
      const accessToken = await getAccessToken();
      return res.status(200).json({ accessToken });
    }

    if (action === "sync") {
      const { folder, knownFileIds } = req.body;
      if (!Array.isArray(knownFileIds)) return res.status(400).json({ error: "knownFileIds must be an array" });
      const resolved = await resolveFolder(folder, drive);
      if (!resolved) return res.status(400).json({ error: "Folder not found" });
      const allowed = FOLDER_ACCESS[resolved.rootKey];
      if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed in this folder" });

      const listRes = await drive.files.list({
        // Excludes subfolders — those are handled by drive-folder-manage,
        // not treated as files needing their own Firestore records.
        q: `'${resolved.driveId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
        fields: "files(id, name, mimeType, size, createdTime)",
        pageSize: 1000,
      });
      const driveFiles = listRes.data.files || [];
      const driveIds = new Set(driveFiles.map((f) => f.id));
      const knownSet = new Set(knownFileIds);
      const missing = knownFileIds.filter((id) => !driveIds.has(id));
      const added = driveFiles.filter((f) => !knownSet.has(f.id));
      return res.status(200).json({ missing, added });
    }

    if (action === "quota") {
      if (user.role !== "OWNER") return res.status(403).json({ error: "Owner only" });
      const about = await drive.about.get({ fields: "storageQuota" });
      const q = about.data.storageQuota || {};
      return res.status(200).json({
        limit: q.limit != null ? Number(q.limit) : null, // null = unlimited plan
        usage: Number(q.usage || 0),
        usageInDrive: Number(q.usageInDrive || 0),
        usageInDriveTrash: Number(q.usageInDriveTrash || 0),
      });
    }

    if (action === "verify-files") {
      const { fileIds } = req.body;
      if (!Array.isArray(fileIds)) return res.status(400).json({ error: "fileIds must be an array" });
      const missing = [];
      await Promise.all(
        fileIds.map(async (id) => {
          try {
            const meta = await drive.files.get({ fileId: id, fields: "id, trashed" });
            if (meta.data.trashed) missing.push(id);
          } catch (e) {
            missing.push(id); // not found / no access — treat as gone
          }
        })
      );
      return res.status(200).json({ missing });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
