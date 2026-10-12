import type { Metadata } from "next";
import { AskWorkspace } from "./_components/AskWorkspace";

export const metadata: Metadata = { title: "Ask" };

/** Ask: question → cited answer, with the sources it came from alongside. */
export default function Page() {
  return (
    <main id="main" className="relative flex min-h-0 w-full flex-1 flex-col">
      <AskWorkspace />
    </main>
  );
}
