"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { addExchange, ask, createChat, listCourses, listDynoRuns, listMessages, type Answer, type Course, type DynoRun } from "@/lib/api";
import { COURSE_STARTERS } from "@/lib/api/mock-data";
import { consumeFreshArrival } from "@/lib/demo-flags";
import { redline } from "@/lib/stats";
import { AnswerSheet, type View } from "./AnswerSheet";
import { Composer } from "./Composer";
import { Sidebar } from "./Sidebar";
import { SourcesPane } from "./SourcesPane";
import { DEFAULT_SETTINGS, type Settings } from "./settings";
import { SAMPLE_COURSE_IDS } from "@/lib/sample-courses";
import s from "../ask.module.css";

/** The course Ask opens on. Dyno's golden set is also Algorithms. */
const DEFAULT_COURSE: string = SAMPLE_COURSE_IDS.algorithms;

export interface Glance {
  passages: number;
  recall: number | null;
  clear: boolean;
  /** The latest Dyno run, for the "Open Dyno →" line. */
  run: { id: string; date: string } | null;
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
  const [runs, setRuns] = useState<DynoRun[]>([]);
  // Which course questions go to. Switching course stays on Ask.
  const [courseId, setCourseId] = useState(DEFAULT_COURSE);

  // The saved chat that's open: follow-ups go into it. null = "New chat", so
  // the next question starts a new one.
  const [chatId, setChatIdState] = useState<string | null>(null);
  // The conversation the visitor is in right now. "New chat", switching course
  // or opening a chat starts a new one (a new object). Each save remembers the
  // conversation it was asked in, so a slow save from an old conversation can
  // never pull its chat back open after you've moved on.
  const convo = useRef<{ chatId: string | null }>({ chatId: null });
  const setChatId = useCallback((id: string | null) => {
    convo.current = { chatId: id };
    setChatIdState(id);
  }, []);
  // Bumped after each save, so the sidebar reloads its chat list.
  const [chatsKey, setChatsKey] = useState(0);
  // A quiet note when a save fails. The answer stays on screen either way.
  const [saveFailed, setSaveFailed] = useState(false);

  // Saves run one after another. Without this, two quick questions in a new
  // chat would both see "no chat yet" and create two chats.
  const saving = useRef<Promise<void>>(Promise.resolve());
  const saveExchange = useCallback((course: string, question: string, a: Answer) => {
    const conv = convo.current; // the conversation this question was asked in
    saving.current = saving.current.then(async () => {
      try {
        if (conv.chatId) {
          await addExchange(conv.chatId, question, a);
        } else {
          const chat = await createChat(course, question, a);
          conv.chatId = chat.id; // later questions in this conversation go into it
          // Only mark it open if the visitor is still in this conversation.
          if (convo.current === conv) setChatIdState(chat.id);
        }
        if (convo.current === conv) setSaveFailed(false);
        setChatsKey((k) => k + 1);
      } catch {
        if (convo.current === conv) setSaveFailed(true);
      }
    });
  }, []);

  // What "Try again" re-runs: the last ask, or the last chat we tried to open.
  // Stored as data (not a function) so the callbacks below don't refer to themselves.
  const lastAction = useRef<
    { kind: "ask"; question: string; save: boolean; course: string } | { kind: "open"; id: string; title: string } | null
  >(null);

  // Only the latest request may land; an older, slower answer is dropped.
  const reqId = useRef(0);
  // `save` is false only for the starter answer Ask shows on its own when you
  // come back: that's not something you asked, so it must not become a chat.
  const runAsk = useCallback((question: string, save: boolean, course = courseId) => {
    const id = ++reqId.current;
    lastAction.current = { kind: "ask", question, save, course };
    setPendingQ(question);
    setView("loading");
    setPicked(1);
    setHover(0);
    ask(course, question)
      .then((a) => {
        if (id !== reqId.current) return;
        setAnswer(a);
        setView("answer");
        if (save) {
          setSeq((n) => n + 1);
          saveExchange(course, question, a);
        }
      })
      .catch(() => {
        if (id === reqId.current) setView("error");
      });
  }, [courseId, saveExchange]);

  /** Open a saved chat: show its latest answer, and send follow-ups into it. */
  const openChat = useCallback((id: string, title: string) => {
    const req = ++reqId.current;
    lastAction.current = { kind: "open", id, title };
    setChatId(id);
    setSaveFailed(false);
    setPendingQ(title);
    setView("loading");
    setPicked(1);
    setHover(0);
    listMessages(id)
      .then((messages) => {
        if (req !== reqId.current) return;
        // Ask shows one answer at a time, so a chat opens on its latest one.
        const last = messages.filter((m) => m.role === "assistant" && m.answer).at(-1)?.answer;
        if (last) {
          setAnswer(last);
          setView("answer");
          setSeq((n) => n + 1);
        } else {
          setView("empty");
        }
      })
      .catch(() => {
        if (req === reqId.current) setView("error");
      });
  }, [setChatId]);

  // First visit after the demo boot opens on the starters; otherwise show the
  // first starter's answer. The ref guards against StrictMode's double effect,
  // which would otherwise consume the one-shot flag on the first pass.
  const booted = useRef(false);
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const fresh = consumeFreshArrival();
    // /ask?course=os (from Library's "Ask about this course →") opens on that course's starters.
    const wanted = new URLSearchParams(window.location.search).get("course");
    // Deferred a microtask: state updates belong in callbacks, not the effect body.
    queueMicrotask(() => {
      if (wanted && wanted !== DEFAULT_COURSE) {
        setCourseId(wanted);
        setView("empty");
      } else if (fresh) setView("empty");
      else runAsk(COURSE_STARTERS[DEFAULT_COURSE][0].question, false);
    });
  }, [runAsk]);

  useEffect(() => {
    let live = true;
    Promise.all([listCourses(), listDynoRuns()])
      .then(([cs, runs]) => {
        if (!live) return;
        setCourses(cs);
        setRuns(runs);
        // An unknown or archived course in the URL falls back to the first active one.
        setCourseId((id) => (cs.some((c) => c.id === id && !c.archived) ? id : cs.find((c) => !c.archived)?.id ?? DEFAULT_COURSE));
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
    const header = document.querySelector<HTMLElement>("#top > header");
    const measure = () => {
      // Measure the header, not the workspace: the page transition briefly offsets the
      // workspace with a transform, which would skew getBoundingClientRect.
      const top = header ? header.getBoundingClientRect().bottom + window.scrollY : el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty("--ask-top", `${Math.round(top)}px`);
    };
    measure();
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
    setChatId(null); // the next question starts a new chat
    setSaveFailed(false);
    setView("empty");
    setPicked(1);
    setHover(0);
    composerInput.current?.focus({ preventScroll: true });
  }, [setChatId]);

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

  /** Switch course without leaving Ask: drop the open answer, show that course's starters. */
  const selectCourse = useCallback((id: string) => {
    if (id === courseId) return;
    reqId.current++; // a slow answer for the old course must not land
    setChatId(null);
    setSaveFailed(false);
    setCourseId(id);
    setAnswer(null);
    setPicked(1);
    setHover(0);
    setView("empty");
  }, [courseId, setChatId]);

  /** The open chat was deleted: go back to a new question. */
  const chatDeleted = useCallback((id: string) => {
    if (id === convo.current.chatId) newQuestion();
  }, [newQuestion]);

  const course = courses.find((c) => c.id === courseId);
  const docCount = course ? course.documents.length : null;
  const starters = COURSE_STARTERS[courseId] ?? [];
  // Dyno evaluates the Algorithms golden set only, so recall@5 shows for that course.
  const latest = runs.at(-1);
  const glance: Glance | null = course
    ? {
        passages: course.documents.reduce((n, d) => n + (d.passages ?? 0), 0),
        recall: courseId === DEFAULT_COURSE && latest ? latest.metrics.recall : null,
        clear: !!latest && !!runs[0] && latest.metrics.recall >= redline(runs[0].metrics.recall),
        run: courseId === DEFAULT_COURSE && latest ? { id: latest.id, date: latest.date } : null,
      }
    : null;
  // The open saved chat is "current". Before anything is saved, the answer Ask
  // shows on its own matches a sample chat (starters share ids with them).
  const currentChat = chatId ?? (view === "answer" ? starters.find((q) => q.question === answer?.question)?.id ?? null : null);

  const rootCls = [s.ws, instant ? s.instant : "", settings.calm ? s.calm : "", "min-h-0"].join(" ");

  return (
    <div ref={root} className={rootCls}>
      <div className={s.row}>
        <Sidebar
          courses={courses}
          currentCourse={courseId}
          onSelectCourse={selectCourse}
          currentChat={currentChat}
          chatsKey={chatsKey}
          onOpenChat={openChat}
          onDeleteChat={chatDeleted}
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
            courseName={course?.name ?? "Algorithms"}
            starters={starters}
            picked={picked}
            hover={hover}
            showTiming={settings.timing}
            onAsk={(q) => runAsk(q, true)}
            onRetry={() => {
              const a = lastAction.current;
              if (a?.kind === "ask") runAsk(a.question, a.save, a.course);
              else if (a?.kind === "open") openChat(a.id, a.title);
            }}
            onPick={pick}
            onPeek={setHover}
            onFollowUp={(q) => {
              const el = composerInput.current;
              if (!el) return;
              el.value = q;
              el.focus();
            }}
          />
          {saveFailed && (
            <p role="status" className="m-0 px-6 pb-1 text-[13px] text-ink-3">
              Couldn’t save this chat. Your answer is still here.
            </p>
          )}
          <Composer
            inputRef={composerInput}
            busy={view === "loading"}
            courseName={course?.name ?? "Algorithms"}
            sample={course?.sample ?? true}
            empty={docCount === 0}
            followUp={view === "answer"}
            onAsk={(q) => runAsk(q, true)}
          />
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
