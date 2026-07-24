# Quant Trader Prep

A beginner→expert **quant-trading interview prep course** with a Candy-Crush-style level map. Learn probability from the ground up, sharpen mental math, crack classic brainteasers, and price two-sided markets — with levels that unlock only when you demonstrate mastery.

This is a **polished MVP slice** built to the vision in the master PRD (`../seminar-engine+calibration/PRD.md`), scoped down to run entirely on `localhost` with no backend and no API keys.

---

## Quick start

```bash
npm install
npm run dev      # serves on http://localhost:5173 (or next free port)
```

Other scripts:

```bash
npm run build    # type-check (tsc -b) + production build to dist/
npm run preview  # preview the production build
npm run test     # run the generator/verifier unit tests (Vitest)
```

**No API keys or environment variables are required.** Everything runs client-side.

---

## What the MVP includes

- **Local-first accounts.** Create an account (username + password) and log in. Passwords are hashed (SHA-256 + per-user salt via Web Crypto) — never stored in plaintext. The session and all progress live in `localStorage`.
- **Auth gate.** All course content is behind a protected route; unauthenticated users are redirected to the login screen.
- **Four playable tracks**, each a Candy-Crush winding path of 4–5 levels:
  - **Probability / Math** — sample spaces → Bayes → expectation → genuinely hard interview problems (lattice paths, gambler's ruin, colliding random walks).
  - **Mental Math** — Zetamac / Optiver-style timed arithmetic and trader conversions.
  - **Brainteasers** — burning ropes, Monty Hall, 100 prisoners, blue-eyed islanders, and more.
  - **Interview Games** — EV, optimal stopping (re-roll games), Kelly sizing, and market making with adverse selection.
  - **Calibration Gym** — the eventual flagship, shown as a **“Coming soon”** teaser.
- **Mastery gating.** A level unlocks the next only after you pass it (≥ 70–80% depending on level). Per-level mastery, best score, XP, and a daily streak persist.
- **Lesson structure.** Each level opens with a **skippable** learning paragraph (“Skip — I already know this”), then questions with **instant per-question feedback** (correct/incorrect + explanation + why your specific wrong choice was tempting), then a **level-complete summary** that gates progression and fires **confetti** on mastery.
- **Save / resume mid-level.** Leave mid-level and your exact question set, position, and answers are restored on return.
- **Light + dark mode** with semantic contrast tokens — no text goes invisible in either theme.
- **Responsive** from 360px (mobile) to ≥1280px (desktop), with ≥44px touch targets.

---

## Content quality (the heart of the app)

Two complementary approaches, both aimed at **provably correct** questions with **pedagogically designed distractors** (each wrong option encodes a *specific* reasoning error, never a random number):

1. **Parametric generators with exact verifiers** (`src/content/**/generators.ts`). The true answer is computed deterministically from the parameters, so every item is correct by construction and can be regenerated fresh (contamination-proof). Used for probability fundamentals, all mental math, and the EV/Kelly/re-roll games.
2. **Hand-authored hard problems** (`src/content/**/levels.ts`) drawn from famous, well-established quant schemas (Green Book / Heard on the Street / firm-guide genres) in fresh wordings — never verbatim. The genuinely hard items carry worked solutions and are flagged `needsVerification` for expert review.

**Distractor design example** — for “P(A or B)”, the options are the values a student actually computes when they err:
`P(A)+P(B)` (forgot inclusion–exclusion), `P(A)·P(B)` (treated “or” as independent “and”), `P(A∩B)` (reported only the overlap), and the correct `P(A)+P(B)−P(A∩B)`. All options share the same numeric format so length never leaks the answer.

See **`CONTENT_NOTES.md`** for the full generator/question inventory, the distractor rationale per concept, and the list of hard items flagged for your verification.

---

## Architecture overview

```
src/
  types/            content + progress type definitions
  lib/
    rng.ts          seedable PRNG (mulberry32) — reproducible generated items
    hash.ts         Web Crypto password hashing (salt + SHA-256)
    storage.ts      StorageProvider interface + LocalStorageProvider  ← swap point
    celebrate.ts    confetti
  content/
    shared.ts       distractor assembly (retry-until-distinct)
    materialize.ts  turn a Level into a concrete, choice-shuffled question set
    probability/    generators.ts (exact) + levels.ts (hard hand-authored)
    mentalMath/     generators.ts + levels.ts
    brainteasers/   levels.ts (hand-authored classics)
    interviewGames/ generators.ts + levels.ts
    index.ts        track registry + unlock logic
    generators.test.ts   Vitest: proves generated answers are correct
  context/          Theme, Auth, Progress (React Context)
  components/       icons, AppShell
  pages/            Login, Home (dashboard), Track (map), Lesson (player)
```

### Swappable persistence (AWS-ready)

All auth + data access goes through the `StorageProvider` interface in `src/lib/storage.ts`. The app never touches `localStorage` or a remote backend directly. Moving to Amazon Cognito (username + email sign-in aliases + Google federated sign-in) + DynamoDB later means writing an `AwsStorageProvider` with the same shape and changing **one line** (the exported `storage` instance) — no component or context changes.

---

## Design language — "a trader's desk as a financial broadsheet"

The UI deliberately avoids the generic "AI-generated / modern SaaS" look (no purple gradients, no glassmorphism, no blurry glowing blobs, no rounded gradient cards). Instead it commits to one cohesive, characterful aesthetic: a **fusion of a Bloomberg-style trading terminal and a Financial-Times-style print broadsheet** — dense, typeset, hairline-ruled, and editorial.

- **Typography:** `Fraunces` (a high-contrast display serif) for nameplates and headlines; `Archivo` (a crisp grotesque) for body/UI; `IBM Plex Mono` for all data, tickers, tabular numbers, and the small-caps annotation labels. Real hierarchy, no generic system-font wall.
- **Color (two themes with real character):**
  - **Light = "newsprint":** a warm FT-salmon paper (`#f9edE0`), near-black ink, a deep-ochre accent, and bull-green / bear-red signals.
  - **Dark = "terminal":** a warm near-black (`#0c0b08`), phosphor-amber accent, warm off-white text, terminal green/red.
  - All colors are semantic CSS-variable tokens (`--color-text-primary`, `--color-bg`, `--color-accent`, `--color-bull`, …). **No hard-coded `text-white`/`text-black`** in components, so contrast stays WCAG-AA in **both** themes (verified by headless screenshots in light + dark + mobile).
- **Texture over gradients:** subtle paper/phosphor grain (SVG turbulence), a faint ledger/plotting-paper grid, and engraving-style hatching — never gradients or blur. Panels use **hairline borders and editorial double-rules instead of drop shadows**, with sharp corners.
- **Background animation (behind content, 60fps, `prefers-reduced-motion`-aware):** a `DeskBackground` layer with slowly drifting **candlestick silhouettes**, a **price path that draws itself**, and the ledger grid; plus a scrolling **ticker tape** of quant "quotes" (E[HH] 6.00, KELLY.f 0.20, 1/e 0.368…). All pure CSS/SVG; static fallback under reduced-motion.
- **Signature screens:**
  - The **level map** is a **charted price route on plotting paper**: square terminal nodes (amber "live" node with a blinking marker, green "Filled" mastered nodes, hollow locked nodes) joined by a plotted line that's solid-green through mastered edges, amber on the active edge, and dashed on locked edges.
  - **Feedback is a trade ticket** (`● FILLED — CORRECT` / `● REJECTED — INCORRECT`).
  - **Level completion is a settlement statement** with a slammed-in **rubber-stamp seal** (`MASTERED` / `UNDER REVIEW`), a P&L-style `+XP` pop, and restrained amber/green square "tick" particles (no rainbow confetti).

## Pages & routing

| Route | Access | Purpose |
|---|---|---|
| `/` | **Public + auth-aware** | The **landing page is the home for everyone**. Logged out → marketing hero + feature sections + "Get Started / Log In". Logged in → the *same page*, but the header shows **Log Out** + Streak·XP and the CTAs become app-entry actions ("Your Tracks →", "Continue → {next track}"), the curriculum tiles link into tracks, and the closing CTA becomes "Resume". |
| `/login` | Public | Create-account / log-in (accepts `?mode=login` to open on the log-in tab). On success → `/`. |
| `/dashboard` | — | **Retired.** Redirects to `/` (kept only so any stale link resolves). |
| `/track/:trackId` | Auth | A track's Candy-Crush charted-route map (in the `AppShell`, whose nav "Home" returns to `/`). |
| `/track/:trackId/level/:levelId` | Auth | The immersive lesson player. |

**Routing decision:** there is no separate progress dashboard — each track map already shows its own progress, so the **landing page doubles as the authenticated home**. `/` renders auth-aware: signed-in users see Log Out + app-entry CTAs and jump straight into their next unmastered track. All lesson/map routes remain gated behind auth exactly as before.

The landing page extends the same **broadsheet-terminal** design language with bespoke, on-theme visuals for each feature: the charted **roadmap route**, a **reliability diagram** + grand-reveal trade ticket (Calibration Gym), a **Socratic hint-ladder** with a redacted answer, a **regenerating verifier-checked question** card, a **curriculum contact-sheet**, and a **mental-math speed drill** with a countdown ring — plus the animated candlestick/ticker desk background. Copy is benefit-driven and grounded in the PRD (no invented stats or testimonials).

## Themes

The app ships **6 visual themes**, switchable live from the **Themes** tab (top nav) and persisted to `localStorage`:

1. **Broadsheet** (default) — the trader's-desk financial-broadsheet look.
2. **Minimalist** — Swiss/monochrome, single signal-red accent.
3. **Kids / Cartoon** — candy colors, rounded shapes, per-level cartoon illustrations.
4. **Cyberpunk** — neon cyan + magenta on a glowing wire grid.
5. **Chalkboard** — chalk handwriting on a slate board.
6. **Casino** — green felt, antique gold, cards/chips/dice.

Themes change **only aesthetics** (never content, copy, or layout) via semantic CSS-variable tokens, and light/dark still toggles within any theme. Each theme also decorates every level node on the track maps with its own distinct per-level "station" artwork (via the `getMapStation` hook) — a different landmark per level and per track (e.g. kids = amusement-park rides, casino = card-room plaques, broadsheet = engraved vignettes). Each theme lives in its own isolated folder `src/themes/<id>/`; the contract and authoring guide are in **`THEMES.md`**. All 6 themes are verified WCAG-AA (no invisible/low-contrast text) in both light and dark.

## What's deferred (per PRD, out of MVP scope)

- **Amazon Cognito (username + email sign-in aliases + Google federated sign-in) + DynamoDB** (the local-first layer is built behind a swappable interface for exactly this).
- **Runtime AI question generation** and the **Socratic tutor** (hints-not-answers) — the typed content model leaves room for a generator/tutor plug-in.
- **The full Calibration Gym** (timer → grand reveal → confetti → teach-on-loss, reliability diagram, model head-to-head) — shipped here only as a teaser card.
- **Readiness engine, Mock Interview, firm profiles, and the fine-tuned model** — future workstreams.

---

## Tech stack

React 18 · TypeScript · Vite 5 · Tailwind CSS 3 · React Router v6 · Vitest · canvas-confetti. Fonts: Fraunces, Archivo, IBM Plex Mono. State via React Context + local hooks. Fully client-side, no API keys.
