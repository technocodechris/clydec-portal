import { verifyUser } from "./_driveClient.js";

// We need the raw binary body, not JSON-parsed — this endpoint receives
// pieces of a file, not structured data.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    await verifyUser(req); // confirms the caller is a real, provisioned workspace user
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
    const text = await googleRes.text();
    // 308 = "got this chunk, send the next one" — Google's normal response
    // mid-upload, not an error. 200/201 = the file is complete.
    res.status(googleRes.status).send(text);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
