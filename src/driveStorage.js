import { auth } from "./firebase";

async function authHeader() {
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export async function driveUpload(file, folderKey) {
  const form = new FormData();
  form.append("file", file);
  form.append("folderKey", folderKey);
  const res = await fetch("/api/drive-upload", { method: "POST", headers: await authHeader(), body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Upload failed");
  return data; // { fileId, name, size, mime }
}

export async function driveDownload(fileId, folderKey, filename) {
  const res = await fetch(`/api/drive-download?fileId=${fileId}&folderKey=${folderKey}`, { headers: await authHeader() });
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export async function driveDelete(fileId, folderKey) {
  const res = await fetch(`/api/drive-delete?fileId=${fileId}&folderKey=${folderKey}`, { method: "DELETE", headers: await authHeader() });
  if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
}
