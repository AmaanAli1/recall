/**
 * Client-side file checks for the Library drop zone.
 * These are for UX only (fast, friendly messages). The server re-checks every
 * file, starting with the PDF magic bytes, because the browser can be bypassed.
 */

/**
 * The demo's size limit per PDF, for now. Every upload is parsed and embedded
 * on a small server at the project's cost, so big files are refused up front.
 * This check is for UX only: the real upload API (still to build) must refuse
 * files over the same limit, because the browser can be bypassed.
 */
export const MAX_PDF_MB = 25;
export const MAX_PDF_BYTES = MAX_PDF_MB * 1024 * 1024;

/**
 * "48 MB", "25.3 MB", "0.4 MB". Rounded UP (one decimal under 100 MB), so a
 * file over the limit never reads as "25 MB" next to "over the 25 MB limit".
 * The tiny epsilon stops float noise turning an exact 0.4 into 0.5.
 */
export function formatSize(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  const shown = mb >= 100 ? String(Math.ceil(mb - 1e-9)) : String(Math.ceil(mb * 10 - 1e-9) / 10);
  return `${shown} MB`;
}

export function isTooBig(size = 0): boolean {
  return size > MAX_PDF_BYTES;
}

export function isPdf(name: string, type = ""): boolean {
  return type === "application/pdf" || /\.pdf$/i.test(name);
}

const KINDS: Record<string, string> = {
  doc: "Word document", docx: "Word document",
  ppt: "PowerPoint", pptx: "PowerPoint", key: "Keynote", pages: "Pages document",
  png: "Image", jpg: "Image", jpeg: "Image", heic: "Image", gif: "Image", webp: "Image",
  txt: "Text file", md: "Text file", rtf: "Text file",
  xls: "Spreadsheet", xlsx: "Spreadsheet", csv: "Spreadsheet",
  zip: "Archive", mp4: "Video", mov: "Video", mp3: "Audio", m4a: "Audio",
};

/** A plain-words description of what a non-PDF file is. */
export function kindOf(name: string, type = ""): string {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] ?? "").toLowerCase();
  if (KINDS[ext]) return KINDS[ext];
  if (type.startsWith("image/")) return "Image";
  if (!ext) return type === "" ? "Folder or unknown" : "Unknown type";
  return `.${ext} file`;
}

/** Why a file was skipped: not a PDF, or a PDF over the size limit. */
export type SkipReason = "type" | "size";

export interface SplitResult<T> {
  accepted: T[];
  /** `kind` is the label shown next to the name: "PowerPoint", or "48 MB" for a big PDF. */
  rejected: { file: T; kind: string; reason: SkipReason }[];
}

/** Split dropped files into PDFs to upload and everything else to explain. */
export function splitFiles<T extends { name: string; type: string; size?: number }>(files: T[]): SplitResult<T> {
  const accepted: T[] = [];
  const rejected: SplitResult<T>["rejected"] = [];
  for (const f of files) {
    if (!isPdf(f.name, f.type)) rejected.push({ file: f, kind: kindOf(f.name, f.type), reason: "type" });
    else if (isTooBig(f.size)) rejected.push({ file: f, kind: formatSize(f.size ?? 0), reason: "size" });
    else accepted.push(f);
  }
  return { accepted, rejected };
}

/** While dragging (before drop) only MIME types are visible, not names. */
export function dragVerdict(items: { kind: string; type: string }[]): "ok" | "bad" {
  const files = items.filter((i) => i.kind === "file");
  if (!files.length) return "ok";
  const bad = files.filter((i) => i.type && i.type !== "application/pdf").length;
  return bad === files.length ? "bad" : "ok";
}
