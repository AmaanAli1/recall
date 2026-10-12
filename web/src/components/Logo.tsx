import Link from "next/link";

/** [ || ] recall — the wordmark. Hover draws the highlighter and opens the brackets. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const bracket = size === "lg" ? 20 : 18;
  const bar = size === "lg" ? 18 : 16;
  const word = size === "lg" ? 19 : 17;
  return (
    <Link href="/" className="logo inline-flex items-center gap-1.5" aria-label="Recall home" translate="no">
      <span aria-hidden="true" className="logo-bl font-mono text-red" style={{ fontSize: bracket }}>[</span>
      <span aria-hidden="true" className="flex gap-[3px]" style={{ transform: "skewX(-18deg)" }}>
        <span className="block w-1 bg-red" style={{ height: bar }} />
        <span className="block w-1 bg-red opacity-45" style={{ height: bar }} />
      </span>
      <span aria-hidden="true" className="logo-br font-mono text-red" style={{ fontSize: bracket }}>]</span>
      <span className="logo-word ml-1 font-semibold tracking-[-0.015em]" style={{ fontSize: word }}>recall</span>
    </Link>
  );
}
