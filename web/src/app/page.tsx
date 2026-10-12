// Temporary home page for the CI setup PR. The real landing page lands in feat/landing.
export default function Home() {
  return (
    <main className="relative grid min-h-dvh place-items-center bg-paper px-6 text-ink">
      <div className="max-w-xl text-center">
        <p className="font-mono text-sm text-ink-2" translate="no">
          <span className="text-red">[</span>recall<span className="text-red">]</span>
        </p>
        <h1 className="mt-4 text-5xl font-normal tracking-tight">
          Ask your notes. Get answers{" "}
          <span className="font-mono text-red">[</span>cited<span className="font-mono text-red">]</span> to the page.
        </h1>
        <p className="mt-6 text-lg text-ink-2">The frontend is being built in small pull requests. Back soon.</p>
      </div>
    </main>
  );
}
