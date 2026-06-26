// 'use client' marks this as a browser component — required because we use
// the canvas API and animation, which only exist in the browser.
'use client';

import { useRef, useEffect , useState} from 'react';

export default function LoginPage() {
  // useRef gives us a direct handle to the <canvas> element so we can draw on it.
  // It starts as null and React fills it in once the canvas is on screen.
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // useEffect runs AFTER the page renders. We start the particle animation here.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return; // safety: bail if the canvas isn't ready

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Respect users who prefer no motion — give them a still canvas.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;

    // Size the canvas to its container, accounting for screen pixel density.
    function size() {
      const dpr = window.devicePixelRatio || 1;
      width = canvas!.offsetWidth;
      height = canvas!.offsetHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    // Create the particles — each has a position, a slow velocity, and a radius.
    const N = 28;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.18, // slow horizontal drift
      vy: (Math.random() - 0.5) * 0.18, // slow vertical drift
      r: Math.random() * 1.6 + 1,
    }));

    let animationId: number;

    // One frame of the animation: move particles, draw connecting lines, draw dots.
    function frame() {
      ctx!.clearRect(0, 0, width, height);

      // Move each particle; bounce it off the panel edges.
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
      }

      // Draw a faint line between any two particles that are close together.
      for (let i = 0; i < N; i++) {
        for (let j = i + 1; j < N; j++) {
          const a = pts[i], b = pts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 100) {
            ctx!.strokeStyle = `rgba(47,107,255,${0.16 * (1 - d / 100)})`;
            ctx!.lineWidth = 0.6;
            ctx!.beginPath();
            ctx!.moveTo(a.x, a.y);
            ctx!.lineTo(b.x, b.y);
            ctx!.stroke();
          }
        }
      }

      // Draw the particle dots.
      for (const p of pts) {
        ctx!.fillStyle = 'rgba(91,134,255,0.65)';
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Schedule the next frame — unless the user prefers reduced motion.
      if (!reduce) animationId = requestAnimationFrame(frame);
    }
    frame();

    // CLEANUP: runs when the page unmounts. Stop the loop and remove the listener
    // so we don't leak memory or keep animating a screen that's gone.
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', size);
    };
  }, []); // the empty [] means "run this once, after the first render"

  // Typewriter effect: types a phrase out, pauses, deletes it, types the next.
  const phrases = ['Learn faster', 'AI flashcards', 'Smart summaries', 'Chat with your notes'];
  const [typed, setTyped] = useState('');      // the text currently shown
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = phrases[phraseIndex];

    // Speeds: typing is slower than deleting; long pause when a word is complete.
    let delay = deleting ? 45 : 90;
    if (!deleting && typed === current) {
      delay = 1600; // full word shown — hold before deleting
    } else if (deleting && typed === '') {
      delay = 400;  // fully deleted — short pause before next word
    }

    const timer = setTimeout(() => {
      if (!deleting && typed === current) {
        // Word fully typed → start deleting.
        setDeleting(true);
      } else if (deleting && typed === '') {
        // Word fully deleted → move to next phrase, start typing.
        setDeleting(false);
        setPhraseIndex((prev) => (prev + 1) % phrases.length);
      } else {
        // Add or remove one character.
        setTyped(current.slice(0, deleting ? typed.length - 1 : typed.length + 1));
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [typed, deleting, phraseIndex]);

  return (
    <div className="flex h-screen">

      {/* LEFT PANEL — the form */}
      <div className="flex-1 flex items-center justify-center bg-[#0d0f12] relative overflow-hidden">

        {/* Soft static glow behind the card — ambient, not animated. */}
        <div className="absolute w-[420px] h-[320px] rounded-full bg-[#2f6bff] opacity-[0.06] blur-[100px] pointer-events-none" />

        {/* relative + z-10 keeps the form above the glow */}
        <div className="w-[360px] flex flex-col relative z-10">

          {/* Logo + wordmark, above the card */}
          <div className="flex items-center gap-2 mb-6">
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#2f6bff" />
              <circle cx="11" cy="12" r="2.3" fill="#fff" />
              <circle cx="21" cy="11" r="2.3" fill="#fff" />
              <circle cx="16" cy="20" r="2.3" fill="#fff" />
              <circle cx="22" cy="21" r="1.8" fill="#bcd0ff" />
              <line x1="11" y1="12" x2="21" y2="11" stroke="#fff" strokeWidth="1.1" opacity="0.7" />
              <line x1="11" y1="12" x2="16" y2="20" stroke="#fff" strokeWidth="1.1" opacity="0.7" />
              <line x1="21" y1="11" x2="16" y2="20" stroke="#fff" strokeWidth="1.1" opacity="0.7" />
              <line x1="16" y1="20" x2="22" y2="21" stroke="#fff" strokeWidth="1.1" opacity="0.5" />
            </svg>
            <span className="text-[#e8eaed] text-[18px] font-medium">Recall</span>
          </div>

          {/* THE CARD — wraps the whole form */}
          <div className="bg-[#15181d] border border-[#1f2329] rounded-xl p-7">

            <h1 className="text-[#e8eaed] text-[22px] font-medium mb-1">Welcome back</h1>
            <p className="text-[#8b9096] text-[13px] mb-6">Sign in to continue studying</p>

            <label className="text-[#b4b9c0] text-[11px] mb-1.5 block">Email</label>
            <input
              type="text"
              placeholder="you@example.com"
              className="w-full bg-[#0d0f12] border border-[#2a2f37] rounded-lg px-3 py-2.5 text-[#e8eaed] text-[13px] mb-4 outline-none focus:border-[#2f6bff] transition-colors"
            />

            <label className="text-[#b4b9c0] text-[11px] mb-1.5 block">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-[#0d0f12] border border-[#2a2f37] rounded-lg px-3 py-2.5 text-[#e8eaed] text-[13px] mb-2 outline-none focus:border-[#2f6bff] transition-colors"
            />

            {/* Forgot password — right-aligned */}
            <div className="text-right mb-5">
              <span className="text-[#2f6bff] text-[11px] cursor-pointer hover:underline">Forgot password?</span>
            </div>

            {/* Sign in */}
            <button className="w-full bg-[#2f6bff] text-white text-[13px] font-medium rounded-lg py-2.5 mb-4 hover:shadow-[0_0_22px_0_rgba(47,107,255,0.55)] transition-all">
              Sign in
            </button>

            {/* Divider with "or" */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="flex-1 h-px bg-[#1f2329]" />
              <span className="text-[#8b9096] text-[11px]">or</span>
              <div className="flex-1 h-px bg-[#1f2329]" />
            </div>

            {/* Continue with Google */}
            <button className="w-full bg-[#0d0f12] border border-[#2a2f37] rounded-lg py-2.5 text-[#e8eaed] text-[12px] flex items-center justify-center gap-2 hover:border-[#3a4250] transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 4.75 12 4.75z"/>
              </svg>
              Continue with Google
            </button>

          </div>

          {/* Switch to sign up — below the card */}
          <p className="text-[#8b9096] text-[12px] text-center mt-5">
            New here? <span className="text-[#2f6bff] cursor-pointer hover:underline">Create an account</span>
          </p>

        </div>
      </div>

      {/* RIGHT PANEL — layered: ambient particles + process flow + rotating text */}
      <div className="flex-1 relative overflow-hidden bg-[#0a0c0f] border-l border-[#1f2329] flex flex-col items-center justify-center">

        {/* LAYER 1 (back): ambient particle canvas */}
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-60" />

        {/* LAYER 2 (mid): horizontal flow — stages + arrows that glow in sequence */}
        <div className="relative z-10 flex items-center gap-4 mb-8">

          {/* Stage 1 — Your notes */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-16 rounded-lg bg-[#15181d] border border-[#2a2f37] flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#5b86ff" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6M9 13h6M9 17h6" />
              </svg>
            </div>
            <span className="text-[#8b9096] text-[11px]">Your notes</span>
          </div>

          {/* Arrow 1 */}
          <svg className="recall-arrow recall-arrow-1 mb-6" width="26" height="12" viewBox="0 0 26 12" fill="none" stroke="#2f6bff" strokeWidth="1.5">
            <path d="M0 6h23M18 1l5 5-5 5" />
          </svg>

          {/* Stage 2 — Recall AI */}
          <div className="recall-grow recall-step-2 flex flex-col items-center gap-2">
            <div className="w-16 h-16 rounded-xl bg-[#2f6bff] flex items-center justify-center recall-core-glow">
              <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
                <circle cx="11" cy="12" r="2.3" fill="#fff" />
                <circle cx="21" cy="11" r="2.3" fill="#fff" />
                <circle cx="16" cy="20" r="2.3" fill="#fff" />
                <circle cx="22" cy="21" r="1.8" fill="#bcd0ff" />
                <line x1="11" y1="12" x2="21" y2="11" stroke="#fff" strokeWidth="1.1" opacity="0.7" />
                <line x1="11" y1="12" x2="16" y2="20" stroke="#fff" strokeWidth="1.1" opacity="0.7" />
                <line x1="21" y1="11" x2="16" y2="20" stroke="#fff" strokeWidth="1.1" opacity="0.7" />
                <line x1="16" y1="20" x2="22" y2="21" stroke="#fff" strokeWidth="1.1" opacity="0.5" />
              </svg>
            </div>
            <span className="text-[#e8eaed] text-[11px] font-medium">Recall AI</span>
          </div>

          {/* Arrow 2 */}
          <svg className="recall-arrow recall-arrow-2 mb-6" width="26" height="12" viewBox="0 0 26 12" fill="none" stroke="#2f6bff" strokeWidth="1.5">
            <path d="M0 6h23M18 1l5 5-5 5" />
          </svg>

          {/* Stage 3 — Instant answers */}
          <div className="flex flex-col items-center gap-2">
            <div className="px-4 py-3 rounded-lg rounded-bl-none bg-[#15181d] border border-[#2a2f37] flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5b86ff]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#5b86ff]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#5b86ff]" />
            </div>
            <span className="text-[#8b9096] text-[11px]">Instant answers</span>
          </div>

        </div>

        {/* LAYER 2b: rotating phrase — terminal typewriter */}
        <div className="relative z-10 flex items-center justify-center gap-2 h-7 font-mono">
          <span className="text-[#2f6bff] text-[18px]">{'>'}</span>
          <span className="text-[#e8eaed] text-[17px] font-medium">{typed}</span>
          <span className="recall-cursor text-[#2f6bff] text-[18px]">_</span>
        </div>

        {/* Tagline pinned bottom */}
        <div className="absolute bottom-9 left-8 right-8 z-10">
          <p className="text-[#e8eaed] text-[15px] font-medium leading-relaxed mb-1.5">
            Your notes, instantly searchable.
          </p>
          <p className="text-[#8b9096] text-[12px] leading-relaxed">
            Recall turns your course material into answers — ask anything, grounded in what you uploaded.
          </p>
        </div>

      </div>

    </div>
  );
}