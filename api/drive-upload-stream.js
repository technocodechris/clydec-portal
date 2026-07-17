// Runs on Vercel's Edge runtime (not the regular Node serverless runtime),
// which streams request bodies instead of buffering them — so it isn't
// subject to the ~4.5MB body cap that blocked large files before. The
// browser PUTs the file to this same-origin endpoint (avoiding Drive's
// CORS restriction), and this simply relays the stream on to the
// resumable session URL that /api/drive-upload-init already authorized.
export const config = { runtime: "edge" };

export default async function handler(req) {
  const url = new URL(req.url);
  const uploadUrl = url.searchParams.get("uploadUrl");

  if (!uploadUrl || !uploadUrl.startsWith("https://www.googleapis.com/upload/drive/")) {
    return new Response(JSON.stringify({ error: "Invalid or missing upload URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const googleRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": req.headers.get("content-type") || "application/octet-stream" },
      body: req.body,
      duplex: "half",
    });
    const text = await googleRes.text();
    return new Response(text, {
      status: googleRes.status,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
