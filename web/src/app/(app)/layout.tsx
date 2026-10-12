import { AppHeader } from "@/components/AppHeader";
import { Grain } from "@/components/Grain";

/** Shell for the app screens (Ask · Library · Dyno): skip link, grain, app nav. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div id="top" className="relative flex min-h-dvh flex-col bg-paper text-ink">
      <Grain />
      <a href="#main" className="skip">Skip to content</a>
      <AppHeader />
      {children}
    </div>
  );
}
