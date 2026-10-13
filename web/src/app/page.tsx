import type { Metadata } from "next";
import { BackToTop } from "@/components/BackToTop";
import { Grain } from "@/components/Grain";
import { SiteFooter } from "@/components/SiteFooter";
import { DynoBench } from "./_landing/DynoBench";
import { Hero } from "./_landing/Hero";
import { LandingRoot } from "./_landing/LandingRoot";
import { MarketingNav } from "./_landing/MarketingNav";
import { Pipeline } from "./_landing/Pipeline";
import { SpecSheet } from "./_landing/SpecSheet";

// The root layout's default title is the landing title, so `absolute` keeps the template off it.
// `absolute` uses this exact title, without the "%s · Recall" template.
export const metadata: Metadata = { title: { absolute: "Recall" } };

/** Landing page. Server component; only the interactive sections ship client JS. */
export default function Home() {
  return (
    <LandingRoot>
      <Grain />
      <a href="#main" className="skip">Skip to content</a>
      <MarketingNav />
      <main id="main">
        <Hero />
        <Pipeline />
        <SpecSheet />
        <DynoBench />
      </main>
      <SiteFooter onLanding />
      <BackToTop />
    </LandingRoot>
  );
}
