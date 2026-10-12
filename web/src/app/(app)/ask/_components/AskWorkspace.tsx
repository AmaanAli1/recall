"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ask, listCourses, listDynoRuns, type Answer, type Course } from "@/lib/api";
import { STARTERS } from "@/lib/api/mock-data";
import { consumeFreshArrival } from "@/lib/demo-flags";
import { redline } from "@/lib/stats";
import { AnswerSheet, type View } from "./AnswerSheet";
import { Composer } from "./Composer";
import { Sidebar } from "./Sidebar";
import { SourcesPane } from "./SourcesPane";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import s from "../ask.module.css";

const COURSE_ID = "algo";

export interface Glance {
  passages: number;
  recall: number | null;
  clear: boolean;
}

/**
 * The three-pane Ask workspace. Owns the answer, the picked/peeked citation
 * and the settings; each pane is a presentational child.
 */
export function AskWorkspace() {
  const root = useRef<HTMLDivElement>(null);
  const composerInput = useRef<HTMLInputElement>(null);
  const cards = useRef<Map<number, HTMLDivElement>>(new Map());

  const [view, setView] = useState<View>("boot");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [pendingQ, setPendingQ] = useState("");
  // Bumps on every user-triggered answer so the sheet replays its entrance.
  const [seq, setSeq] = useState(0);
  const [picked, setPicked] = useState(1);
  const [hover, setHover] = useState(0);
  // A keyboard pick (click with detail 0) jumps without sweeps or smooth scroll.
  const [instant, setInstant] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [courses, setCourses] = useState<Course[]>([]);
  const [glance, setGlance] = useState<Glance | null>(null);

  // Only the latest request may land; an older, slower answer is dropped.
  const reqId = useRef(0);
  const runAsk = useCallback((question: string, animate: boolean) => {
    const id = ++reqId.current;
    setPendingQ(question);
    setView("loading");
    setPicked(1);
    setHover(0);
    ask(COURSE_ID, question)
      .then((a) => {
        if (id !== reqId.current) return;
        setAnswer(a);
        setView("answer");
        if (animate) setSeq((n) => n + 1);
      })
      .catch(() => {
        if (id === reqId.current) setView("error");
      });
  }, []);

  // First visit after the demo boot opens on the starters; otherwise show the
  // first starter's answer. The ref guards against StrictMode's double effect,
  // which would otherwise consume the one-shot flag on the first pass.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const fresh = consumeFreshArrival();
    // Deferred a microtask: state updates belong in callbacks, not the effect body.
    queueMicrotask(() => (fresh ? setView("empty") : runAsk(STARTERS[0].question, false)));
  }, [runAsk]);

  useEffect(() => {
    let live = true;
    Promise.all([listCourses(), listDynoRuns()])
      .then(([cs, runs]) => {
        if (!live) return;
        setCourses(cs);
        const algo = cs.find((c) => c.id === COURSE_ID);
        const passages = algo?.documents.reduce((n, d) => n + (d.passages ?? 0), 0) ?? 0;
        const latest = runs.at(-1);
        const base = runs[0];
        setGlance({
          passages,
          recall: latest ? latest.metrics.recall : null,
          clear: !!latest && !!base && latest.metrics.recall >= redline(base.metrics.recall),
        });
      })
      .catch(() => {
        /* sidebar just shows fewer details */
      });
    return () => {
      live = false;
    };
  }, []);

  // The header lives in the layout, so measure where the workspace starts and
  // size it to fill the rest of the viewport (CSS reads --ask-top).
  useLayoutEffect(() => {
    const el = root.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty("--ask-top", `${Math.round(top)}px`);
    };
    measure();
    const header = el.parentElement?.querySelector("header");
    const ro = header ? new ResizeObserver(measure) : null;
    if (header && ro) ro.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      ro?.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  const newQuestion = useCallback(() => {
    reqId.current++; // drop anything in flight
    setView("empty");
    setPicked(1);
    setHover(0);
    composerInput.current?.focus({ preventScroll: true });
  }, []);

  // "N" starts a new question, like the keycap on the button says.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      newQuestion();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [newQuestion]);

  const pickTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(pickTimer.current), []);

  const pick = useCallback((n: number, keyboard: boolean) => {
    setPicked(n);
    setInstant(keyboard);
    // Wait a tick so the card has its picked styles before it scrolls into view.
    clearTimeout(pickTimer.current);
    pickTimer.current = setTimeout(() => {
      const el = cards.current.get(n);
      if (!el) return;
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ block: "nearest", behavior: reduce || keyboard || settings.calm ? "auto" : "smooth" });
    }, 0);
  }, [settings.calm]);

  const cardRef = useCallback((n: number, el: HTMLDivElement | null) => {
    if (el) cards.current.set(n, el);
    else cards.current.delete(n);
  }, []);

  const algo = courses.find((c) => c.id === COURSE_ID);
  const docCount = algo?.documents.length ?? null;
  // The chat matching the open answer is "current" (starters share ids with the sample chats).
  const currentChat = view === "answer" ? STARTERS.find((q) => q.question === answer?.question)?.id ?? null : null;

  const rootCls = [s.ws, instant ? s.instant : "", settings.calm ? s.calm : "", "min-h-0"].join(" ");

  return (
    <div ref={root} className={rootCls}>
      <div className={s.row}>
        <Sidebar
          courses={courses}
          currentCourse={COURSE_ID}
          currentChat={currentChat}
          glance={glance}
          onNew={newQuestion}
          settings={settings}
          onSettings={setSettings}
        />

        <div className={s.paneMain}>
          <AnswerSheet
            view={view}
            answer={answer}
            pendingQ={pendingQ}
            seq={seq}
            docCount={docCount}
            courseName={algo?.name ?? "Algorithms"}
            picked={picked}
            hover={hover}
            showTiming={settings.timing}
            onAsk={(q) => runAsk(q, true)}
            onRetry={() => runAsk(pendingQ, true)}
            onPick={pick}
            onPeek={setHover}
            onFollowUp={(q) => {
              const el = composerInput.current;
              if (!el) return;
              el.value = q;
              el.focus();
            }}
          />
          <Composer inputRef={composerInput} busy={view === "loading"} onAsk={(q) => runAsk(q, true)} />
        </div>

        <SourcesPane
          view={view}
          answer={answer}
          picked={picked}
          hover={hover}
          onPick={pick}
          onPeek={setHover}
          cardRef={cardRef}
        />
      </div>
    </div>
  );
}
