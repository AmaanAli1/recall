/**
 * Source cards show the quoted sentence with a little context, not the whole
 * ~1,600-character passage. The answer service sends the passage split into
 * pre / hit / post (hit = the words the claim quotes); this trims pre and
 * post to the nearest sentence boundary, or to about `max` characters with
 * an ellipsis when there's no boundary that close.
 */

/** How much context to keep on each side of the quote, in characters. */
export const CONTEXT_CHARS = 90;

export interface Excerpt {
  pre: string;
  post: string;
  /** Was anything cut? Then the card offers "Show full passage". */
  trimmed: boolean;
}

/** The end of the text before the quote: from the last sentence start, or "…" + whole words. */
function tail(pre: string, max: number): { text: string; cut: boolean } {
  if (pre.length <= max) return { text: pre, cut: false };
  const window = pre.slice(-max);
  // The last ". " (or ! ?) inside the window: start right after it.
  const ends = [...window.matchAll(/[.!?]["')\]]?\s+/g)];
  const last = ends.at(-1);
  if (last && last.index !== undefined) return { text: window.slice(last.index + last[0].length), cut: true };
  // No sentence start that close: drop the half word at the front.
  const space = window.search(/\s/);
  return { text: "…" + (space >= 0 ? window.slice(space).trimStart() : window), cut: true };
}

/** The start of the text after the quote: to the end of that sentence, or whole words + "…". */
function head(post: string, max: number): { text: string; cut: boolean } {
  if (post.length <= max) return { text: post, cut: false };
  const window = post.slice(0, max);
  const end = window.match(/[.!?]["')\]]?(?=\s)/);
  if (end && end.index !== undefined) return { text: window.slice(0, end.index + end[0].length), cut: true };
  const space = window.search(/\s\S*$/);
  return { text: (space > 0 ? window.slice(0, space) : window) + "…", cut: true };
}

export function excerpt(pre: string, post: string, max = CONTEXT_CHARS): Excerpt {
  const before = tail(pre, max);
  const after = head(post, max);
  return { pre: before.text, post: after.text, trimmed: before.cut || after.cut };
}
