import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DropZone } from "./DropZone";

afterEach(cleanup);

const pdf = () => new File(["%PDF-1.4"], "Week7.pdf", { type: "application/pdf" });

function setup(locked: boolean) {
  const onAccept = vi.fn();
  const onNewCourse = vi.fn();
  render(<DropZone courseName="Algorithms" locked={locked} onAccept={onAccept} onNewCourse={onNewCourse} />);
  const input = screen.getByLabelText("Upload PDFs to Algorithms") as HTMLInputElement;
  return { onAccept, onNewCourse, input };
}

/** What a drop or the file picker does: files land on the input and it changes. */
function giveFiles(input: HTMLInputElement, files: File[]) {
  fireEvent.change(input, { target: { files } });
}

describe("DropZone on a sample course (locked)", () => {
  it("says so up front", () => {
    setup(true);
    expect(screen.getByText("Algorithms is a sample course")).toBeInTheDocument();
    expect(screen.queryByText(/Drop lecture PDFs into/)).toBeNull();
  });

  it("refuses files from the input with the error, and never passes them on", () => {
    const { onAccept, input } = setup(true);
    giveFiles(input, [pdf()]);
    expect(onAccept).not.toHaveBeenCalled();
    const slip = screen.getByRole("alert");
    expect(slip).toHaveTextContent("Sample courses can’t be changed");
    expect(slip).toHaveTextContent("Week7.pdfNot added");
  });

  it("a click shows the error instead of opening the file picker", () => {
    const { input } = setup(true);
    const picker = vi.spyOn(input, "click");
    // A click on the label is cancelled (no picker) and shows the slip.
    // fireEvent returns false when a handler called preventDefault().
    const notCancelled = fireEvent.click(screen.getByText("Choose files"));
    expect(notCancelled).toBe(false);
    expect(screen.getByRole("alert")).toHaveTextContent("Algorithms is shared by every visitor");
    expect(picker).not.toHaveBeenCalled();
  });

  it("the U shortcut shows the error too", () => {
    const { input } = setup(true);
    const picker = vi.spyOn(input, "click");
    fireEvent.keyDown(document.body, { key: "u" });
    expect(picker).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Sample courses can’t be changed");
  });

  it("New course in the error opens the New course dialog", () => {
    const { onNewCourse, input } = setup(true);
    giveFiles(input, [pdf()]);
    fireEvent.click(screen.getByRole("button", { name: "New course" }));
    expect(onNewCourse).toHaveBeenCalledOnce();
  });
});

describe("DropZone on your own course", () => {
  it("passes PDFs on, with no error", () => {
    const { onAccept, input } = setup(false);
    expect(screen.getByText("Drop lecture PDFs into Algorithms")).toBeInTheDocument();
    giveFiles(input, [pdf()]);
    expect(onAccept).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("U opens the file picker", () => {
    const { input } = setup(false);
    const picker = vi.spyOn(input, "click").mockImplementation(() => {});
    fireEvent.keyDown(document.body, { key: "u" });
    expect(picker).toHaveBeenCalledOnce();
  });
});
