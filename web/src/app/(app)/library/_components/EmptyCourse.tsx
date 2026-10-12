/** Shown in a course with no documents yet: two stacked sheets and a nudge to start. */
export function EmptyCourse({ courseName }: { courseName: string }) {
  return (
    <div className="rise flex flex-wrap items-center gap-10 pb-7 pt-14">
      <div aria-hidden="true" className="relative h-[120px] w-[150px] flex-none">
        <span className="sheet absolute left-0 top-3.5 h-[104px] w-[84px] -rotate-6">
          <span className="ear box-border block h-full w-full bg-line-2 p-px">
            <span className="ear block h-full w-full bg-sheet" />
          </span>
        </span>
        <span className="sheet absolute left-10 top-0 h-[104px] w-[84px] rotate-4">
          <span className="ear box-border block h-full w-full bg-line-2 p-px">
            <span className="ear box-border flex h-full w-full flex-col gap-2 bg-sheet px-3.5 pt-[26px]">
              <span className="block h-[3px] w-[70%] bg-line-2" />
              <span className="block h-[3px] w-full bg-hl" />
              <span className="block h-[3px] w-[85%] bg-line-2" />
            </span>
          </span>
          <span className="fold" />
        </span>
      </div>
      <div className="min-w-0 flex-[1_1_320px]">
        <h2 className="m-0 text-[28px] font-normal tracking-[-0.02em]">Nothing in {courseName} yet.</h2>
        <p className="mt-2.5 max-w-[34em] text-base leading-relaxed text-ink-2">
          Add lecture slides, readings or your own notes. Recall splits each one into passages and keeps page numbers, so every answer can point to its source.
        </p>
        <p className="mt-[18px] text-sm text-ink-2">Tip: start with this week’s slides, then ask what you didn’t follow in lecture.</p>
      </div>
    </div>
  );
}
