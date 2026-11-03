import { describe, expect, it } from "vitest";
import { toCourse, toDemoSession, type CourseRow } from "./mappers";

describe("toDemoSession", () => {
  it("shows the demo code as the id, never the uuid", () => {
    const s = toDemoSession({
      code: "demo-UFB5-LR",
      created_at: "2026-11-03T05:00:00+00:00",
      last_active_at: "2026-11-03T05:10:00+00:00",
    });
    expect(s).toEqual({
      id: "demo-UFB5-LR",
      createdAt: "2026-11-03T05:00:00+00:00",
      lastActiveAt: "2026-11-03T05:10:00+00:00",
    });
  });
});

describe("toCourse", () => {
  const sample: CourseRow = {
    id: "00000000-0000-0000-0000-00000000c001",
    session_id: null,
    name: "Algorithms",
    code: null,
    term: null,
    color: "blue",
    archived: false,
  };

  it("marks a course with no session as a sample", () => {
    expect(toCourse(sample).sample).toBe(true);
  });

  it("marks a visitor's own course as not a sample", () => {
    const own = { ...sample, session_id: "some-session-uuid" };
    expect(toCourse(own).sample).toBe(false);
  });

  it("leaves out code and term when they're null", () => {
    const c = toCourse(sample);
    expect(c.code).toBeUndefined();
    expect(c.term).toBeUndefined();
  });

  it("keeps code and term when they're set", () => {
    const c = toCourse({ ...sample, code: "CP213", term: "Fall 2026" });
    expect(c.code).toBe("CP213");
    expect(c.term).toBe("Fall 2026");
  });

  it("starts with no documents until the RAG phase adds them", () => {
    expect(toCourse(sample).documents).toEqual([]);
  });
});