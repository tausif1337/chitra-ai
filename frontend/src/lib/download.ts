/**
 * Downloading a generated image (PRD FR-08).
 *
 * The image is served from the API origin, so a plain `download` attribute is
 * ignored cross-origin and the browser navigates to the file instead. Fetching
 * it into a blob first is what makes the filename stick.
 */

export async function downloadImage(url: string, filename: string): Promise<void> {
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`);

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke on the next frame; revoking synchronously can cancel the download.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}
