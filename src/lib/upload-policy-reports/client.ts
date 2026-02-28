/**
 * Upload a File to a signed URL. Returns { ok: boolean, status }
 * Optionally accepts an onProgress callback (uses XHR for progress).
 *
 * NOTE: This uploads a single object to a single signed URL.
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

