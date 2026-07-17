import { auth } from "./firebase";

async function authHeader() {
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// Large-file-safe upload: sends the file through our own server in small
// pieces (each safely under Vercel's ~4.5MB request-body cap), which
// relays each piece to Google's resumable upload session. Neither a
// single big request through our server nor a direct-to-Drive browser
// upload works on this platform — this chunked relay is the combination
// that does.
export async function driveUpload(file, folderKey) {
  const initRes = await fetch("/api/drive-upload-init", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ folderKey, name: file.name, mimeType: file.type, size: file.size }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(initData.error || "Could not start upload");

  const CHUNK_SIZE = 4 * 1024 * 1024; // 4MB — safely under Vercel's cap
  const total = file.size;
  let start = 0;
  let finalResult = null;

  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total) - 1;
    const chunk = file.slice(start, end + 1);
    const params = new URLSearchParams({
      uploadUrl: initData.uploadUrl,
      start: String(start),
      end: String(end),
      total: String(total),
    });
    // Fetched fresh each time — a token grabbed once at the start would go
    // stale partway through a long upload (tokens expire after ~1hr).
    const res = await fetch(`/api/drive-upload-chunk?${params.toString()}`, {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/octet-stream" },
      body: chunk,
    });
    if (res.status === 200 || res.status === 201) {
      finalResult = await res.json();
      break;
    } else if (res.status === 308) {
      start = end + 1;
    } else {
      const errText = await res.text();
      throw new Error(`Upload failed at byte ${start}: ${errText}`);
    }
  }
  return { fileId: finalResult.id, name: finalResult.name || file.name, size: total, mime: file.type };
}

// Large-file-safe download: get a short-lived access token, then let the
// browser navigate to Drive directly so it streams to disk the normal way
// instead of buffering the whole file in page memory first.
export async function driveDownload(fileId, folderKey, filename) {
  const res = await fetch(`/api/drive-download-init?folderKey=${folderKey}`, { headers: await authHeader() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Download failed");
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&access_token=${encodeURIComponent(data.accessToken)}`;
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.target = "_blank";
  document.body.appendChild(a); a.click(); a.remove();
}

export async function driveDelete(fileId, folderKey) {
  const res = await fetch(`/api/drive-delete?fileId=${fileId}&folderKey=${folderKey}`, { method: "DELETE", headers: await authHeader() });
  if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
}

// Checks a batch of Drive file IDs and returns the ones that no longer
// exist — e.g. deleted directly in Drive, outside the portal.
export async function driveCheckMissing(fileIds) {
  if (!fileIds.length) return [];
  const res = await fetch("/api/drive-sync", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sync check failed");
  return data.missing;
}
