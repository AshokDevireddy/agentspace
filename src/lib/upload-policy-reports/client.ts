// lib/uploads/client.ts
export type SignResponse = {
  signedUrl?: string;
  path?: string;
  error?: string;
};

export async function requestSignedUrl(
  filename: string,
  type: string,
  size: number,
  carrier: string,
): Promise<SignResponse> {
  const res = await fetch("/api/upload-policy-reports/sign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ filename, type, size, carrier }),
  });
  const json = await res.json();
  if (!res.ok || (json as any)?.error) {
    console.error("[sign] failed", {
      status: res.status,
      statusText: res.statusText,
      filename,
      type,
      size,
      carrier,
      response: json,
    });
  } else {
    console.debug("[sign] ok", {
      filename,
      type,
      size,
      carrier,
      path: (json as any)?.path,
      contentType: (json as any)?.contentType,
    });
  }
  return json;
}

/**
 * Upload a File to a signed URL. Returns { ok: boolean, status }
 * Optionally accepts an onProgress callback (uses XHR for progress).
 *
 * NOTE: This uploads a single object to a single signed URL.
 * For large files and automatic chunking, use putToSignedUrlSmart().
 */
export function putToSignedUrl(
  signedUrl: string,
  file: File | Blob,
  onProgress?: (pct: number) => void,
): Promise<{ ok: boolean; status: number }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl, true);
    xhr.setRequestHeader(
      "Content-Type",
      (file as File).type || "application/octet-stream",
    );
    // Helpful for debugging S3 errors
    try {
      xhr.responseType = "text";
    } catch {}

    if (onProgress) {
      xhr.upload.onprogress = (e) => {
        if (!e.lengthComputable) return;
        onProgress(Math.round((e.loaded / e.total) * 100));
      };
    }

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        console.error("[upload] PUT failed", {
          status: xhr.status,
          statusText: xhr.statusText,
          response: xhr.response,
          urlHost: (() => {
            try {
              return new URL(signedUrl).host;
            } catch {
              return "n/a";
            }
          })(),
          contentType: (file as File).type || "application/octet-stream",
          size: (file as File).size ?? (file as Blob).size,
        });
      } else {
        console.debug("[upload] PUT ok", { status: xhr.status });
      }
      resolve({ ok, status: xhr.status });
    };
    xhr.onerror = () => {
      console.error("[upload] network error during upload");
      reject(new Error("Network error during upload"));
    };
    xhr.onabort = () => {
      console.error("[upload] aborted");
      reject(new Error("Upload aborted"));
    };
    xhr.ontimeout = () => {
      console.error("[upload] timeout");
      reject(new Error("Upload timeout"));
    };
    xhr.send(file);
  });
}

/* ---------------------------------- */
/*           Chunking helper          */
/* ---------------------------------- */

/**
 * Split a File into <=5MB chunks (configurable).
 * Returns an array of parts with stable names: "<basename>.part<idx>-of-<total><ext>"
 */
export function chunkFile(
  file: File,
  maxChunkBytes = 5 * 1024 * 1024,
): Array<
  {
    blob: Blob;
    name: string;
    index: number;
    total: number;
    size: number;
    type: string;
  }
> {
  const parts: Array<
    {
      blob: Blob;
      name: string;
      index: number;
      total: number;
      size: number;
      type: string;
    }
  > = [];
  if (file.size <= maxChunkBytes) {
    parts.push({
      blob: file,
      name: file.name,
      index: 0,
      total: 1,
      size: file.size,
      type: file.type || "application/octet-stream",
    });
    return parts;
  }

  const dot = file.name.lastIndexOf(".");
  const base = dot > 0 ? file.name.slice(0, dot) : file.name;
  const ext = dot > 0 ? file.name.slice(dot) : "";

  const total = Math.ceil(file.size / maxChunkBytes);
  let offset = 0;
  for (let i = 0; i < total; i++) {
    const end = Math.min(offset + maxChunkBytes, file.size);
    const blob = file.slice(
      offset,
      end,
      file.type || "application/octet-stream",
    );
    const name = `${base}.part${i + 1}-of-${total}${ext}`;
    parts.push({
      blob,
      name,
      index: i,
      total,
      size: blob.size,
      type: file.type || "application/octet-stream",
    });
    offset = end;
  }
  return parts;
}

/* ---------------------------------- */
/*    Smart uploader (with chunking)  */
/* ---------------------------------- */

/**
 * Uploads a file. If the file is <=5MB, uploads as a single object using the provided filename.
 * If the file is larger, it:
 *  - splits into 5MB chunks,
 *  - requests a *separate* signed URL per chunk (using a predictable chunk filename),
 *  - uploads each chunk,
 *  - reports aggregated progress (0–100).
 *
 * Returns:
 *  - ok: true only if all parts succeed
 *  - status: last HTTP status (or 207 if partial success)
 *  - paths: array of object paths as returned by the sign endpoint (one or many)
 */
export async function putToSignedUrlSmart(
  file: File,
  carrier: string,
  onProgress?: (pct: number) => void,
): Promise<{ ok: boolean; status: number; paths: string[] }> {
  const parts = chunkFile(file);
  const totalBytes = parts.reduce((s, p) => s + p.size, 0);

  let uploadedBytes = 0;
  const paths: string[] = [];
  let allOk = true;
  let lastStatus = 0;

  // helper to update aggregated progress
  const updateProgress = (partLoaded: number, partSize: number) => {
    if (!onProgress) return;
    // We update only when part completes or via per-part progress (optional)
    const pct = Math.min(
      100,
      Math.round(((uploadedBytes + partLoaded) / totalBytes) * 100),
    );
    onProgress(pct);
  };

  // Single small file path
  if (parts.length === 1) {
    // 1) sign once using the original filename
    const sign = await requestSignedUrl(
      file.name,
      file.type || "application/octet-stream",
      file.size,
      carrier,
    );
    if (!sign.signedUrl) {
      console.error("[smart-upload] signing failed for single file", {
        file: file.name,
        type: file.type,
        size: file.size,
        carrier,
        response: sign,
      });
      return { ok: false, status: 400, paths: [] };
    }

    // 2) upload the file
    const res = await putToSignedUrl(
      sign.signedUrl,
      file,
      (pct) => onProgress?.(pct),
    );
    lastStatus = res.status;
    allOk = res.ok;
    if (res.ok && sign.path) paths.push(sign.path);
    return { ok: allOk, status: lastStatus, paths };
  }

  // Chunked path
  for (const part of parts) {
    // 1) sign *per chunk* using the chunk name
    const sign = await requestSignedUrl(
      part.name,
      part.type,
      part.size,
      carrier,
    );
    if (!sign.signedUrl) {
      console.error("[smart-upload] signing failed for chunk", {
        name: part.name,
        idx: part.index + 1,
        total: part.total,
        type: part.type,
        size: part.size,
        carrier,
        response: sign,
      });
      allOk = false;
      lastStatus = 400;
      break;
    }

    // 2) upload this chunk; we can optionally wire fine-grained progress here
    const res = await putToSignedUrl(sign.signedUrl, part.blob, undefined);
    lastStatus = res.status;
    if (!res.ok) {
      console.error("[smart-upload] chunk upload failed", {
        name: part.name,
        idx: part.index + 1,
        total: part.total,
        status: res.status,
      });
      allOk = false;
      break;
    }
    if (sign.path) paths.push(sign.path);

    // 3) advance aggregate progress after each chunk completes
    uploadedBytes += part.size;
    updateProgress(0, part.size); // triggers aggregated pct update (stepwise)
  }

  // Final progress 100%
  onProgress?.(100);

  return { ok: allOk, status: allOk ? lastStatus : 207, /* partial */ paths };
}
