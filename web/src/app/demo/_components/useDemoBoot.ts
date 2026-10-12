"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createDemoSession, listCourses, type Course, type DemoSession } from "@/lib/api";
import { prefersReducedMotion } from "@/lib/scroll";

export type StepStatus = "idle" | "busy" | "done" | "failed";

export const STEP_LABELS = [
  "Creating your private session",
  "Copying 3 sample courses into your notebook",
  "Warming up search and the reranker",
] as const;

/** Pacing, not fake waiting: a step that resolves instantly still stays on screen long enough to read. */
const MIN_STEP_MS = 350;
/** Short beat before the card slides up, so it doesn't arrive with the first paint. */
const CARD_IN_MS = 80;
/** Fields wipe in for 520ms with a 320ms stagger; the stamp lands just after the last one. */
const REVEAL_MS = 860;

export interface BootState {
  shown: boolean;
  revealed: boolean;
  issued: boolean;
  /** True once the boot has finished at least once; keeps Replay focusable during a replay. */
  everIssued: boolean;
  steps: [StepStatus, StepStatus, StepStatus];
  sessionId: string;
  coursesLabel: string;
  stampDate: string;
  error: { step: number; message: string } | null;
}

const INITIAL: BootState = {
  shown: false,
  revealed: false,
  issued: false,
  everIssued: false,
  steps: ["idle", "idle", "idle"],
  sessionId: "",
  coursesLabel: "",
  stampDate: "",
  error: null,
};

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function stampFor(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${String(d.getDate()).padStart(2, "0")} ${d.getFullYear()}`;
}

function describeCourses(courses: Course[]): string {
  const sample = courses.filter((c) => c.sample);
  const pdfs = sample.reduce((n, c) => n + c.documents.length, 0);
  return `${sample.length} sample course${sample.length === 1 ? "" : "s"} · ${pdfs} lecture PDF${pdfs === 1 ? "" : "s"}`;
}

/** Stand-in for a backend warm-up call (embedding model + reranker load). */
function warmUp(): Promise<void> {
  return Promise.resolve();
}

/**
 * Runs the boot sequence. Each step ticks only when its real request resolves.
 * Results are cached, so Replay and Retry never create a second session.
 */
export function useDemoBoot() {
  const [state, setState] = useState<BootState>(INITIAL);
  const runId = useRef(0);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const session = useRef<DemoSession | null>(null);
  const courses = useRef<Course[] | null>(null);

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current.clear();
  }, []);

  // A cleared sleep never resolves, which simply strands the superseded run.
  const sleep = useCallback(
    (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          timers.current.delete(t);
          resolve();
        }, ms);
        timers.current.add(t);
      }),
    [],
  );

  /** Run from `startAt` (0 = full animation; >0 = Retry resumes at the failed step). */
  const run = useCallback(
    async (startAt = 0) => {
      const id = ++runId.current;
      clearTimers();
      const alive = () => runId.current === id;
      const reduce = prefersReducedMotion();
      const pace = async <T,>(p: Promise<T>): Promise<T> => {
        if (reduce) return p;
        const [v] = await Promise.all([p, sleep(MIN_STEP_MS)]);
        return v;
      };
      const setStep = (i: number, s: StepStatus) =>
        setState((prev) => {
          const steps = [...prev.steps] as BootState["steps"];
          steps[i] = s;
          return { ...prev, steps };
        });

      if (startAt === 0) {
        setState((prev) => ({ ...INITIAL, everIssued: prev.everIssued, sessionId: prev.sessionId, coursesLabel: prev.coursesLabel }));
        if (!reduce) {
          await sleep(CARD_IN_MS);
          if (!alive()) return;
        }
        setState((prev) => ({ ...prev, shown: true }));
      } else {
        setState((prev) => ({ ...prev, error: null }));
      }

      const tasks: Array<() => Promise<void>> = [
        async () => {
          session.current ??= await createDemoSession();
          const sid = session.current.id;
          setState((prev) => ({ ...prev, sessionId: sid }));
        },
        async () => {
          courses.current ??= await listCourses();
          const label = describeCourses(courses.current);
          setState((prev) => ({ ...prev, coursesLabel: label }));
        },
        warmUp,
      ];

      for (let i = startAt; i < tasks.length; i++) {
        setStep(i, "busy");
        try {
          await pace(tasks[i]());
        } catch (e) {
          if (!alive()) return;
          setStep(i, "failed");
          const message = e instanceof Error && e.message ? e.message : "Something went wrong.";
          setState((prev) => ({ ...prev, error: { step: i, message } }));
          return;
        }
        if (!alive()) return;
        setStep(i, "done");
      }

      setState((prev) => ({ ...prev, revealed: true }));
      if (!reduce) {
        await sleep(REVEAL_MS);
        if (!alive()) return;
      }
      setState((prev) => ({ ...prev, issued: true, everIssued: true, stampDate: stampFor(new Date()) }));
    },
    [clearTimers, sleep],
  );

  // Strand any in-flight run and drop its timers when the page unmounts.
  useEffect(
    () => () => {
      runId.current++;
      clearTimers();
    },
    [clearTimers],
  );

  return {
    state,
    start: useCallback(() => void run(0), [run]),
    replay: useCallback(() => void run(0), [run]),
    retry: useCallback(() => void run(state.error?.step ?? 0), [run, state.error]),
  };
}
