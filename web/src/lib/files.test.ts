import { describe, expect, it } from "vitest";
import { dragVerdict, formatSize, isPdf, isTooBig, kindOf, MAX_PDF_BYTES, splitFiles } from "./files";

const MB = 1024 * 1024;

describe("isPdf", () => {
  it("accepts by MIME type or extension, case-insensitive", () => {
    expect(isPdf("notes.PDF")).toBe(true);
    expect(isPdf("scan", "application/pdf")).toBe(true);
    expect(isPdf("slides.pptx", "")).toBe(false);
  });
});

describe("kindOf", () => {
  it("describes common non-PDFs in plain words", () => {
    expect(kindOf("Lecture7_Slides.pptx")).toBe("PowerPoint");
    expect(kindOf("whiteboard.HEIC")).toBe("Image");
    expect(kindOf("data.parquet")).toBe(".parquet file");
    expect(kindOf("folder", "")).toBe("Folder or unknown");
  });
});

describe("splitFiles", () => {
  it("keeps PDFs and explains the rest", () => {
    const { accepted, rejected } = splitFiles([
      { name: "Week7.pdf", type: "application/pdf" },
      { name: "Slides.pptx", type: "" },
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["Week7.pdf"]);
    expect(rejected[0]).toMatchObject({ kind: "PowerPoint" });
  });
});

describe("the size limit", () => {
  it("is 25 MB, and exactly 25 MB is still allowed", () => {
    expect(MAX_PDF_BYTES).toBe(25 * MB);
    expect(isTooBig(25 * MB)).toBe(false);
    expect(isTooBig(25 * MB + 1)).toBe(true);
    expect(isTooBig()).toBe(false); // no size known: let the server decide
  });

  it("formats sizes rounded up, so a file just over the limit doesn't read as 25 MB", () => {
    expect(formatSize(25 * MB + 1)).toBe("25.1 MB");
    expect(formatSize(25 * MB)).toBe("25 MB");
    expect(formatSize(48 * MB)).toBe("48 MB");
    expect(formatSize(25.3 * MB)).toBe("25.3 MB");
    expect(formatSize(0.4 * MB)).toBe("0.4 MB");
    expect(formatSize(312.6 * MB)).toBe("313 MB");
  });

  it("splitFiles skips big PDFs with their size, and non-PDFs with their kind", () => {
    const { accepted, rejected } = splitFiles([
      { name: "Week6.pdf", type: "application/pdf", size: 48 * MB },
      { name: "Week7.pdf", type: "application/pdf", size: 25 * MB },
      { name: "Slides.pptx", type: "", size: 1 * MB },
    ]);
    expect(accepted.map((f) => f.name)).toEqual(["Week7.pdf"]);
    expect(rejected.map(({ file, kind, reason }) => [file.name, kind, reason])).toEqual([
      ["Week6.pdf", "48 MB", "size"],
      ["Slides.pptx", "PowerPoint", "type"],
    ]);
  });
});

describe("dragVerdict", () => {
  it("is bad only when every dragged file is a known non-PDF", () => {
    expect(dragVerdict([{ kind: "file", type: "image/png" }])).toBe("bad");
    expect(dragVerdict([{ kind: "file", type: "image/png" }, { kind: "file", type: "application/pdf" }])).toBe("ok");
    expect(dragVerdict([{ kind: "file", type: "" }])).toBe("ok");
  });
});
