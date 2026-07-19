import { verifyUser, getAccessToken, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const user = await verifyUser(req);
    const { folder, name, mimeType, size } = req.body;
    const drive = getDriveClient();
    const resolved = await resolveFolder(folder, drive);
    if (!resolved) return res.status(400).json({ error: "Folder not found" });
    const allowed = FOLDER_ACCESS[resolved.rootKey];
    if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed in this folder" });
    if (user.role === "CLIENT") return res.status(403).json({ error: "Clients can't upload" });

    const accessToken = await getAccessToken();
    const initRes = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": mimeType || "application/octet-stream",
          "X-Upload-Content-Length": String(size),
        },
        body: JSON.stringify({ name, parents: [resolved.driveId] }),
      }
    );
    if (!initRes.ok) {
      const errText = await initRes.text();
      return res.status(initRes.status).json({ error: `Could not start upload: ${errText}` });
    }
    // This is a one-time-use session URL scoped to this exact upload — safe
    // to hand to the browser, which then PUTs the file bytes there directly.
    const uploadUrl = initRes.headers.get("location");
    res.status(200).json({ uploadUrl });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
