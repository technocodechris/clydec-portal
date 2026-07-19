import { verifyUser, verifyUserFast, getAccessToken, getDriveClient, resolveFolder, FOLDER_ACCESS } from "./_driveClient.js";

// Needs the raw body for the "chunk" action (binary file data) — the
// other actions parse their own JSON from the same raw stream below.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function readJson(req) {
  const raw = await readRawBody(req);
  return raw.length ? JSON.parse(raw.toString("utf8")) : {};
}

export default async function handler(req, res) {
  const action = req.query.action;
  try {
    // FAST PATH: mint a token + resolve the target Drive folder so the
    // browser can talk directly to Google in one request.
    if (action === "token") {
      const body = await readJson(req);
      const user = await verifyUser(req);
      const drive = getDriveClient();
      const resolved = await resolveFolder(body.folder, drive);
      if (!resolved) return res.status(400).json({ error: "Folder not found" });
      const allowed = FOLDER_ACCESS[resolved.rootKey];
      if (!allowed || !allowed.includes(user.role)) return res.status(403).json({ error: "Not allowed in this folder" });
      if (user.role === "CLIENT") return res.status(403).json({ error: "Clients can't upload" });
      const accessToken = await getAccessToken();
      return res.status(200).json({ accessToken, folderId: resolved.driveId });
    }

    // RELAY PATH, step 1: open a resumable session server-side.
    if (action === "init") {
      const body = await readJson(req);
      const user = await verifyUser(req);
      const drive = getDriveClient();
      const resolved = await resolveFolder(body.folder, drive);
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
            "X-Upload-Content-Type": body.mimeType || "application/octet-stream",
            "X-Upload-Content-Length": String(body.size),
          },
          body: JSON.stringify({ name: body.name, parents: [resolved.driveId] }),
        }
      );
      if (!initRes.ok) {
        const errText = await initRes.text();
        return res.status(initRes.status).json({ error: `Could not start upload: ${errText}` });
      }
      const uploadUrl = initRes.headers.get("location");
      return res.status(200).json({ uploadUrl });
    }

    // RELAY PATH, step 2: forward one piece of the file to Google.
    if (action === "chunk") {
      await verifyUserFast(req); // full role check already happened once in "init"
      const { uploadUrl, start, end, total } = req.query;
      if (!uploadUrl || !uploadUrl.startsWith("https://www.googleapis.com/upload/drive/")) {
        return res.status(400).json({ error: "Invalid upload URL" });
      }
      const body = await readRawBody(req);
      const googleRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Range": `bytes ${start}-${end}/${total}`,
          "Content-Length": String(body.length),
        },
        body,
      });
      if (googleRes.status === 308) {
        // "Got this chunk, send the next one." Deliberately not relayed
        // as a raw 308 — that's also the real HTTP redirect status, and
        // without a Location header the browser's fetch() treats it as a
        // broken redirect and fails outright.
        return res.status(200).json({ done: false });
      }
      const text = await googleRes.text();
      if (googleRes.status === 200 || googleRes.status === 201) {
        return res.status(200).json({ done: true, ...JSON.parse(text) });
      }
      return res.status(googleRes.status).send(text);
    }

    // Ask Google exactly how many bytes of a session it actually has —
    // used both mid-relay after a hiccup, and when resuming after a reload.
    if (action === "status") {
      const body = await readJson(req);
      await verifyUserFast(req);
      const { uploadUrl, total } = body;
      if (!uploadUrl || !uploadUrl.startsWith("https://www.googleapis.com/upload/drive/")) {
        return res.status(400).json({ error: "Invalid upload URL" });
      }
      const statusRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Range": `bytes */${total}`, "Content-Length": "0" },
      });
      if (statusRes.status === 200 || statusRes.status === 201) {
        const data = await statusRes.json();
        return res.status(200).json({ complete: true, ...data });
      }
      if (statusRes.status === 308) {
        const range = statusRes.headers.get("range");
        const receivedBytes = range ? parseInt(range.split("-")[1], 10) + 1 : 0;
        return res.status(200).json({ complete: false, receivedBytes });
      }
      return res.status(200).json({ expired: true });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
