// The browser's half of the upload seam: the file goes straight to the
// one-time upload URL, not through a Server Action (spec, Phase 2 → Seams:
// Image upload). XMLHttpRequest, because fetch can't report upload progress.

/**
 * PUTs the file to its upload URL, reporting how much has been sent (0 to 1).
 * Rejects when the network fails or the URL refuses the file.
 */
export function putFile(
  url: string,
  file: File,
  onProgress: (sent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("PUT", url);
    request.setRequestHeader("content-type", file.type);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(new Error(`The upload URL answered ${request.status}`));
    request.onerror = () => reject(new Error("The upload didn't reach the server"));
    request.onabort = () => reject(new Error("The upload was stopped"));
    request.send(file);
  });
}

/** A photo's size in pixels, read in the browser, or null when it can't be read. */
export async function measureImage(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return null;
  }
}
