/**
 * Print-friendly asset label: opens a minimal document holding only the QR
 * image, asset tag and name, sized for a 62 x 40 mm label, and prints it.
 * A separate window (rather than print CSS on the app) keeps the label's
 * @page size from leaking into every other printout in the app.
 */

export interface AssetLabel {
    qrImageSrc: string;
    assetTag?: string | null;
    name: string;
    scanUrl?: string | null;
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch] ?? ch);

/** The label document. Exported for tests; all interpolated text is escaped. */
export function buildLabelHtml(label: AssetLabel): string {
    const tag = label.assetTag ? `<p class="tag">${escapeHtml(label.assetTag)}</p>` : "";
    const title = escapeHtml(label.assetTag || label.name);
    return `<!doctype html>
<html><head><meta charset="utf-8"><title>Label ${title}</title>
<style>
  @page { size: 62mm 40mm; margin: 2mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #000; background: #fff; }
  .label { display: flex; align-items: center; gap: 3mm; width: 58mm; height: 36mm; overflow: hidden; }
  .label img { width: 34mm; height: 34mm; flex: none; image-rendering: pixelated; }
  .text { min-width: 0; }
  .tag { margin: 0 0 1.5mm; font: 700 11pt ui-monospace, "SFMono-Regular", Menlo, monospace; word-break: break-all; }
  .name { margin: 0; font-size: 8pt; line-height: 1.25; max-height: 4.2em; overflow: hidden; }
</style></head>
<body><div class="label">
  <img src="${escapeHtml(label.qrImageSrc)}" alt="QR code">
  <div class="text">${tag}<p class="name">${escapeHtml(label.name)}</p></div>
</div></body></html>`;
}

/** Converts a (possibly blob:) image URL into a self-contained data: URL. */
async function toDataUrl(src: string): Promise<string> {
    if (src.startsWith("data:")) return src;
    const image = new Image();
    image.src = src;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    canvas.getContext("2d")?.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
}

/**
 * Opens the label in a new window and prints it. Resolves false when the
 * browser blocked the pop-up, so the caller can tell the user.
 */
export async function printAssetLabel(label: AssetLabel): Promise<boolean> {
    const popup = window.open("", "_blank", "width=420,height=320");
    if (!popup) return false;
    const qrImageSrc = await toDataUrl(label.qrImageSrc).catch(() => label.qrImageSrc);
    popup.document.open();
    popup.document.write(buildLabelHtml({ ...label, qrImageSrc }));
    popup.document.close();
    const print = () => {
        popup.focus();
        popup.print();
    };
    const img = popup.document.querySelector("img");
    if (img && !img.complete) img.addEventListener("load", print, { once: true });
    else print();
    return true;
}
