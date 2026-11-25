import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { GOLDEN_TEXT } from "./dyno-questions";

/**
 * Reads dyno/golden.toml (Vitest runs from web/) with a small parser: every
 * [[question]] block's id and question, and the question of its first
 * [[question.history]] table. Enough for this file's simple TOML.
 */
function goldenQuestions(): Record<string, { question: string; after?: string }> {
  const toml = readFileSync(join(process.cwd(), "..", "dyno", "golden.toml"), "utf8");
  const out: Record<string, { question: string; after?: string }> = {};
  for (const block of toml.split(/^\[\[question\]\]$/m).slice(1)) {
    const [own, ...history] = block.split(/^\[\[question\.history\]\]$/m);
    const id = own.match(/^id = "(.+)"$/m)?.[1];
    const question = own.match(/^question = "(.+)"$/m)?.[1];
    if (!id || !question) throw new Error("couldn't read a [[question]] block");
    const after = history[0]?.match(/^question = "(.+)"$/m)?.[1];
    out[id] = after ? { question, after } : { question };
  }
  return out;
}

describe("GOLDEN_TEXT", () => {
  const golden = goldenQuestions();

  it("matches golden.toml word for word", () => {
    // Notes are the page's own commentary, so only the wording is compared.
    for (const [id, { question, after }] of Object.entries(GOLDEN_TEXT)) {
      expect(after ? { question, after } : { question }, id).toEqual(golden[id]);
    }
  });

  it("covers every follow-up and off-topic question in golden.toml", () => {
    const needed = Object.keys(golden).filter((id) => id.startsWith("fu-") || id.startsWith("off-"));
    expect(Object.keys(GOLDEN_TEXT).sort()).toEqual(needed.sort());
    expect(needed).toHaveLength(13);
  });
});
