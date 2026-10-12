/** Ask settings. Kept in the workspace for this visit; the API does not take them yet. */
export interface Settings {
  length: "short" | "detailed";
  /** Say "not in your notes" instead of guessing. */
  strict: boolean;
  /** Show the embed/search/rerank/generate bar. */
  timing: boolean;
  /** Kill transitions and animations inside the workspace. */
  calm: boolean;
}

export const DEFAULT_SETTINGS: Settings = { length: "detailed", strict: true, timing: true, calm: false };
