"use client";

import Link from "next/link";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { deleteChat, listChats, renameChat, setChatPinned, type ChatSummary } from "@/lib/api";
import { ChatMenu } from "./ChatMenu";
import s from "../ask.module.css";

/** How long "Chat deleted. Undo" stays before the delete is sent to the server. */
const UNDO_MS = 8000;
/** How long a freshly pinned chat keeps its highlighter flash + pin drop. */
const PIN_FLASH_MS = 1500;

type Group = ChatSummary["group"] | "Pinned";

/**
 * Saved chats for one course, grouped Pinned / Today / This week / Earlier.
 * Each row has a "…" menu: Rename (inline), Pin to top / Unpin, Delete.
 * Delete asks inline first; after confirming, the row disappears and an Undo bar
 * shows. The server delete only happens when the undo window closes, so Undo is
 * a pure client-side restore.
 */
export function ChatList({ courseId, currentChat, calm }: { courseId: string; currentChat: string | null; calm: boolean }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [justPinned, setJustPinned] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pinTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<string | null>(null);
  const moreBtns = useRef<Map<string, HTMLButtonElement>>(new Map());
  const links = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const rows = useRef<Map<string, HTMLDivElement>>(new Map());
  // FLIP "First": where each row was before a pin/unpin re-ordered the list.
  const flipFrom = useRef<Map<string, number> | null>(null);
  // Where focus should land after the next render (the row we just restored or cancelled).
  const focusNext = useRef<HTMLElement | (() => HTMLElement | undefined) | null>(null);

  // Reload whenever the course changes: each course has its own chats.
  useEffect(() => {
    let live = true;
    listChats(courseId)
      .then((c) => {
        if (live) setChats(c);
      })
      .catch(() => {
        /* show the empty message */
      })
      .finally(() => {
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [courseId]);

  // Leaving the page closes the undo window: send any pending delete.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      clearTimeout(pinTimer.current);
      if (pendingRef.current) void deleteChat(pendingRef.current).catch(() => {});
    },
    [],
  );

  useEffect(() => {
    const f = focusNext.current;
    if (!f) return;
    focusNext.current = null;
    (typeof f === "function" ? f() : f)?.focus();
  });

  // FLIP "Last, Invert, Play": after the re-render, push each moved row back to where
  // it was with a transform, then let it glide to its new place. Animating a transform
  // (not top/margin) keeps it smooth, because the browser doesn't re-run layout.
  useLayoutEffect(() => {
    const from = flipFrom.current;
    if (!from) return;
    flipFrom.current = null;
    const reduce = calm || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    from.forEach((top, id) => {
      const el = rows.current.get(id);
      if (!el) return;
      const dy = top - el.getBoundingClientRect().top;
      if (Math.abs(dy) < 1) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${dy}px)`;
      el.style.zIndex = id === justPinned ? "2" : "";
      void el.offsetHeight; // commit the start position before animating
      el.style.transition = "transform 420ms cubic-bezier(.23,1,.32,1)";
      el.style.transform = "";
      const done = () => {
        el.style.transition = "";
        el.style.zIndex = "";
        el.removeEventListener("transitionend", done);
      };
      el.addEventListener("transitionend", done);
    });
  });

  const commit = (id: string) => {
    void deleteChat(id).catch(() => {
      // The server refused: put the chat back.
      setHidden((h) => without(h, id));
    });
  };

  const confirmDelete = (id: string) => {
    clearTimeout(timer.current);
    if (pendingRef.current) commit(pendingRef.current); // a second delete closes the first one's window
    pendingRef.current = id;
    setPending(id);
    setConfirming(null);
    setHidden((h) => new Set(h).add(id));
    timer.current = setTimeout(() => {
      commit(id);
      pendingRef.current = null;
      setPending(null);
    }, UNDO_MS);
  };

  const undo = () => {
    const id = pendingRef.current;
    clearTimeout(timer.current);
    pendingRef.current = null;
    setPending(null);
    if (!id) return;
    setHidden((h) => without(h, id));
    focusNext.current = () => links.current.get(id);
  };

  const cancel = (id: string) => {
    setConfirming(null);
    focusNext.current = () => moreBtns.current.get(id);
  };

  const togglePin = (c: ChatSummary) => {
    // FLIP "First": remember every row's position before the list re-orders.
    flipFrom.current = new Map([...rows.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));
    const pinned = !c.pinned;
    setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, pinned } : x)));
    setMenuFor(null);
    setJustPinned(pinned ? c.id : null);
    clearTimeout(pinTimer.current);
    pinTimer.current = setTimeout(() => setJustPinned(null), PIN_FLASH_MS);
    focusNext.current = () => moreBtns.current.get(c.id);
    void setChatPinned(c.id, pinned).catch(() => {
      setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, pinned: !pinned } : x)));
    });
  };

  const saveRename = (c: ChatSummary, value: string) => {
    const title = value.trim().replace(/\s+/g, " ").slice(0, 80);
    setRenaming(null);
    focusNext.current = () => links.current.get(c.id);
    if (!title || title === c.title) return;
    setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, title } : x)));
    void renameChat(c.id, title).catch(() => {
      setChats((cs) => cs.map((x) => (x.id === c.id ? { ...x, title: c.title } : x)));
    });
  };

  const visible = chats.filter((c) => !hidden.has(c.id));
  // Pinned chats first, in their own group; the rest keep their time groups.
  const ordered: (ChatSummary & { shown: Group })[] = [
    ...visible.filter((c) => c.pinned).map((c) => ({ ...c, shown: "Pinned" as Group })),
    ...visible.filter((c) => !c.pinned).map((c) => ({ ...c, shown: c.group as Group })),
  ];
  const menuChat = ordered.find((c) => c.id === menuFor) ?? null;

  return (
    <nav aria-labelledby="recent-h" className={`${s.chatScroll} min-h-0 flex-auto`}>
      <h2 id="recent-h" className="m-0 mb-1 px-2.5 text-[13px] font-medium text-ink-2">Chats</h2>
      <div aria-live="polite">
        {pending && (
          <div className={`${s.swapIn} ${s.undoBar}`}>
            <span>Chat deleted.</span>
            <button type="button" autoFocus className={s.undo} onClick={undo}>
              Undo
            </button>
          </div>
        )}
      </div>

      {ordered.map((c, i) => {
        const head = i === 0 || ordered[i - 1].shown !== c.shown;
        return (
          <Fragment key={c.id}>
            {head && (
              <p className={`m-0 mb-1 mt-3.5 px-2.5 text-xs text-ink-3 ${c.shown === "Pinned" && justPinned ? s.headIn : ""}`}>{c.shown}</p>
            )}
            {confirming === c.id ? (
              <div
                className={`${s.swapIn} ${s.confirm}`}
                role="group"
                aria-label={`Confirm deleting ${c.title}`}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    cancel(c.id);
                  }
                }}
              >
                <p className="m-0 text-[13px] leading-[1.4]">Delete “{c.title}”? You can undo right after.</p>
                <div className="mt-2 flex gap-1.5">
                  <button
                    type="button"
                    autoFocus
                    className="btn btn-red min-h-[34px] rounded border-0 px-3 py-1.5 text-[13px] font-medium"
                    onClick={() => confirmDelete(c.id)}
                  >
                    Delete
                  </button>
                  <button type="button" className="btn btn-ghost min-h-[34px] rounded px-3 py-1.5 text-[13px]" onClick={() => cancel(c.id)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div
                ref={(el) => {
                  if (el) rows.current.set(c.id, el);
                  else rows.current.delete(c.id);
                }}
                className={`${s.chatRow} ${justPinned === c.id ? s.justPinned : ""}`}
              >
                {renaming === c.id ? (
                  <>
                    <label htmlFor={`rn-${c.id}`} className="sr-only">Rename chat</label>
                    <input
                      id={`rn-${c.id}`}
                      className={s.chatRename}
                      type="text"
                      maxLength={80}
                      defaultValue={c.title}
                      autoFocus
                      onFocus={(e) => e.currentTarget.select()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveRename(c, e.currentTarget.value);
                        } else if (e.key === "Escape") {
                          e.preventDefault();
                          setRenaming(null);
                          focusNext.current = () => moreBtns.current.get(c.id);
                        }
                      }}
                      onBlur={(e) => {
                        if (renaming === c.id) saveRename(c, e.currentTarget.value);
                      }}
                    />
                  </>
                ) : (
                  <>
                    <Link
                      href="/ask"
                      ref={(el) => {
                        if (el) links.current.set(c.id, el);
                        else links.current.delete(c.id);
                      }}
                      className={s.chatLink}
                      aria-current={c.id === currentChat ? "true" : undefined}
                    >
                      {c.pinned && (
                        <svg className={s.pinIco} width="11" height="11" viewBox="0 0 24 24" fill="var(--red)" aria-label="Pinned" role="img">
                          <path d="M16 3l5 5-3 1-4 4 1 5-2 2-4-5-5 5-1-1 5-5-5-4 2-2 5 1 4-4z" />
                        </svg>
                      )}
                      {c.title}
                    </Link>
                    <button
                      type="button"
                      ref={(el) => {
                        if (el) moreBtns.current.set(c.id, el);
                        else moreBtns.current.delete(c.id);
                      }}
                      className={`${s.chatMore} ${menuFor === c.id ? s.chatMoreOpen : ""}`}
                      aria-label={`Options for ${c.title}`}
                      aria-haspopup="menu"
                      aria-expanded={menuFor === c.id}
                      data-chat-menu=""
                      onClick={() => {
                        setConfirming(null);
                        setMenuFor((m) => (m === c.id ? null : c.id));
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <circle cx="5" cy="12" r="1.8" />
                        <circle cx="12" cy="12" r="1.8" />
                        <circle cx="19" cy="12" r="1.8" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            )}
          </Fragment>
        );
      })}

      {loaded && visible.length === 0 && (
        <p className="m-0 mt-2.5 px-2.5 text-[13px] leading-normal text-ink-2">No saved chats. Ask a question and it shows up here.</p>
      )}

      {menuChat && (
        <ChatMenu
          title={menuChat.title}
          pinned={!!menuChat.pinned}
          anchor={() => moreBtns.current.get(menuChat.id)}
          onClose={(refocus) => {
            setMenuFor(null);
            if (refocus) focusNext.current = () => moreBtns.current.get(menuChat.id);
          }}
          onRename={() => {
            setMenuFor(null);
            setRenaming(menuChat.id);
          }}
          onTogglePin={() => togglePin(menuChat)}
          onDelete={() => {
            setMenuFor(null);
            setConfirming(menuChat.id);
          }}
        />
      )}
    </nav>
  );
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
