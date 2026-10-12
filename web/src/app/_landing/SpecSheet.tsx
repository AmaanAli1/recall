import { RECEIPT } from "./bench-data";
import { ArrowRight } from "./icons";
import { REPO_URL } from "./MarketingNav";
import styles from "./landing.module.css";

const SPEC = [
  ["Engine", "FastAPI · Python"],
  ["Intake", "PyMuPDF, page-aware chunking"],
  ["Fuel", "OpenAI embeddings + chat"],
  ["Transmission", "Keyword + vector → cross-encoder rerank"],
  ["Chassis", "Next.js on Vercel"],
  ["Storage", "Postgres + pgvector (Supabase)"],
  ["Telemetry", "Langfuse traces · MLflow runs"],
  ["Tuned on", "Dyno · hand-labeled golden set"],
] as const;

const TONE = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;

/** The pinned "Dyno printout" receipt: a sample CLI run, tilted, swings on hover. */
function Receipt() {
  return (
    <figure className={`${styles.receipt} sheet relative mb-0 ml-0 mr-0 mt-12 max-w-[340px]`}>
      {/* Push-pin and its shadow */}
      <span
        aria-hidden="true"
        className="absolute -top-[9px] left-1/2 z-[2] -ml-[9px] h-[18px] w-[18px] rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.35),1px_3px_4px_rgba(60,20,10,0.35)]"
        style={{ background: "radial-gradient(circle at 35% 30%, #F27A62 0%, #C8250E 45%, #8E1606 100%)" }}
      />
      <span aria-hidden="true" className="absolute left-1/2 top-1 z-[1] -ml-0.5 h-1 w-2 rounded-full bg-[rgba(60,30,15,0.18)] blur-[1px]" />
      <div className="border border-b-0 border-line bg-sheet px-[22px] pb-[18px] pt-[22px]">
        <div className="flex items-baseline justify-between font-mono text-xs text-ink-2">
          <span translate="no">DYNO PRINTOUT</span>
          <span className="num">
            run {RECEIPT.run} · {RECEIPT.date}
          </span>
        </div>
        <p translate="no" className="mb-3 mt-3.5 font-mono text-[13px] text-ink">
          <span className="text-red">$</span> dyno run --suite smoke
        </p>
        <div translate="no" className="num flex flex-col gap-1.5 border-y border-dashed border-line-2 py-3 font-mono text-[13px]">
          {RECEIPT.rows.map((r) => (
            <div key={r.k} className="flex gap-3">
              <span className="flex-auto">{r.k}</span>
              <span className="w-14 text-right">{r.v}</span>
              <span className={`w-14 text-right ${TONE[r.tone]}`}>{r.d}</span>
            </div>
          ))}
          <div className="flex gap-3">
            <span className="flex-auto">p95 latency</span>
            <span className="w-14 text-right">{RECEIPT.latency.v}</span>
            <span className={`w-14 text-right ${TONE[RECEIPT.latency.tone]}`}>{RECEIPT.latency.d}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between font-mono text-[13px]">
          <span>gate</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-good">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            CLEAR
          </span>
        </div>
        <figcaption className="mt-3.5 text-xs text-ink-2">Sample output. Every run is logged to MLflow.</figcaption>
      </div>
      {/* Torn zig-zag bottom edge */}
      <div
        aria-hidden="true"
        className="h-2 bg-repeat-x"
        style={{
          backgroundImage: "linear-gradient(45deg, var(--sheet) 50%, transparent 50%), linear-gradient(-45deg, var(--sheet) 50%, transparent 50%)",
          backgroundSize: "12px 12px",
          backgroundPosition: "0 0",
        }}
      />
    </figure>
  );
}

/** "The spec sheet": what Recall is built from, as a car-style spec list. */
export function SpecSheet() {
  return (
    <section id="spec" aria-labelledby="spec-h" className="relative mx-auto flex max-w-[1200px] flex-wrap gap-14 px-6 pb-24 pt-12">
      <div className="min-w-0 flex-[1_1_320px]">
        <h2 id="spec-h" className="m-0 text-[46px] font-normal leading-[1.06] tracking-[-0.032em]">The spec sheet.</h2>
        <p className="mb-0 mt-[18px] max-w-[24em] text-[17px] leading-[1.6] text-ink-2">
          Every part chosen on purpose, and every change tuned on the dyno before it ships.
        </p>
        <Receipt />
        <a href={REPO_URL} className="lnk lnk-hl mt-6 inline-flex items-center gap-1.5 text-[15px] font-medium text-ink">
          Read the source on GitHub <ArrowRight size={14} />
        </a>
      </div>
      <div className="sheet relative min-w-0 flex-[2_1_560px]">
        <div className="ear bg-line-2 p-px">
          <dl className="ear m-0 bg-sheet px-[30px] pb-3 pt-2">
            {SPEC.map(([k, v], i) => (
              <div key={k} className={`flex items-baseline py-[17px] ${i === 0 ? "" : "border-t border-line"}`}>
                <dt className="flex-none font-mono text-xs uppercase tracking-[0.1em] text-ink-2">{k}</dt>
                {/* Dotted leader between the label and the value */}
                <span aria-hidden="true" className="mx-3.5 min-w-6 flex-auto -translate-y-1 border-b border-dotted border-line-2" />
                <dd translate="no" className="m-0 flex-[0_1_auto] text-right text-base">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <span className="fold" aria-hidden="true" />
      </div>
    </section>
  );
}
