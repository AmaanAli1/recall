/**
 * Where the project is on its roadmap. The footer's build bar reads this.
 *
 * Rewritten at launch (2026-11-27) to the phases that were actually built.
 * The original plan also had "Retrieval upgrades" (a reranker, hybrid
 * search), a faithfulness judge (Dyno v1) and "Train (stretch)"; none were
 * built, so they aren't on the bar (the README lists them as known limits).
 * Recall's rule: nothing unbuilt is shown as done.
 */
export const PHASES = ["Design", "Skeleton", "RAG", "Dyno", "Harden & ship"] as const;

/** Shown in the footer and in the bar's caption once every phase is done. */
export const VERSION = "v1.0";

export const BUILD = {
  /** Index into PHASES of the phase being built now; PHASES.length = all done. */
  current: PHASES.length as number,
  /** Roughly how far into the current phase, 0–1 (ignored when all are done). */
  progress: 0,
};

/** True once every phase has shipped. */
export const BUILD_COMPLETE = BUILD.current >= PHASES.length;
