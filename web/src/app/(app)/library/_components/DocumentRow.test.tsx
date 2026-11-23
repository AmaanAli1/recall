import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CourseDocument } from "@/lib/api";
import { DocumentRow } from "./DocumentRow";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const ERICKSON: CourseDocument = {
  id: "erickson-1",
  name: "Erickson_Ch1_Recursion.pdf",
  pages: 50,
  passages: 90,
  status: "ready",
  added: "Nov 7",
  sourceUrl: "https://jeffe.cs.illinois.edu/teaching/algorithms/book/01-recursion.pdf",
};

const noop = () => {};
function renderRow(doc: CourseDocument, canDelete: boolean, onNavigate = noop) {
  return render(
    <table>
      <tbody>
        <DocumentRow
          doc={doc}
          n={1}
          menuOpen
          confirming={false}
          onToggleMenu={noop}
          onCloseMenu={noop}
          onConfirmDelete={noop}
          onCancelDelete={noop}
          onDelete={noop}
          onNavigate={onNavigate}
          onRunOcr={noop}
          askHref="/ask?course=c001"
          canDelete={canDelete}
        />
      </tbody>
    </table>,
  );
}

const items = () => screen.getAllByRole("menuitem").map((el) => el.textContent?.trim());

describe("the document menu (only what works)", () => {
  it("a sample document: ask about the course, open the original, nothing that edits it", () => {
    renderRow(ERICKSON, false);
    expect(items()).toEqual(["Ask about this course", "Open the original PDF"]);
  });

  it("opens the author's own PDF in a new tab that can't reach back into Recall", () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null);
    renderRow(ERICKSON, false);
    fireEvent.click(screen.getByRole("menuitem", { name: "Open the original PDF" }));
    expect(open).toHaveBeenCalledWith(ERICKSON.sourceUrl, "_blank", "noopener,noreferrer");
  });

  it("asking goes to the course in Ask", () => {
    const onNavigate = vi.fn();
    renderRow(ERICKSON, false, onNavigate);
    fireEvent.click(screen.getByRole("menuitem", { name: "Ask about this course" }));
    expect(onNavigate).toHaveBeenCalledWith("/ask?course=c001");
  });

  it("your own upload (no source link) can be deleted", () => {
    renderRow({ ...ERICKSON, sourceUrl: undefined, name: "My_notes.pdf" }, true);
    expect(items()).toEqual(["Ask about this course", "Delete"]);
  });

  it("a scan that failed offers OCR, and no Ask until it's ready", () => {
    renderRow({ ...ERICKSON, status: "failed", passages: null, sourceUrl: undefined }, false);
    expect(items()).toEqual(["Run OCR"]);
  });
});
