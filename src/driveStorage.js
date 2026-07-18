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
export async function driveUpload(file, folderKey, onProgress) {
  const initRes = await fetch("/api/drive-upload-init", {
    method: "POST",
    headers: { ...(await authHeader()), "Content-Type": "application/json" },
    body: JSON.stringify({ folderKey, name: file.name, mimeType: file.type, size: file.size }),
  });
  const initData = await initRes.json();
  if (!initRes.ok) throw new Error(initData.error || "Could not start upload");

  const CHUNK_SIZE = Math.floor(4.2 * 1024 * 1024); // whole bytes only — fractional values break Content-Range
  const MAX_RETRIES = 5;
  const total = file.size;
  let start = 0;
  let finalResult = null;
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
    onProgress({
      uploaded: Math.min(uploadedBytes, total),
      total,
      percent: Math.min(100, (uploadedBytes / total) * 100),
      speedBps,
    });
  }

  // Asks Google what it actually has, and corrects `start` to match —
  // used after any failure so we never resend based on a stale guess.
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
    reportProgress(start);
  }

  while (start < total) {
    const end = Math.min(start + CHUNK_SIZE, total) - 1;
    const chunk = file.slice(start, end + 1);
    const params = new URLSearchParams({
      uploadUrl: initData.uploadUrl,
      start: String(start),
      end: String(end),
      total: String(total),
    });

    let attempt = 0;
    let handled = false;
    while (!handled) {
      let res;
      try {
        // Fetched fresh each time — a token grabbed once at the start
        // would go stale partway through a long upload (~1hr lifetime).
        res = await fetch(`/api/drive-upload-chunk?${params.toString()}`, {
          method: "POST",
          headers: { ...(await authHeader()), "Content-Type": "application/octet-stream" },
          body: chunk,
        });
      } catch (networkErr) {
        attempt++;
        if (attempt > MAX_RETRIES) throw new Error(`Upload failed near byte ${start} after ${MAX_RETRIES} retries: ${networkErr.message}`);
        await new Promise(r => setTimeout(r, 500 * attempt));
        continue; // plain retry of the same range — no reconcile needed for a raw network blip
      }

      if (res.ok) {
        const data = await res.json();
        const uploadedBytes = end + 1;
        if (data.done) {
          finalResult = data;
          start = total;
        } else {
          start = end + 1;
        }
        handled = true;
        reportProgress(uploadedBytes);
      } else if (res.status >= 500 || res.status === 429) {
        // Transient — Google's own guidance for 503 is simply "retry the
        // same request." No position drift here, so no need for the
        // heavier reconcile round-trip.
        attempt++;
        if (attempt > MAX_RETRIES) {
          const errText = await res.text();
          throw new Error(`Upload failed near byte ${start} after ${MAX_RETRIES} retries: ${errText}`);
        }
        await new Promise(r => setTimeout(r, 500 * attempt));
      } else if (res.status === 400) {
        // A real position mismatch (e.g. after a prior hiccup left our
        // bookkeeping out of sync with Google's) — this is the one case
        // that actually needs reconciling before retrying.
        attempt++;
        if (attempt > MAX_RETRIES) {
          const errText = await res.text();
          throw new Error(`Upload failed near byte ${start} after ${MAX_RETRIES} retries: ${errText}`);
        }
        await reconcileWithGoogle();
        handled = true;
      } else {
        const errText = await res.text();
        throw new Error(`Upload failed at byte ${start}: ${errText}`);
      }
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
