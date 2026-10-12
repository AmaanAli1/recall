/**
 * Client-side file checks for the Library drop zone.
 * These are for UX only (fast, friendly messages). The server re-checks every
 * file, starting with the PDF magic bytes, because the browser can be bypassed.
 */

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

export interface SplitResult<T> {
  accepted: T[];
  rejected: { file: T; kind: string }[];
}

/** Split dropped files into PDFs to upload and everything else to explain. */
export function splitFiles<T extends { name: string; type: string }>(files: T[]): SplitResult<T> {
  const accepted: T[] = [];
  const rejected: { file: T; kind: string }[] = [];
  for (const f of files) {
    if (isPdf(f.name, f.type)) accepted.push(f);
    else rejected.push({ file: f, kind: kindOf(f.name, f.type) });
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
