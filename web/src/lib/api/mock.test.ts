/**
 * The mock API stands in for the backend in local runs and CI, so it refuses
 * what the database refuses: visitors can't change sample courses or add PDFs
 * to them (RLS). Otherwise a UI bug could look fine in tests and fail for real.
 */
import { describe, expect, it } from "vitest";
import { SAMPLE_LOCKED_MESSAGE } from "../courses";
import { SAMPLE_COURSE_IDS } from "../sample-courses";
import { createCourse, deleteCourse, listCourses, updateCourse, uploadDocument } from "./mock";

const ALGO = SAMPLE_COURSE_IDS.algorithms;
const pdf = () => new File(["%PDF-1.4"], "Week7.pdf", { type: "application/pdf" });

describe("mock API and sample courses", () => {
  it("refuses an upload to a sample course, and adds nothing", async () => {
    await expect(uploadDocument(ALGO, pdf())).rejects.toThrow(SAMPLE_LOCKED_MESSAGE);
    const algo = (await listCourses()).find((c) => c.id === ALGO);
    expect(algo?.documents.some((d) => d.name === "Week7.pdf")).toBe(false);
  });

  it("refuses to edit, archive or delete a sample course", async () => {
    await expect(updateCourse(ALGO, { name: "Mine now" })).rejects.toThrow(SAMPLE_LOCKED_MESSAGE);
    await expect(updateCourse(ALGO, { archived: true })).rejects.toThrow(SAMPLE_LOCKED_MESSAGE);
    await expect(deleteCourse(ALGO)).rejects.toThrow(SAMPLE_LOCKED_MESSAGE);
    expect((await listCourses()).some((c) => c.id === ALGO)).toBe(true);
  });

  it("still lets you change your own course", async () => {
    const mine = await createCourse({ name: "My notes", color: "rust" });
    await expect(updateCourse(mine.id, { name: "Notes" })).resolves.toMatchObject({ name: "Notes" });
    await deleteCourse(mine.id);
    expect((await listCourses()).some((c) => c.id === mine.id)).toBe(false);
  });
});
