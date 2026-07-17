import { auth } from "./firebase";

async function authHeader() {
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// Large-file-safe upload: our server only issues a resumable session URL —
// the file bytes go straight from the browser to Google Drive and never
// pass through our serverless function, which caps request bodies far
// below what a multi-GB creative file needs.
export async function driveUpload(file, folderKey) {
  const initRes = await fetch("/api/drive-upload-init", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ folderKey, name: file.name, mimeType: file.type, size: file.size }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(initData.error || "Could not start upload");

  const putRes = await fetch(`/api/drive-upload-stream?uploadUrl=${encodeURIComponent(initData.uploadUrl)}`, {
    method: "PUT",
    headers: { "Content-Type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!putRes.ok) throw new Error("Upload to Drive failed");
  const result = await putRes.json();
  return { fileId: result.id, name: result.name || file.name, size: file.size, mime: file.type };
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
