import type { Metadata } from "next";
import { BackToTop } from "@/components/BackToTop";
import { SiteFooter } from "@/components/SiteFooter";
import { DynoScreen } from "./_components/DynoScreen";

export const metadata: Metadata = { title: "Dyno" };

/** Dyno: every retrieval change measured against the baseline, with a redline gate. */
export default function Page() {
  return (
    <>
      <DynoScreen />
      <SiteFooter />
      <BackToTop />
    </>
  );
}
