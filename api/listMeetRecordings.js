import { verifyUserFast, friendlyDriveErrorMessage, getDriveClient } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  
  try {
    await verifyUserFast(req);
    const drive = getDriveClient();

    // 1. Find the "Meet Recordings" folder
    const folderRes = await drive.files.list({
      q: "name='Meet Recordings' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: "files(id, name)",
      spaces: "drive"
    });

    if (!folderRes.data.files || folderRes.data.files.length === 0) {
      return res.status(200).json({ files: [] }); // No recordings folder found
    }

    const folderId = folderRes.data.files[0].id;

    // 2. Fetch all video files inside that folder
    const filesRes = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='video/mp4' and trashed=false`,
      fields: "files(id, name, mimeType, size, createdTime, webViewLink, thumbnailLink)",
      spaces: "drive",
      orderBy: "createdTime desc"
    });

    const files = filesRes.data.files || [];

    res.status(200).json({ files });
  } catch (err) {
    console.error("listMeetRecordings error:", err);
    res.status(err.status || 500).json({ error: friendlyDriveErrorMessage(err) });
  }
}
