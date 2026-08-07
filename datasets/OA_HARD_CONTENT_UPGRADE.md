# Timed OA — Hard Content Upgrade

This documents the hard, firm-accurate archetypes now served by the Timed OA
sections. Every generator lives in `src/lib/oa/hardContent/generators.ts` and
computes its correct answer via the EXACT, deterministic verifiers in
`src/lib/oa/hardContent/solvers.ts` (exact rational arithmetic / enumeration /
DP / exact linear solves) — answers are **correct-by-construction**, never
hardcoded per instance. Distractors encode realistic wrong reasoning (parity
traps, off-by-one, dropped terms, fair-game / iid shortcuts), and each generator
is fully seed-deterministic with a distinct stable `family`.

## Pool → format wiring

The new generators are **added** to the existing curated firm pools in
`src/lib/oa/questionPool.ts` (`OA_CONTENT_POOLS`); nothing was removed. Each pool
feeds one timed format (`src/lib/oa/config.ts`), which the `/oa` sections draw
from via `drawOaQuestionsForFormat` / `drawOaQuestionsForFormatRotated`.

| Pool          | Format (id)                 | Firm inspiration |
| ------------- | --------------------------- | ---------------- |
| `rapidMixed`  | Rapid Mixed Battery (`rapid-battery`) | Citadel-style    |
| `blitz`       | Blitz (`blitz`)             | Five Rings-style |
| `derivation`  | Derivation Set (`derivation-set`) | IMC-style        |
| `deepSet`     | Deep Set (`deep-set`)       | DRW-style        |

The three original formats (Sprint / Section / Measured) keep the default
`mixed` pool unchanged. Timers, wall-clock/reload logic, persistence,
user-scoping and scoring are untouched — this is content + wiring only.

## Archetypes added

| Family (`family`) | Verifier(s) in `solvers.ts` | Example exact answer | Served in pools |
| ----------------- | --------------------------- | -------------------- | --------------- |
| `hardPathIntersect` (FLAGSHIP) | `pathIntersectProb` (distractor: `sameTimeMeetProb` = parity trap) | `pathIntersectProb(3,4) = 3273/4096` | blitz, derivation, deepSet |
| `hardRuinDuration` | `ruinExpectedDuration` (biased) | fair anchor `a=3,N=10 → 21`; biased instances exact | derivation, deepSet |
| `hardPatternWait` | `expectedWaitForPattern` (Conway) | pattern `xyx`: `E = m + m³` (coin `HTH → 10`, ternary `ABA → 30`) | derivation, deepSet |
| `hardSecretary` | `secretaryOptimal` | `n=5 → r=2, P = 13/30` (→ 1/e) | blitz, derivation |
| `hardGraphHitting` | `expectedHittingTime` (+ `cubeGraph`/`completeGraph`/`cycleGraph`) | cube antipode `= 10`; `K_n → n−1`; cycle offset d `→ d(n−d)` | derivation, deepSet |
| `hardResetCollector` | `resetCollectorEV` (contrast `couponCollectorEV`) | `n=7 → 1701/20 = 85.05` (vs plain `7·H₇ ≈ 18.15`) | deepSet |
| `hardHiddenComposition` | `hiddenCompositionNextSame` | `N=4,m=2 → 3/4`; `N=6,m=3 → 4/5` (iid trap: ½) | blitz |
| `hardCoinBias` | `coinBiasPosterior` (predictive head) | `pB=3/4,k=3 → predictive 97/140` (posterior 27/35) | rapidMixed, derivation |
| `hardDiceOrderStat` | `maxOfDiceEV` / `minOfDiceEV` | `E[max] 2×d6 = 161/36`; `E[min] 3×d6 = 49/24` | rapidMixed, blitz |
| `hardInformedLift` | `informedLiftPosteriorMean` | `d=2,f=6,ask=8 → 10` (adverse selection) | derivation |
| `hardOneReroll` | `oneRerollEV` (distractor `keepHigherOfTwoEV`) | `n=6 → 17/4 = 4.25`; `n=13 → 112/13` | derivation |
| `hardStepLanding` | `stepLandingProb` (DRW recurrence) | `p₄ = 11/16`; `p₁₀ = 683/1024` (→ 2/3) | rapidMixed |
| `hardKelly` | `kellyFraction` | `p=3/5,b=2 → 2/5`; `p=2/3,b=2 → 1/2` | rapidMixed |
| `hardCycleMeeting` | `cycleMeetingTime` (parity trap → "never meet") | `(8,4) → 8`; `(12,6) → 18`; odd gap ⇒ never | deepSet |

## Distractor design (examples)

- **`hardPathIntersect`** — the same-time meeting probability (`sameTimeMeetProb`,
  which is 0 when `bx+by` is odd) is the signature **parity trap**; plus the
  complement `1−p` and the naive `C(s,bx)/2^s` (same-step count ignoring parity).
- **`hardRuinDuration`** — the fair-game `a(N−a)`, the inverted-edge duration, and
  the first term `a/(q−p)` with the boundary correction dropped.
- **`hardPatternWait`** — the maximal-overlap "run" value `m+m²+m³`, the single
  fixed-window `m³`, and the sum-of-singles `3m`.
- **`hardHiddenComposition`** — the iid-fair `½`, the empirical `m/N`, and
  Laplace's `(m+1)/(N+1)`.
- **`hardCycleMeeting`** — "They never meet" (parity over-application, wrong for an
  even gap), the opposite-start `n²/8`, and half the cycle `n/2`.

## Tests

- `src/lib/oa/hardContent/generators.test.ts` — 76 tests. Per generator (over 12
  seeds): (a) the marked-correct choice equals the exact `solvers.ts` answer,
  (b) exactly four unique choices with exactly one correct, (c) determinism
  (same seed ⇒ identical prompt/choices/correctIndex/id), (d) stable/distinct
  `family`. Plus flagship re-derivation from drawn parameters, the served
  `3273/4096` anchor, and Monte-Carlo sanity checks (path intersection and
  biased-ruin duration) mirroring `solvers.test.ts`.

## Verification status

- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → all green (264 files, 3971 tests)
- `npm run build` → succeeds
