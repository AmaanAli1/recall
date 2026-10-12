import type { Metadata } from "next";
import { BackToTop } from "@/components/BackToTop";
import { SiteFooter } from "@/components/SiteFooter";
import { LibraryScreen } from "./_components/LibraryScreen";

export const metadata: Metadata = { title: "Library" };

/** Library: course PDFs, split into passages Recall can search and cite. */
export default function Page() {
  return (
    <>
      <LibraryScreen />
      <SiteFooter />
      <BackToTop />
    </>
  );
}
