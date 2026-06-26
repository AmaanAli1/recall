# Recall — Design System & Screens

The visual language for Recall and per-screen design specs. Aesthetic:
dark, sleek, developer-tool feel with an electric blue accent.

## Palette
- Page background: `#0d0f12` (near-black)
- Right brand panel: `#0a0c0f` (slightly darker)
- Card / surface: `#15181d`
- Borders: `#1f2329` (subtle), `#2a2f37` (inputs), `#3a4250` (hover)
- Text: primary `#e8eaed`, secondary/muted `#8b9096`, label `#b4b9c0`
- Accent (buttons, links, focus): `#2f6bff` (electric blue), lighter `#5b86ff`
- Success: a distinct green (e.g. `#15b884`) — never reuse the accent blue for success

## Logo
Connected-node cluster (three+ linked dots) on a blue rounded square — reads as
both a brain/neural motif and a knowledge graph / embedding network. Stored at
`docs/diagrams/recall-logo.svg`. This connected-dots motif is a recurring brand
element (echoed in the auth background, loading states, etc.).

## Motion principles
- Subtle and slow. Motion makes screens feel alive without demanding attention.
- ALWAYS respect `prefers-reduced-motion` — provide a static fallback.
- Keep animations GPU-light (transform/opacity, lightweight canvas) to spare battery.

## Interaction states (apply app-wide)
- Buttons: blue glow + slight lift on hover.
- Inputs: border brightens on hover; blue border + soft blue glow ring on focus.

---

## Screen: Auth (login / sign up)
Reference: `docs/diagrams/auth-screen-reference.html` (open in browser).

**Layout:** Split-screen. Left = form panel; right = brand canvas.
- Left: logo + wordmark, "Welcome back" heading, email + password fields (with
  mail/lock icons, password show/hide eye), "Forgot password?", primary "Sign in"
  button, "Continue with Google" (OAuth), and a link to switch to sign up.
- Right: ambient drifting-particle animation (nodes + fading connection lines, in
  blue) over `#0a0c0f`, with a tagline pinned bottom-left. Echoes the logo motif;
  reads as "intelligent/digital" without requiring the viewer to know RAG.
- Left panel also has a very slow, faint blue radial glow drifting behind the form.

**Behavior notes:**
- Login and sign up share this layout (toggle or sibling routes — TBD in build).
- Google OAuth and forgot-password are real (Supabase supports both) but can be
  deferred to fast-follows after email/password works, to keep Phase 2 lean.
- Particle animation + glow both respect `prefers-reduced-motion`.

**Build status:** Designed. Built in Phase 2 (auth).