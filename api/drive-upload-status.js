import { verifyUserFast } from "./_driveClient.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await verifyUserFast(req);
    const { uploadUrl, total } = req.body;
    if (!uploadUrl || !uploadUrl.startsWith("https://www.googleapis.com/upload/drive/")) {
      return res.status(400).json({ error: "Invalid upload URL" });
    }

    // The documented way to ask a resumable session "what have you
    // actually got so far" — an empty PUT with a wildcard Content-Range.
    const statusRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Range": `bytes */${total}`,
        "Content-Length": "0",
      },
    });

    if (statusRes.status === 200 || statusRes.status === 201) {
      const data = await statusRes.json();
      return res.status(200).json({ complete: true, ...data });
    }
    if (statusRes.status === 308) {
      const range = statusRes.headers.get("range"); // e.g. "bytes=0-4194303"
      const receivedBytes = range ? parseInt(range.split("-")[1], 10) + 1 : 0;
      return res.status(200).json({ complete: false, receivedBytes });
    }
    // 404/410 etc — the session itself is gone (expired or truly invalid).
    return res.status(200).json({ expired: true });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
