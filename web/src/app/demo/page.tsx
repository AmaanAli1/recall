import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Preparing your demo" };

// Placeholder until feat/demo-boot lands.
export default function Page() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-paper px-6">
      <Link href="/ask" className="btn btn-red rounded-[5px] px-5 py-3 font-medium">Open my notebook</Link>
    </main>
  );
}
