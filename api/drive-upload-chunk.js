import { verifyUserFast } from "./_driveClient.js";

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
    await verifyUserFast(req); // confirms a valid session; full role check already happened once in drive-upload-init
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
      // "Got this chunk, send the next one." We deliberately do NOT relay
      // Google's raw 308 to the browser — 308 is also the real HTTP
      // "Permanent Redirect" status, and without a Location header (which
      // this response has none of) the browser's fetch() treats it as a
      // broken redirect and fails the request outright. Respond 200 with
      // an explicit "not done yet" marker instead.
      return res.status(200).json({ done: false });
    }
    const text = await googleRes.text();
    if (googleRes.status === 200 || googleRes.status === 201) {
      return res.status(200).json({ done: true, ...JSON.parse(text) });
    }
    // A genuine error from Google — pass it through as-is.
    res.status(googleRes.status).send(text);
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
