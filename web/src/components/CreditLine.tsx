import { ERICKSON_CREDIT } from "@/lib/real-documents";

/**
 * Attribution for the real sample documents. CC BY 4.0 asks for the author,
 * the title and the licence wherever the material is shown, so this sits on
 * Library and under Ask whenever answers come from those chapters.
 */
export function CreditLine({ className = "" }: { className?: string }) {
  return (
    <p className={`m-0 text-[13px] text-ink-3 ${className}`}>
      Sample course: Jeff Erickson,{" "}
      <a href={ERICKSON_CREDIT.href} className="lnk lnk-hl text-ink-2" target="_blank" rel="noreferrer">
        <cite>Algorithms</cite>
      </a>{" "}
      (CC BY 4.0)
    </p>
  );
}
