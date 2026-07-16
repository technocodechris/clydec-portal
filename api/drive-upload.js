import { verifyUser, getDriveClient, FOLDER_ACCESS, FOLDER_DRIVE_IDS } from "./_driveClient.js";
import formidable from "formidable";
import fs from "fs";

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
    const [fields, files] = await form.parse(req);
    const folderKey = fields.folderKey?.[0];
    const allowed = FOLDER_ACCESS[folderKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed in this folder" });
    if (user.role === "CLIENT") return res.status(403).json({ error: "Clients can't upload" });

    const file = files.file?.[0];
    if (!file) return res.status(400).json({ error: "No file received" });

    const drive = getDriveClient();
    const created = await drive.files.create({
      requestBody: { name: file.originalFilename, parents: [FOLDER_DRIVE_IDS[folderKey]] },
      media: { mimeType: file.mimetype, body: fs.createReadStream(file.filepath) },
      fields: "id, name, size, mimeType",
    });

    res.status(200).json({
      fileId: created.data.id,
      name: created.data.name,
      size: Number(created.data.size || file.size),
      mime: created.data.mimeType,
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
