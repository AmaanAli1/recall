"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { deleteChat, listChats, type ChatSummary } from "@/lib/api";
import s from "../ask.module.css";

/** How long "Chat deleted. Undo" stays before the delete is sent to the server. */
const UNDO_MS = 8000;

/**
 * Saved chats grouped Today / This week / Earlier.
 * Delete asks inline first; after confirming, the row disappears and an Undo bar
 * shows. The server delete only happens when the undo window closes, so Undo is
 * a pure client-side restore.
 */
export function ChatList({ currentChat }: { currentChat: string | null }) {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingRef = useRef<string | null>(null);
  const delBtns = useRef<Map<string, HTMLButtonElement>>(new Map());
  const links = useRef<Map<string, HTMLAnchorElement>>(new Map());
  // Where focus should land after the next render (the row we just restored or cancelled).
  const focusNext = useRef<HTMLElement | (() => HTMLElement | undefined) | null>(null);

  useEffect(() => {
    let live = true;
    listChats()
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
  }, []);

  // Leaving the page closes the undo window: send any pending delete.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
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
    focusNext.current = () => delBtns.current.get(id);
  };

  const live = chats.filter((c) => !hidden.has(c.id));

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

      {live.map((c, i) => {
        const head = i === 0 || live[i - 1].group !== c.group;
        return (
          <Fragment key={c.id}>
            {head && <p className="m-0 mb-1 mt-3.5 px-2.5 text-xs text-ink-3">{c.group}</p>}
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
              <div className={s.chatRow}>
                <Link
                  href="/ask"
                  ref={(el) => {
                    if (el) links.current.set(c.id, el);
                    else links.current.delete(c.id);
                  }}
                  className={s.chatLink}
                  aria-current={c.id === currentChat ? "true" : undefined}
                >
                  {c.title}
                </Link>
                <button
                  type="button"
                  ref={(el) => {
                    if (el) delBtns.current.set(c.id, el);
                    else delBtns.current.delete(c.id);
                  }}
                  className={s.chatDel}
                  aria-label={`Delete chat: ${c.title}`}
                  title="Delete chat"
                  onClick={() => setConfirming(c.id)}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 7h16" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                    <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
                    <path d="M9 7V4h6v3" />
                  </svg>
                </button>
              </div>
            )}
          </Fragment>
        );
      })}

      {loaded && live.length === 0 && (
        <p className="m-0 mt-2.5 px-2.5 text-[13px] leading-normal text-ink-2">No saved chats. Ask a question and it shows up here.</p>
      )}
    </nav>
  );
}

function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}
