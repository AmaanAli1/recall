import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COURSE_LIMIT, COURSE_LIMIT_MESSAGE, cleanCode, cleanName, courseLabel, courseNameError, NAME_MAX, ownCourseCount } from "./courses";

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
  const existing = ["Algorithms", "Everyday Math"];

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

describe("the one-course limit", () => {
  it("counts only the visitor's own courses, not the samples", () => {
    expect(ownCourseCount([{ sample: true }, { sample: true }])).toBe(0);
    expect(ownCourseCount([{ sample: true }, { sample: false }])).toBe(1);
    expect(COURSE_LIMIT).toBe(1);
  });

  it("uses the exact message the database raises (the API shows it to visitors)", () => {
    // Contract test: the migration and this file must agree, word for word.
    // Vitest runs from web/ (locally and in CI), so the migrations are one folder up.
    const dir = join(process.cwd(), "..", "supabase", "migrations");
    const migration = readdirSync(dir).find((f) => f.endsWith("_course_cleanup.sql"));
    expect(migration).toBeDefined();
    const sql = readFileSync(join(dir, migration ?? ""), "utf8");
    expect(sql).toContain(`raise exception '${COURSE_LIMIT_MESSAGE}'`);
    expect(sql).toContain(`where session_id = new.session_id) >= ${COURSE_LIMIT} then`);
  });
});
