import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Course } from "@/lib/api";
import { CourseMenu } from "./CourseMenu";

afterEach(cleanup);

const course = (sample: boolean): Course => ({
  id: sample ? "00000000-0000-0000-0000-00000000c001" : "own-1",
  name: sample ? "Algorithms" : "My notes",
  color: "blue",
  sample,
  documents: [],
});

function open(c: Course) {
  const handlers = { onEdit: vi.fn(), onArchive: vi.fn(), onDelete: vi.fn() };
  render(<CourseMenu course={c} lastActive={false} {...handlers} />);
  fireEvent.click(screen.getByRole("button", { name: `Options for ${c.name}` }));
  return handlers;
}

describe("CourseMenu", () => {
  it("a sample course offers nothing to change, and says why", () => {
    const handlers = open(course(true));
    const items = screen.getAllByRole("menuitem");
    expect(items).toHaveLength(1);
    expect(items[0]).toHaveAttribute("aria-disabled", "true");
    expect(items[0]).toHaveTextContent("Sample course");
    expect(items[0]).toHaveTextContent("can’t be edited, archived or deleted");
    // Focus lands on it, so a screen reader reads the reason.
    expect(items[0]).toHaveFocus();
    fireEvent.click(items[0]);
    expect(handlers.onEdit).not.toHaveBeenCalled();
    expect(handlers.onArchive).not.toHaveBeenCalled();
    expect(handlers.onDelete).not.toHaveBeenCalled();
  });

  it("your own course still has Edit, Archive and Delete", () => {
    const handlers = open(course(false));
    const items = screen.getAllByRole("menuitem");
    expect(items.map((i) => i.textContent)).toEqual([
      "Edit name, term, colour",
      expect.stringMatching(/^Archive/),
      expect.stringMatching(/^Delete course/),
    ]);
    fireEvent.click(items[0]);
    expect(handlers.onEdit).toHaveBeenCalledOnce();
  });

  it("Escape closes a sample course's menu too", () => {
    open(course(true));
    fireEvent.keyDown(screen.getByRole("menuitem"), { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByRole("button", { name: "Options for Algorithms" })).toHaveFocus();
  });
});
