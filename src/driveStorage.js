import { auth } from "./firebase";

async function authHeader() {
  const token = await auth.currentUser.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/* ------------------------------------------------------------------ */
/* Persisting an in-progress upload so a page reload doesn't lose it   */
/* ------------------------------------------------------------------ */
const PENDING_KEY = "clydec-pending-upload";

function savePendingUpload(record) {
  try { localStorage.setItem(PENDING_KEY, JSON.stringify(record)); } catch (e) { /* storage full/unavailable — non-fatal */ }
}
export function getPendingUpload() {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}
export function clearPendingUpload() {
  try { localStorage.removeItem(PENDING_KEY); } catch (e) { /* non-fatal */ }
}

// FAST PATH: ask our server for a token, then have the browser handle
// everything else directly with Google in just two requests total — no
// per-chunk relay round trips. This only works because a single-request
// upload never triggers Google's mid-transfer 308 "continue" response
// (that only happens between chunks), which is the specific thing that
// breaks a plain browser fetch(). Falls through to the proven chunked
// relay below if anything about this path fails.
async function directUpload(file, folderKey, onProgress, signal, onSessionReady) {
  const tokenRes = await fetch("/api/drive-upload-token", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ folderKey }),
    signal,
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
      signal,
    }
  );
  if (!initRes.ok) throw new Error(`Direct upload init failed (${initRes.status})`);
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) throw new Error("No session URL returned — falling back");

  // The session now exists on Google's side regardless of what happens
  // next — record it so a reload can still recover and resume.
  onSessionReady?.(uploadUrl);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    if (signal) {
      if (signal.aborted) { xhr.abort(); return reject(new DOMException("Upload cancelled", "AbortError")); }
      signal.addEventListener("abort", () => xhr.abort());
    }
    let lastTickTime = Date.now();
    let lastTickBytes = 0;
    xhr.upload.onprogress = (e) => {
      if (!e.lengthComputable || !onProgress) return;
      const now = Date.now();
      const elapsedSec = (now - lastTickTime) / 1000;
      const bytesSinceTick = Math.max(0, e.loaded - lastTickBytes);
      const speedBps = elapsedSec > 0.15 ? bytesSinceTick / elapsedSec : null; // skip too-frequent ticks for a stabler reading
      if (speedBps !== null) { lastTickTime = now; lastTickBytes = e.loaded; }
      const remainingBytes = Math.max(0, e.total - e.loaded);
      const etaSec = speedBps ? remainingBytes / speedBps : null;
      onProgress({ uploaded: e.loaded, total: e.total, percent: (e.loaded / e.total) * 100, speedBps, etaSec });
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
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    xhr.send(file);
  });
}

// FALLBACK PATH (proven, always works): sends the file through our own
// server in small pieces (each safely under Vercel's ~4.5MB request-body
// cap), which relays each piece to Google's resumable upload session.
// If `existingUploadUrl` is passed (resuming after a reload), skips
// starting a new session and instead asks Google where the old one left
// off before continuing.
async function chunkedRelayUpload(file, folderKey, onProgress, signal, existingUploadUrl, onSessionReady) {
  let uploadUrl = existingUploadUrl;
  if (!uploadUrl) {
    const initRes = await fetch("/api/drive-upload-init", {
      method: "POST",
      headers: { ...(await authHeader()), "Content-Type": "application/json" },
      body: JSON.stringify({ folderKey, name: file.name, mimeType: file.type, size: file.size }),
      signal,
    });
    const initData = await initRes.json();
    if (!initRes.ok) throw new Error(initData.error || "Could not start upload");
    uploadUrl = initData.uploadUrl;
    onSessionReady?.(uploadUrl);
  }

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
  // called after any failure (or right away, when resuming from a
  // reload) so we never resend based on a stale guess. Has its own small
  // retry budget — a hiccup on this one specific call shouldn't be able
  // to kill an otherwise-recoverable upload.
  async function reconcileWithGoogle() {
    let lastErr;
    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch("/api/drive-upload-status", {
          method: "POST",
          headers: { ...(await authHeader()), "Content-Type": "application/json" },
          body: JSON.stringify({ uploadUrl, total }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Status check failed");
        if (data.expired) throw new Error("Upload session expired or invalid — please start this upload over.");
        if (data.complete) {
          finalResult = data;
          start = total;
        } else {
          start = data.receivedBytes || 0;
        }
        return;
      } catch (e) {
        lastErr = e;
        if (e.message.includes("expired")) throw e; // no point retrying a truly dead session
        await new Promise(r => setTimeout(r, 800 * (i + 1)));
      }
    }
    throw lastErr;
  }

  if (existingUploadUrl) {
    await reconcileWithGoogle();
    reportProgress(start);
  }

  // One unified failure path — no split counters that can starve each
  // other. Every failure (network error, 503, 400, anything) counts
  // against the same budget, backs off, and reconciles position before
  // the next attempt. A clean success resets the counter to zero, so a
  // handful of blips scattered across a multi-GB upload never add up to
  // a false "giving up."
  while (start < total) {
    if (signal?.aborted) throw new DOMException("Upload cancelled", "AbortError");
    const end = Math.min(start + CHUNK_SIZE, total) - 1;
    const chunk = file.slice(start, end + 1);
    const params = new URLSearchParams({
      uploadUrl,
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
        signal,
      });
    } catch (e) {
      if (e.name === "AbortError") throw e;
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

// `resumeInfo`, when provided (after finding a pending record left over
// from before a reload), skips straight to the relay path using the
// already-open session instead of starting fresh.
export async function driveUpload(file, folderKey, onProgress, signal, resumeInfo) {
  const onSessionReady = (uploadUrl) => {
    savePendingUpload({ uploadUrl, folderKey, fileName: file.name, fileSize: file.size, mimeType: file.type, startedAt: Date.now() });
  };

  if (resumeInfo) {
    try {
      const result = await chunkedRelayUpload(file, folderKey, onProgress, signal, resumeInfo.uploadUrl, onSessionReady);
      clearPendingUpload();
      return result;
    } catch (e) {
      if (e.name === "AbortError") clearPendingUpload();
      throw e;
    }
  }

  try {
    const result = await directUpload(file, folderKey, onProgress, signal, onSessionReady);
    console.info("[upload] used direct fast path");
    clearPendingUpload();
    return result;
  } catch (e) {
    if (e.name === "AbortError") { clearPendingUpload(); throw e; } // a real cancel — don't fall back, just stop
    console.warn("[upload] direct fast path failed, falling back to relay:", e.message);
    try {
      const result = await chunkedRelayUpload(file, folderKey, onProgress, signal, undefined, onSessionReady);
      clearPendingUpload();
      return result;
    } catch (e2) {
      if (e2.name === "AbortError") clearPendingUpload();
      throw e2;
    }
  }
}

// Large-file-safe download: get a short-lived access token, then fetch
// the file with it in an Authorization header (never as a URL query
// param — Google's abuse-detection systems specifically flag that
// pattern, since tokens-in-URLs are insecure and increasingly blocked).
// Streams straight to disk in browsers that support it, avoiding
// buffering multi-GB files fully in page memory; falls back to a
// Blob-based download elsewhere.
export async function driveDownload(fileId, folderKey, filename) {
  const res = await fetch(`/api/drive-download-init?folderKey=${folderKey}`, { headers: await authHeader() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Download failed");

  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${data.accessToken}` },
  });
  if (!driveRes.ok) throw new Error(`Download failed (${driveRes.status})`);

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({ suggestedName: filename });
      const writable = await handle.createWritable();
      await driveRes.body.pipeTo(writable);
      return;
    } catch (e) {
      if (e.name === "AbortError") return; // user cancelled the save dialog — not an error
      // any other failure here falls through to the Blob method below
    }
  }
  const blob = await driveRes.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
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
