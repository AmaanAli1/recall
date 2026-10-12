/**
 * Where the project is on its roadmap. The footer's build bar reads this:
 * when a phase ships, change `current` (and `progress` within it). One line.
 */
export const PHASES = ["Design", "Skeleton", "Baseline RAG", "Dyno v1", "Retrieval upgrades", "Harden & ship", "Train (stretch)"] as const;

export const BUILD = {
  /** Index into PHASES of the phase being built now. */
  current: 2,
  /** Roughly how far into the current phase, 0–1. */
  progress: 0.15,
};
