import type { Metadata } from "next";

export const metadata: Metadata = { title: "Library" };

// Placeholder until feat/library lands.
export default function Page() {
  return (
    <main id="main" className="relative mx-auto w-full max-w-[1200px] flex-1 px-6 py-14">
      <h1 className="text-[54px] font-normal leading-tight tracking-[-0.036em]">Library</h1>
      <p className="mt-3 text-ink-2">This screen is being built.</p>
    </main>
  );
}
