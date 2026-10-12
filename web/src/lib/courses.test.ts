import { describe, expect, it } from "vitest";
import { cleanCode, cleanName, courseLabel, courseNameError, NAME_MAX } from "./courses";

describe("cleanName", () => {
  it("trims and collapses whitespace", () => {
    expect(cleanName("  Data   Structures \n")).toBe("Data Structures");
  });
});

describe("cleanCode", () => {
  it("upper-cases and removes spaces", () => {
    expect(cleanCode(" cp 213 ")).toBe("CP213");
  });
  it("caps the length", () => {
    expect(cleanCode("ABCDEFGHIJKLMNOP")).toHaveLength(12);
  });
});

describe("courseNameError", () => {
  const existing = ["Algorithms", "Operating Systems"];

  it("rejects empty and whitespace-only names", () => {
    expect(courseNameError("", existing)).toBe("Give the course a name.");
    expect(courseNameError("    ", existing)).toBe("Give the course a name.");
  });

  it("rejects names that are too long", () => {
    expect(courseNameError("x".repeat(NAME_MAX + 1), existing)).toMatch(/under 60/);
  });

  it("rejects duplicates, ignoring case and extra spaces", () => {
    expect(courseNameError("  algorithms ", existing)).toBe("You already have a course called algorithms.");
  });

  it("lets a course keep its own name when editing", () => {
    expect(courseNameError("Algorithms", existing, "Algorithms")).toBeNull();
  });

  it("accepts a new name", () => {
    expect(courseNameError("Data Structures", existing)).toBeNull();
  });
});

describe("courseLabel", () => {
  it("puts the code first when there is one", () => {
    expect(courseLabel({ name: "Data Structures", code: "CP213" })).toBe("CP213 · Data Structures");
    expect(courseLabel({ name: "Data Structures" })).toBe("Data Structures");
  });
});
