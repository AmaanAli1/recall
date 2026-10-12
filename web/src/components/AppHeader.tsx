"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DemoChip } from "./DemoChip";
import { Logo } from "./Logo";

const LINKS = [
  { href: "/ask", label: "Ask" },
  { href: "/library", label: "Library" },
  { href: "/dyno", label: "Dyno" },
] as const;

/** App navigation for Ask · Library · Dyno (Landing has its own marketing nav). */
export function AppHeader() {
  const path = usePathname();
  return (
    <header className="relative border-b border-line">
      <nav aria-label="Main" className="flex flex-wrap items-center justify-between gap-4 px-6 py-3.5">
        <Logo />
        <div className="flex gap-1 text-sm">
          {LINKS.map((l) => {
            const current = path === l.href || path.startsWith(`${l.href}/`);
            return current ? (
              <Link key={l.href} href={l.href} aria-current="page" className="rounded px-3 py-2 font-medium">
                <span aria-hidden="true" className="text-red">[</span>
                {l.label}
                <span aria-hidden="true" className="text-red">]</span>
              </Link>
            ) : (
              <Link key={l.href} href={l.href} className="nav-l rounded px-3 py-2 text-ink-2">
                {l.label}
              </Link>
            );
          })}
        </div>
        <DemoChip />
      </nav>
    </header>
  );
}
