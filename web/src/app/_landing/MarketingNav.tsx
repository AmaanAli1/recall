import { Logo } from "@/components/Logo";
import { GitHubIcon } from "./icons";
import styles from "./landing.module.css";

export const REPO_URL = "https://github.com/AmaanAli1/recall";

const LINKS = [
  { href: "#pipeline", label: "How it works" },
  { href: "#spec", label: "Spec sheet" },
  { href: "#dyno", label: "Dyno results" },
] as const;

/** Marketing nav for the landing page (the app screens use AppHeader instead). */
export function MarketingNav() {
  return (
    <header className="relative border-b border-line">
      <nav aria-label="Main" className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-4 px-6 py-[18px]">
        <Logo size="lg" />
        <div className="flex flex-wrap gap-7 text-[15px] text-ink-2">
          {LINKS.map((l) => (
            // Plain anchors: LandingRoot turns these into the eased in-page scroll.
            <a key={l.href} href={l.href} className={`lnk ${styles.navLink}`}>
              {l.label}
            </a>
          ))}
        </div>
        <a
          href={REPO_URL}
          className="btn btn-ghost inline-flex items-center gap-2.5 rounded-[5px] px-4 py-[9px] text-[15px] font-medium"
        >
          <GitHubIcon />
          View on GitHub
        </a>
      </nav>
    </header>
  );
}
