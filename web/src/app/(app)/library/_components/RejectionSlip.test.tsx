import { cleanup, render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RejectionSlip, type Rejection } from "./RejectionSlip";

afterEach(cleanup);

const show = (rejection: Rejection) =>
  render(<RejectionSlip rejection={rejection} open inputId="upload" onDismiss={() => {}} />);

const BIG = { name: "Week6.pdf", kind: "48 MB", reason: "size" as const };
const PPTX = { name: "Slides.pptx", kind: "PowerPoint", reason: "type" as const };

describe("RejectionSlip", () => {
  it("a PDF over the limit gets the size title and the split advice only", () => {
    show({ files: [BIG], added: 0 });
    const slip = screen.getByRole("alert");
    expect(slip).toHaveTextContent("Over the 25 MB limit");
    expect(slip).toHaveTextContent("up to 25 MB each in this demo, for now");
    expect(slip).toHaveTextContent("Week6.pdf48 MB");
    expect(slip).toHaveTextContent("split them into parts");
    expect(slip).not.toHaveTextContent("File › Export › PDF");
    expect(screen.getByText("Choose other PDFs")).toBeInTheDocument();
  });

  it("a non-PDF keeps the PDFs-only slip, with no size advice", () => {
    show({ files: [PPTX], added: 0 });
    const slip = screen.getByRole("alert");
    expect(slip).toHaveTextContent("PDFs only, for now");
    expect(slip).toHaveTextContent("File › Export › PDF");
    expect(slip).not.toHaveTextContent("split them into parts");
  });

  it("a mixed drop names both reasons and gives both fixes", () => {
    show({ files: [BIG, PPTX], added: 0 });
    const slip = screen.getByRole("alert");
    expect(slip).toHaveTextContent("Couldn’t add 2 files");
    expect(slip).toHaveTextContent("File › Export › PDF");
    expect(slip).toHaveTextContent("split them into parts");
  });

  it("when some PDFs went in, the title counts both", () => {
    show({ files: [BIG], added: 2 });
    expect(screen.getByRole("alert")).toHaveTextContent("Added 2 PDFs. Skipped 1 file.");
  });

  it("a sample course gets its own error, a New course button and no file advice", () => {
    const onNewCourse = vi.fn();
    render(
      <RejectionSlip
        rejection={{ files: [{ name: "Week7.pdf", kind: "Not added", reason: "sample" }], added: 0, locked: "Algorithms" }}
        open
        inputId="upload"
        onDismiss={() => {}}
        onNewCourse={onNewCourse}
      />,
    );
    const slip = screen.getByRole("alert");
    expect(slip).toHaveTextContent("Sample courses can’t be changed");
    expect(slip).toHaveTextContent("Algorithms is shared by every visitor, so PDFs can’t be added to it.");
    expect(slip).toHaveTextContent("Make a course of your own");
    expect(slip).not.toHaveTextContent("File › Export › PDF");
    expect(slip).not.toHaveTextContent("split them into parts");
    expect(screen.queryByText(/Choose (other )?PDFs/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "New course" }));
    expect(onNewCourse).toHaveBeenCalledOnce();
  });

  it("a click with no files shows the sample error without an empty list", () => {
    show({ files: [], added: 0, locked: "Everyday Math" });
    expect(screen.getByRole("alert")).toHaveTextContent("Everyday Math is shared by every visitor");
    expect(screen.queryByRole("list")).toBeNull();
  });
});
