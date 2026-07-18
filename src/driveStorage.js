import { auth } from "./firebase";

async function authHeader() {
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

// FAST PATH: ask our server for a token, then have the browser handle
// everything else directly with Google in just two requests total — no
// per-chunk relay round trips. This only works because a single-request
// upload never triggers Google's mid-transfer 308 "continue" response
// (that only happens between chunks), which is the specific thing that
// breaks a plain browser fetch(). Falls through to the proven chunked
// relay below if anything about this path fails.
async function directUpload(file, folderKey, onProgress) {
  const tokenRes = await fetch("/api/drive-upload-token", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ folderKey }),
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(tokenData.error || "Could not get upload token");

  const initRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,size,mimeType",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({ name: file.name, parents: [tokenData.folderId] }),
    }
  );
  if (!initRes.ok) throw new Error(`Direct upload init failed (${initRes.status})`);
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("No session URL returned — falling back");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({ uploaded: e.loaded, total: e.total, percent: (e.loaded / e.total) * 100, speedBps: null, etaSec: null });
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const data = JSON.parse(xhr.responseText);
        resolve({ fileId: data.id, name: data.name || file.name, size: Number(data.size || file.size), mime: data.mimeType });
      } else {
        reject(new Error(`Direct upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Direct upload failed — network or CORS error"));
    xhr.send(file);
  });
}

// FALLBACK PATH (proven, always works): sends the file through our own
// server in small pieces (each safely under Vercel's ~4.5MB request-body
// cap), which relays each piece to Google's resumable upload session.
async function chunkedRelayUpload(file, folderKey, onProgress) {
  const initRes = await fetch("/api/drive-upload-init", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ folderKey, name: file.name, mimeType: file.type, size: file.size }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(initData.error || "Could not start upload");

  const CHUNK_SIZE = 262144 * 17; // 4,456,448 bytes — must be a clean multiple of 256KB per Google's resumable upload spec, and this is the largest such multiple that still fits safely under Vercel's 4.5MB body cap
  const MAX_CONSECUTIVE_FAILURES = 8;
  const total = file.size;
  let start = 0;
  let finalResult = null;
  let consecutiveFailures = 0;
  let lastTickTime = Date.now();
  let lastTickBytes = 0;

  function reportProgress(uploadedBytes) {
    if (!onProgress) return;
    const now = Date.now();
    const elapsedSec = (now - lastTickTime) / 1000;
    const bytesSinceTick = Math.max(0, uploadedBytes - lastTickBytes); // never negative, even right after a reconcile rewinds position
    const speedBps = elapsedSec > 0 ? bytesSinceTick / elapsedSec : 0;
    lastTickTime = now;
    lastTickBytes = uploadedBytes;
    const remainingBytes = Math.max(0, total - uploadedBytes);
    const etaSec = speedBps > 0 ? remainingBytes / speedBps : null;
    onProgress({
      uploaded: Math.min(uploadedBytes, total),
      total,
      percent: Math.min(100, (uploadedBytes / total) * 100),
      speedBps,
      etaSec,
    });
  }

  // Asks Google what it actually has, and corrects `start` to match —
  // called after any failure so we never resend based on a stale guess.
  async function reconcileWithGoogle() {
    const res = await fetch("/api/drive-upload-status", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ uploadUrl: initData.uploadUrl, total }),
    });
    const data = await res.json();
    if (!res.ok || data.expired) throw new Error("Upload session expired or invalid — please retry the upload from the start.");
    if (data.complete) {
      finalResult = data;
      start = total;
    } else {
      start = data.receivedBytes || 0;
    }
  }

  // One unified failure path — no split counters that can starve each
  // other. Every failure (network error, 503, 400, anything) counts
  // against the same budget, backs off, and reconciles position before
  // the next attempt. A clean success resets the counter to zero, so a
  // handful of blips scattered across a multi-GB upload never add up to
  // a false "giving up."
  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total) - 1;
    const chunk = file.slice(start, end + 1);
    const params = new URLSearchParams({
      uploadUrl: initData.uploadUrl,
      start: String(start),
      end: String(end),
      total: String(total),
    });

    let res;
    let networkFailed = false;
    let networkErrMsg = "";
    try {
      // Fetched fresh each time — a token grabbed once at the start would
      // go stale partway through a long upload (~1hr lifetime).
      res = await fetch(`/api/drive-upload-chunk?${params.toString()}`, {
        method: "POST",
        headers: { ...(await authHeader()), "Content-Type": "application/octet-stream" },
        body: chunk,
      });
    } catch (e) {
      networkFailed = true;
      networkErrMsg = e.message;
    }

    if (!networkFailed && res.ok) {
      const data = await res.json();
      const uploadedBytes = end + 1;
      if (data.done) {
        finalResult = data;
        start = total;
      } else {
        start = end + 1;
      }
      consecutiveFailures = 0;
      reportProgress(uploadedBytes);
      continue;
    }

    consecutiveFailures++;
    if (consecutiveFailures > MAX_CONSECUTIVE_FAILURES) {
      const detail = networkFailed ? networkErrMsg : await res.text();
      throw new Error(`Upload failed near byte ${start} after ${MAX_CONSECUTIVE_FAILURES} consecutive failures: ${detail}`);
    }
    await new Promise(r => setTimeout(r, 500 * consecutiveFailures));
    await reconcileWithGoogle();
    reportProgress(start);
  }
  return { fileId: finalResult.id, name: finalResult.name || file.name, size: total, mime: file.type };
}

export async function driveUpload(file, folderKey, onProgress) {
  try {
    const result = await directUpload(file, folderKey, onProgress);
    console.info("[upload] used direct fast path");
    return result;
  } catch (e) {
    console.warn("[upload] direct fast path failed, falling back to relay:", e.message);
    return chunkedRelayUpload(file, folderKey, onProgress);
  }
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
  const res = await fetch(`/api/drive-delete?fileId=${fileId}&folderKey=${folderKey}`, { method: "POST", headers: await authHeader() });
  if (!res.ok) throw new Error((await res.json()).error || "Delete failed");
}

// Reconciles a folder's known files against what's actually in Drive —
// reports files that vanished from Drive (missing) and files that exist
// in Drive but the portal never recorded (added), e.g. dropped in
// directly rather than uploaded through the portal.
export async function driveSyncFolder(folderKey, knownFileIds) {
  const res = await fetch("/api/drive-sync", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ folderKey, knownFileIds }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Sync check failed");
  return data; // { missing: [ids], added: [{id,name,mimeType,size,createdTime}] }
}
