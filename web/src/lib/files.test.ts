import { describe, expect, it } from "vitest";
import { dragVerdict, isPdf, kindOf, splitFiles } from "./files";

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

describe("dragVerdict", () => {
  it("is bad only when every dragged file is a known non-PDF", () => {
    expect(dragVerdict([{ kind: "file", type: "image/png" }])).toBe("bad");
    expect(dragVerdict([{ kind: "file", type: "image/png" }, { kind: "file", type: "application/pdf" }])).toBe("ok");
    expect(dragVerdict([{ kind: "file", type: "" }])).toBe("ok");
  });
});
