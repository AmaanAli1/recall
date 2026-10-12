import Link from "next/link";
import { BuildStatus } from "./BuildStatus";
import { Logo } from "./Logo";

/**
 * Shared footer (Landing, Library, Dyno). Ask is a full-height workspace and has none.
 * `onLanding` keeps section links in-page; elsewhere they point back to the landing page.
 */
export function SiteFooter({ onLanding = false }: { onLanding?: boolean }) {
  const base = onLanding ? "" : "/";
  return (
    <footer className="relative border-t border-line bg-sheet">
      <div className="mx-auto flex max-w-[1200px] flex-wrap gap-x-16 gap-y-12 px-6 pb-7 pt-14">
        <div className="min-w-0 flex-[2_1_320px]">
          <Logo size="lg" />
          <p className="mt-3.5 max-w-[26em] text-[15px] leading-relaxed text-ink-2">
            An AI study assistant that answers from your lecture notes and cites the page, with every change measured on the dyno.
          </p>
          <BuildStatus />
        </div>
        <nav aria-labelledby="f-project" className="flex-[1_1_140px]">
          <h2 id="f-project" className="mb-3 text-[13px] font-medium">Project</h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
            <li><Link href={`${base}#pipeline`} className="lnk-hl text-ink-2">How it works</Link></li>
            <li><Link href={`${base}#spec`} className="lnk-hl text-ink-2">Spec sheet</Link></li>
            <li><Link href="/dyno" className="lnk-hl text-ink-2">Dyno results</Link></li>
            <li><Link href="/demo" className="lnk-hl text-ink-2">Try the demo</Link></li>
          </ul>
        </nav>
        <nav aria-labelledby="f-builder" className="flex-[1_1_140px]">
          <h2 id="f-builder" className="mb-3 text-[13px] font-medium">Builder</h2>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-sm">
            <li><a href="https://github.com/AmaanAli1" className="lnk-hl text-ink-2">GitHub</a></li>
            <li><a href="https://www.linkedin.com/in/amaan-ali-85967a1b1/" className="lnk-hl text-ink-2">LinkedIn</a></li>
            {/* Not a link until the PDF exists: a link to a 404 is worse than plain text. */}
            <li className="text-ink-3">Resume <span className="text-xs">(coming soon)</span></li>
            <li><a href="mailto:amaan.ali99@yahoo.com" className="lnk-hl text-ink-2">Email</a></li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t border-line px-6 pb-7 pt-4.5 text-[13px] text-ink-2">
        <span>Built by Amaan Ali · Computer Science, Wilfrid Laurier University · 2026</span>
        <span className="font-mono" translate="no">Next.js · FastAPI · pgvector · v0.1</span>
      </div>
    </footer>
  );
}
