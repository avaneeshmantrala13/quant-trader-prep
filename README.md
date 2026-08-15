# The Quant Factory

**The Quant Factory** is a quant-trading interview prep web app that turns the sprawling, intimidating quant-interview canon (probability, mental math, brainteasers, market-making, and cognitive-aptitude screens) into a single, guided path to "interview-ready." Instead of a pile of practice problems, it runs each learner through one **linear pipeline** — diagnose → play → drill → mock — driven by an **adaptive mastery engine** that measures what you actually know, targets the exact difficulty where you learn fastest, and only greenlights you once you have provably mastered every prerequisite. Every question is machine-verified, and the final mock interview is graded by an LLM that can *localize and explain* your mistakes but can *never* decide whether you were right — correctness is always owned by deterministic verifiers.

---

## Features

- **One guided pipeline, no free-roam maze.** A seven-stage linear flow takes a new user from a cold diagnostic all the way to a "greenlight," with each stage gated by live, re-derivable mastery (readiness can be *revoked* if your mastery decays).
- **Adaptive difficulty (the "85% rule").** Every item is chosen to sit in your Zone of Proximal Development — hard enough to stretch you, easy enough that you succeed ~85% of the time — using Elo/Glicko/IRT/Thompson calibration on top of Bayesian mastery estimates.
- **A prerequisite-aware remediation cascade.** Miss something and the engine doesn't just re-ask it; it decides whether that was a slip or a real gap, and if it's a gap it descends the prerequisite graph to find and teach the weakest underlying skill.
- **An effectively-infinite, machine-verified question bank.** Every shipped question is a parametric variant whose true answer is computed by a deterministic code verifier, whose distractors encode *specific* misconceptions, and which must clear an automated "interview-grade" acceptance gate before it can ship.
- **An LLM mock interviewer that can't be jailbroken.** The model extracts and explains your reasoning and highlights green/red spans, but a separate deterministic verifier owns the verdict — so no amount of confident-sounding prose changes a wrong answer into a right one.
- **A battery of trading-intuition games** (market-making, card counting, arbitrage/de-vig, Fermi estimation, and Optiver-style cognitive drills) decomposed into 11 first-class competency subtopics, each folded into the same mastery model as academic content.
- **Local-first by default, AWS-ready.** Runs entirely in the browser with no backend or keys; flip one env var to run on real AWS accounts with cross-device progress sync.

---

## The guided pipeline

The authenticated experience is a single **linear state machine** (`src/lib/pipeline/`). A brand-new user starts at stage one; the router (`resolveStage`) re-derives the correct stage on every load purely from progress stamps + **live** mastery gates, so it is impossible to skip ahead and readiness can be walked back if mastery decays.

The seven in-app stages (`stageOrder` in `src/lib/pipeline/stateMachine.ts`):

1. **Untimed diagnostic** — a low-pressure baseline read of what you know.
2. **Timed diagnostic** — the same, under interview time pressure.
3. **Trading-intuition games battery** — the market-making / probability / cognitive games (see below).
4. **Backend diagnosis** — computes where you actually stand and what to fix (`diagnosis.ts`).
5. **Drilling** — adaptive, remediation-driven practice until every content node is mastered.
6. **Mock interview** — the LLM-run mock (must clear the accuracy bar over consecutive mocks).
7. **Greenlight** — the terminal "you're interview-ready" stage.

The **gates** (`src/lib/pipeline/gates.ts`) are pure predicates re-evaluated from **live** mastery on every call — they never trust a latched "cleared" stamp. If a topic's Beta posterior decays back below the mastery bar (a *relock*), the drilling gate flips back to `false` and the router pulls the user back into drilling. In other words, the greenlight is earned continuously, not once.

---

## The adaptive learning engine

Everything the app decides about *what to show you next* and *whether you've mastered something* comes from `src/lib/mastery/*`, `src/lib/remediation/*`, and `src/lib/roadmap/*`. In plain English:

- **Bayesian mastery per topic.** Each topic's skill is tracked as a Beta posterior over your success probability. A topic counts as **mastered** only when the *lower* end of its 95% credible interval clears the bar (`CI_low ≥ 0.80`) — i.e. we're statistically confident you're good, not just that you got lucky once (`src/lib/mastery/{beta,verdict,mastery}.ts`, `config.ts`).
- **Difficulty calibration to the ~85% band.** Item difficulty and your ability are co-estimated with Elo, and refined where there's enough evidence by Glicko (difficulty), a 2PL IRT ability fit, and Thompson sampling for principled exploration. The selector always aims for the difficulty where your predicted success is closest to the target band (Wilson et al.'s "85% rule"). See `elo.ts`, `glicko.ts`, `irt.ts`, `thompson.ts`, and `remediation/policy.ts` (`probeTierFor`).
- **A prerequisite knowledge graph (KST).** Topics are arranged in a prerequisite DAG (Doignon & Falmagne's knowledge-space theory), so the engine knows which skills sit underneath which (`src/lib/roadmap/skillGraph.ts`, `src/content/remediation/prereqDAG.ts`).
- **A remediation cascade** (`src/lib/remediation/policy.ts`). When you miss something the engine runs an ordered decision: *don't over-correct the first stumble* (Kapur), *ignore a fast-and-confident miss as a slip*, and only on a confirmed gap **descend** to the weakest/implicated prerequisite (probed at ~85%), **teach the composition edge** once you clear the outer fringe, or **teach at the floor** (Vygotsky) — with a depth cap so descent always terminates.

Because mastery, difficulty, and the graph are all pure functions of stored progress, the same numbers drive the pipeline gates, the roadmap/readiness view, and the drill selector with no duplicated logic.

---

## The question bank & verifier pipeline

The bank is designed to be **effectively infinite and correct by construction**. The ingestion/generation flow:

1. **Scraped seeds** provide realistic problem *schemas* (never shipped verbatim).
2. A **deterministic code verifier** computes the *true* answer from first principles — exact enumeration, closed forms, or dynamic programming (`src/lib/mock/archetypes/verifiers.ts`, `src/lib/oa/hardContent/solvers.ts`, and the per-track generators). Every verifier is cross-checked with an exact unit test *and* a Monte-Carlo sanity test.
3. **Wrong answers / traps are enumerated** deterministically, each encoding a *specific* reasoning error — these feed both the Socratic **hint ladder** and misconception attribution (so a miss can be tied to *why* you missed it).
4. **Parametric variants are generated** from each verified schema, and **only variants ship** (contamination-proof; the seed itself never appears).
5. Each candidate passes **content-signature dedup**, a **difficulty floor**, and an automated **"interview-grade" acceptance gate** before it's allowed into the pool (`src/lib/mock/{interviewGate,interviewRubric,reasoningEval}.ts`, `difficulty-floor.test.ts`).

The net effect: every item a learner sees is fresh, provably correct, and pedagogically designed, with distractors that mean something.

---

## The LLM mock interviewer

The mock interview (`src/lib/mock/*`, client helper `aiMock.ts`) uses an **extract-and-verify** architecture that makes the grader **non-jailbreakable**:

- The **LLM only translates** your spoken/typed reasoning into structured claims and **localizes/explains spans** of your answer. It never decides correctness.
- A **deterministic verifier owns the verdict.** The quality judgment is computed from the extracted claims by pure code (`claims.ts`, `reasoning.ts`), anchored to the verifier's true answer — so confident-but-wrong prose can't earn credit, and adversarial prompts can't flip a grade.
- The UI shows **green/red span highlighting**, including **partial-credit greens** on an otherwise-missed answer, a **"commit to one answer" clarify** second chance, a **model-answer reveal**, and an **adversarial follow-up taxonomy** (generalize-n / invert / add-constraint / change-regime / adversarial-trap / act-on-it) with a follow-up difficulty floor.

**Wiring.** The client's only networked module (`aiMock.ts`) POSTs to an **AI Lambda** (`infra/lambda/ai-flavor/`) that calls the LLM through an **OpenAI-compatible gateway** — production is configured for **Claude Sonnet** via the **TrueFoundry** gateway, though the provider, model, and base URL are all CloudFormation parameters (`infra/cloudformation/quant-trader-prep-ai.yaml`). The endpoint is **Cognito-JWT-gated**, has a per-user daily quota, and reads the **provider API key from SSM Parameter Store (SecureString)** at runtime — the key is **never** in the client bundle or any `VITE_*` var. For local development, `scripts/ai-dev-server.mjs` runs the *same* shared router (`core.mjs`) on `localhost`, so local grading behaves identically to production while keeping the key server-side. If the AI layer is off/stubbed/unreachable, every mode falls back to a deterministic pure implementation.

---

## Trading-intuition games

Stage 3 is a battery of games, each mapped to one **first-class competency subtopic** (`src/lib/mastery/tradingSubtopics.ts`, 11 subtopics) that folds into the same Beta mastery model as everything else. The aggregate "trading-intuition" node is mastered only when *every* subtopic clears its bar; a weak subtopic keeps the drilling gate open and routes you straight back to that exact game. The games include:

Spread-setting / market-making (`make-market`), live quoting & inventory management (`trading-floor`), conditional pricing / value of information (`cards-mm`), card counting + Kelly sizing (`next-card`), arbitrage / de-vig (`arbitrage`), Fermi estimation (`fermi`), and Optiver-style cognitive drills — sequence patterns (`numberlogic`), rapid EV under time (`beat-the-odds`), go/no-go attention (`stockmaster`), modular arithmetic (`number-box`), and mental rotation (`shape-shift`).

---

## Tech stack

- **Frontend:** React 18 · TypeScript 5.6 · Vite 5 · Tailwind CSS 3 · React Router 6
- **Testing:** Vitest 2 (300+ test files; thousands of unit + runtime tests) · Testing Library · jsdom
- **AWS (optional backend):** Amazon **Cognito** (auth), **DynamoDB** (progress), **API Gateway + Lambda** (privileged writes + AI grading), **Amplify** (hosting). AWS SDK v3.
- **Utilities:** `fraction.js` (exact rationals), `canvas-confetti`.

The client is fully static and driven by `VITE_*` environment variables; **no secrets ever live in the client bundle** — the AI provider key lives only in SSM (prod) or a gitignored `.env.local` (local dev).

---

## Architecture

**Client (static SPA).** All auth + data access goes through a single `StorageProvider` interface (`src/lib/storage.ts`), so components never touch `localStorage` or AWS directly. There are two implementations behind that seam:

- **Local-first (default):** accounts + progress in `localStorage`; passwords hashed with the Web Crypto API (per-user salt + SHA-256). No backend, no keys.
- **AWS backend:** `AwsStorageProvider` (`src/lib/awsStorage.ts`, config in `awsConfig.ts`) backed by **Cognito** + **DynamoDB**. Switching backends is a single env var (`VITE_STORAGE_BACKEND`) — no component or context changes.

**Serverless backend (optional).** Deployed via CloudFormation (`infra/cloudformation/*.yaml`):

- **Main stack** — Cognito User Pool + Identity Pool, DynamoDB progress table, and a privileged API.
- **AI stack** — HTTP API + **Cognito JWT authorizer**, the AI-grading Lambda (SSM-backed key, per-user daily quota), plus a TTS route for the mock interviewer's voice.
- **Community / leaderboard stacks** — additive social features.

The purity discipline is deliberate: the mastery/pipeline/remediation/verifier code is all **pure** (no React, DOM, storage, or network), which is what makes it exhaustively unit-testable and safe to reuse across the pipeline, the roadmap, and the drill selector.

---

## Getting started (local dev)

Requirements: Node 18+ and npm.

```bash
git clone https://github.com/avaneeshmantrala13/quant-trader-prep.git
cd quant-trader-prep
npm install
npm run dev        # http://localhost:5173 (or next free port)
```

With **no `.env` file at all**, the app builds and runs entirely in the browser (local-first accounts + progress in `localStorage`). No keys or environment variables are required for the core experience.

### Optional: real LLM mock grading on localhost

To run the *real* LLM grader locally (no AWS), start the local AI endpoint and point the client at it:

```bash
# 1) Put your provider key in a gitignored .env.local (server-only; NOT a VITE_ var):
#      AI_PROVIDER_API_KEY=...          # your OpenAI/Anthropic/gateway key
#      AI_PROVIDER=openai               # or "anthropic"
#      AI_PROVIDER_MODEL=...            # optional model id
# 2) Enable the client AI layer in .env.local:
#      VITE_AI_LAYER=on
#      VITE_AI_ENDPOINT=http://localhost:8788
# 3) Run both servers:
npm run ai:dev     # local AI endpoint on http://localhost:8788
npm run dev        # the app
# ...or run both at once:
npm run dev:ai
```

The provider key is **server-only** — it is read by `scripts/ai-dev-server.mjs` from `.env.local` and never compiled into the browser bundle. See `infra/AI_ENABLE.md` for the full runbook.

### Environment variables

All app config is via `VITE_*` variables documented in **`.env.example`**; copy it to `.env.local` and fill in values only when you want the AWS backend or AI layer. Key switches:

- `VITE_STORAGE_BACKEND` — `local` (default) or `aws`.
- `VITE_AWS_REGION`, `VITE_COGNITO_*`, `VITE_DYNAMODB_TABLE` — public, client-safe AWS config (required only when the backend is `aws`).
- `VITE_AI_LAYER`, `VITE_AI_ENDPOINT` — enable + point the optional AI layer.
- `AI_PROVIDER_API_KEY` (and friends) — **server-only**, for the local AI dev server; never a `VITE_` var, never committed.

> No real secrets, tokens, or provider keys belong in the repo. `.env.example` contains placeholders only.

---

## Testing

```bash
npx vitest run     # run the full suite once (or: npm test)
npm run typecheck  # tsc -b --noEmit
npm run lint       # eslint
```

The suite (300+ files) pins every verifier's exact answer, Monte-Carlo-checks every probabilistic archetype, and covers the mastery math, pipeline gates/state machine, remediation cascade, the interview-grade acceptance gate, and runtime page behavior.

---

## Deployment

- **Frontend:** production builds are hosted on **AWS Amplify**. Build the production bundle with:

```bash
npm run build:prod   # infra/build-prod.sh
```

  (`npm run build` runs `tsc -b && vite build` for a plain local build.)

- **Backend / AI:** provisioned from the CloudFormation templates in `infra/cloudformation/` via the helper scripts (`infra/deploy.sh`, `infra/deploy-ai.sh`, `infra/deploy-leaderboard.sh`). See `infra/AWS_SETUP.md`, `infra/AI_SETUP.md`, and `infra/AI_ENABLE.md` for the runbooks. The LLM provider key is stored as an SSM SecureString — created out-of-band, never in source.

---

## Project structure

```
src/
  lib/
    pipeline/       linear 7-stage state machine + gates + diagnosis + drilling
    mastery/        Beta mastery, Elo/Glicko/IRT/Thompson, trading subtopics
    remediation/    prerequisite-descent remediation cascade + policy
    roadmap/        skill graph (prereq DAG) + readiness
    mock/           LLM mock interviewer (extract-and-verify) + verifiers + gates
    oa/             timed OA/interview sections + hard-content solvers
    storage.ts      StorageProvider seam (local-first ⇄ AWS)
    awsStorage.ts   Cognito + DynamoDB provider
    ...             adaptivity, diagnostic, drill, srs, tutor, games, etc.
  content/          parametric generators + verifiers + prereq DAG per track
  pages/            route screens (diagnostic, drill, mock, games, roadmap, ...)
  components/       layout + pipeline shell + per-domain UI (mock, roadmap, ...)
  context/          Theme, Auth, Progress, DevPipeline (React Context)
  themes/           theming primitives
  types/            content + progress + mastery type definitions
infra/
  cloudformation/   main / AI / community / leaderboard stacks
  lambda/           ai-flavor (grading), ai-tts (voice), leaderboard
  *.sh, *.md        deploy scripts + AWS/AI runbooks
scripts/
  ai-dev-server.mjs local AI endpoint (same router as the Lambda)
```
