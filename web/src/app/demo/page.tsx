import type { Metadata } from "next";
import { Grain } from "@/components/Grain";
import { DemoBoot } from "./_components/DemoBoot";

export const metadata: Metadata = { title: "Preparing your demo" };

/**
 * /demo sits outside the (app) group on purpose: no nav while the session is
 * being issued, just the card centred on a full-height sheet of paper.
 */
export default function Page() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-paper px-4 py-12 text-ink sm:px-6">
      <Grain />
      <DemoBoot />
    </div>
  );
}
