# Quant *Trader* Interview-Prep — Honest Competitive Ranking & Gap Analysis

**Compiled:** Aug 5, 2026 · **Scope:** quant **TRADER** (market-maker / prop) interview prep — *not* quant-researcher or quant-dev. Deliberately excludes options-pricing / stochastic-calculus / finance-theory depth, since prop-trader hiring assumes no prior finance knowledge.
**Method:** Part A read from this repo's current source (paths cited). Part B from 2026 web sources (URLs + confidence). Nothing here is inflated — where we lag, it says so.

> This is a research/audit artifact. No source code was modified to produce it.

---

## TL;DR verdict

For quant-**trader** prep specifically, this app is **top-tier / best-in-class on the *adversarial, adaptive, and diagnostic* dimensions** — nobody else combines a genuinely adverse-selecting market-making bot, an AI-verified verbal mock interview, firm-calibrated timed OA formats, and an IRT/Glicko/Thompson adaptive engine in one product. We **lead** on depth of the trading-simulation + reasoning-verification loop, sit at **parity** on timed-OA realism and market-making games, and **lag** the incumbents on three things they've had years to build: **raw question volume + verified provenance**, **live head-to-head multiplayer**, and **brand/community/social-proof**.

**Top gaps to close next (highest leverage first):**
1. **Question volume + verified provenance** — we have ~76 verified items + generators; QuantVault ships 2,800+ with full solutions, QuantQuestions 1,200+, TradingInterview 900+. (Partial: verified bank + parametric generators exist.)
2. **Live head-to-head multiplayer** — marketmakinggames.com already runs real-time multiplayer MM/Fermi rooms; our bots are all single-player. (Partial: adversarial bot + leaderboards exist.)
3. **Brand / community / social-proof** — no experience reports at volume, no verified-solution reputation, no track record. (Partial: community aggregation layer is built but empty.)
4. **Firm-specific fidelity** — competitors sell per-firm test replicas (Optiver 80-in-8, Akuna sequences, Flow, SIG); ours are firm-*inspired*, not verified replicas. (Partial: 7 firm-calibrated OA formats.)
5. **Mobile-first / retention polish** — Zetamac/TraderMath are phone-first daily-habit tools; SRS exists but the mobile drill loop isn't the product's front door.

---

## PART A — What we actually offer (verified in code)

Read from `src/**` and `datasets/**`. This is the *current* state, including recently-landed features. The stale README/roadmap intros ("planning only", "MVP slice") do **not** reflect the shipped code below.

### A1. Timed OA parity — 7 firm-calibrated formats
`src/lib/oa/config.ts` + `src/lib/oa/{questionPool,store,timedSession,scoring}.ts`, page `src/pages/OaSectionsPage.tsx`. Cross-session resumable, wall-clock timed.

| Format | Pace | Model | Scoring |
|---|---|---|---|
| Rapid Mixed Battery | 15 s/q × 40 | Citadel-style | +1 / −1 / 0 (Optiver penalty) |
| Blitz | 48 s/q × 20 | Five Rings-style | +1 / 0 / 0 (opt. −1 hard mode) |
| Per-Question Sprint | 90 s/q × 12 | Optiver Beat-the-Odds | +1 / −1 / 0, auto-advance, no-back |
| Section Exam | ~106 s/q, 17 q / 30 min | DRW / SIG | +1 / 0 / 0, free-nav |
| Derivation Set | 180 s/q × 12 | IMC-style, **module-locked** (forward-only) | +1 / 0 / 0 |
| Deep Set | 360 s/q × 6 | DRW-style | +1 / 0 / 0, free-nav |
| Measured (untimed) | — | SIG reflection philosophy | records time/q for trend |

These directly implement the pacing/penalty/navigation rules documented in `datasets/QUANT_OA_RESEARCH_CLUSTER1.md` and `CLUSTER2.md` — including the +1/−1/0-skip vs +1/0/0 split and module-locking.

### A2. Speed Arena — mental-math speed with weak-spot analytics
`src/lib/arena/*`: timed-arithmetic state machine, pacing/rushing analytics (`pacing.ts`, `analytics.ts`), **weak-spot detection that buckets error by operation/operand shape and over-samples the weak bucket** (`weakSpot.ts`, `weakSpotProfile.ts`, `adaptive.ts`), firm presets, DynamoDB leaderboard. This is the Zetamac/TraderMath lane, plus adaptivity they don't have.

### A3. Market-making / quoting under an adversarial bot — **The Trading Floor** (flagship)
`src/lib/tradingFloor/*`, page `src/pages/TradingFloorPage.tsx`. The bot (`bot.ts`) is **genuine adverse selection, not scripted**: on informed rounds it prices at `trueFair + N(0, edgeNoiseSd)` (Box–Muller normal), so blindly widening to dodge it *also* forfeits the noise spread — the real market-maker's dilemma. Three presets (`config.ts`): Warm-up (25% informed), Interview (50%), **Superday (75% informed, low noise, peeks one reveal ahead** via `lookahead:1`)`, each with a shot clock (25/20/15 s). Scenario packs (`packs.ts`, `scenarios/`), deterministic scoring, resume, benchmark, calibration pairs, leaderboard.

### A4. Market-making & betting games hub — 10 games
`src/lib/games/catalog.ts` + `src/lib/games/*` + per-game pages. Make Me a Market (maker), Market of Cards (group/super-day maker vs adaptive bots), Cards Market Making (taker + value-of-info), Fruit Market (speed-math taker), Dice & Cards (products/variance), Probability Betting (odds↔implied, Kelly), Next Card Betting (counting + Kelly), Arbitrage & De-vig (`src/content/arbitrage/*`), EV Under Time, Fermi. Each is a self-contained pure engine + thin page.

### A5. Mock interview with AI reasoning verification — **the differentiator**
`src/lib/mock/*`, page `src/pages/MockPage.tsx`, contract `datasets/MOCK_AI_CONTRACT.md`, deployed AI Lambda (`infra/lambda/ai-flavor`). A full multi-stage screen:
- **Spoken mental-math** (speech I/O with typed fallback, `speech.ts`) graded **deterministically** (`scoring.ts`).
- **Adversarial asked-and-graded follow-ups** (`followups.ts`) — a real harder-variation question the candidate must answer; authored (deterministic numeric truth) or AI-generated, but **the client verifier always owns correctness**.
- **Market-making step** vs the deterministic adverse-selection bot (`marketMaking.ts`).
- **Behavioral / fit** (reflect-only).
- **LLM reasoning-quality verdict** (`sound/partial/vague/absent`) + **brutal final diagnosis** (`diagnosis.ts`) → "correct answers but vague reasoning on N items — you'd get pressed and fold." **Design invariant:** the LLM (~56% reliable as a grader) *never* decides correctness or score; the response schema has no correctness field (see `MOCK_AI_CONTRACT.md`). PII-free: transcripts are transient and never persisted.

No competitor found offers an AI-voice mock that (a) grades reasoning quality, (b) asks graded adversarial follow-ups, (c) runs an adverse-selection MM round, and (d) writes a firm-tier pass/no-pass diagnosis — all with a correctness firewall.

### A6. Adaptive mastery + remediation — psychometrically principled
`src/lib/mastery/*`: **2PL IRT ability + Glicko item-difficulty + Thompson-sampling selection**, with an offline eval harness (`irt.ts`, `glicko.ts`, `thompson.ts`, `offlineEval.ts`) — and a wiring guard (`adaptiveEngine.wiring.test.ts`) that proves the engine is *actually invoked* on the live fold + remediation paths, not dead code. Elo θ + Beta posterior, `ciLow ≥ 0.8` mastery bar, reliability/Brier, misconceptions. Remediation climb-back + Socratic tutor (`src/lib/remediation/*`, `src/lib/tutor/*`). Multistage diagnostic + low-confidence unlocks (`src/lib/diagnostic/*`, `src/lib/mastery/unlock.ts`).

### A7. Estimation with 90% CI, SRS, verified bank, community
- **Fermi + 90% CI elicitation** with a proper Winkler interval score + empirical coverage debrief (`src/content/fermi/*`, per roadmap T1).
- **SRS** spaced-repetition (`src/lib/srs/{deck,schedule,store}.ts`, `/review`).
- **Verified human-authored bank** (`src/content/verifiedBank/*`): ~76 items across arbitrage / mental-math / sequences / brainteasers / probability-EV / market-making / estimation, each with provenance + worked solution (`schema.ts`, `/verified-bank`).
- **Community layer** (`src/lib/community/*`, `/community`): experience-report / discussion / vote / reputation aggregation + moderation, DynamoDB-backed — **built but effectively empty** (no user base yet).
- **Sequences** (`src/content/sequences/*`) and **winner's-curse auctions** (`src/content/auctions/*`).
- **Course vs interview mode** reprojection (`src/lib/mode/visibility.ts`).

**Honest summary of our offer:** a single integrated app covering fast mental math (with weak-spot targeting), probability/EV, arbitrage/de-vig, estimation with CI calibration, firm-calibrated timed OAs, market-making/quoting against a *real* adverse-selection bot, an AI-verified verbal mock interview with a diagnosis, all wired to an adaptive remediation engine. The *skills coverage and simulation/diagnostic depth are best-in-class*; the *content volume and social proof are not*.

---

## PART B — Competitor landscape (2026, with sources)

Prioritized for quant-**trader** skills (arithmetic speed, probability/EV, market-making, sequences, estimation, game-theoretic thinking).

| Resource | Best at | Price (2026) | Format | Key weaknesses (vs trader prep) |
|---|---|---|---|---|
| **QuantVault** — [quantvault.org](https://quantvault.org/) | Largest structured bank: **2,600–2,800+ problems, full solutions**, 27 firm funnels, real-OA tests, **auto-graded in-browser coding judge**, 40+ courses, 15 trading games, **adaptive per-topic Elo** | **$19/mo · $149/yr; ~400 free** | Web platform, question bank + games | Newer/smaller community; broad (QR/QD too), not trader-pure; speed drill is weaker → users pair with Zetamac |
| **TradingInterview.com** — [tradinginterview.com](https://www.tradinginterview.com/) | **Market-making games** (bundles **live multiplayer** [marketmakinggames.com](https://marketmakinggames.com/)), built by ex-traders/QRs; 900+ questions, 10+ courses, firm prep, mental-math with company tests | **$44.95/mo · $109.95/3mo · $189.95/6mo** | Courses + games + bank; **real-time multiplayer** | Expensive; reviews cite "room for improvement"; less adaptive; no reasoning-verification mock |
| **TraderMath** — [tradermath.org](https://www.tradermath.org/) | **Trading-realistic mental math** (prices/P&L/fractions), sequences, Fermi, **cognitive games (Zap-N/Flanker/digit-span/cube-fold)**, firm-specific tests (Akuna/Maven/Flow), MM game; **also sells assessments to firms** (credibility) | **$29.95/2wk · $44.95/mo · $129.95/6mo; no free tier** | Trainers + firm test simulators | No free tier; trader-only; no coding; thinner probability depth; no adaptive engine / verbal mock |
| **QuantGuide** — [quantguide.io](https://www.quantguide.io/) | **1,000+ problems** w/ solutions + hints, company tags, **Quantify** mental-math trainer, Quant-Trader-75 playlist, active forum | **$20/yr-billed · $35/mo; free non-premium tier** | Question bank + speed drill | Lighter coding; QR-leaning; static bank (no MM sim / adverse bot / mock) |
| **QuantQuestions.io** — [quantquestions.io](https://quantquestions.io/explore) | **1,200+ questions, 19 firm playlists** (SIG 147, Jane St 133, Dice 124…), curated Top-50/75, established track record | Signup-walled premium (not public) | Question bank + playlists | No mental-math tool; minimal community; static (no games/sim/mock/adaptivity) |
| **Zetamac** — [arithmetic.zetamac.com](https://arithmetic.zetamac.com/) | **The** free arithmetic-speed benchmark (2-min, configurable); the number everyone quotes | **Free** | Bare arithmetic drill | Integers only (no fractions/decimals), not trading-flavored, no probability/MM/analytics |
| **RankYourBrain** — [rankyourbrain.net](https://rankyourbrain.net/) | Free mental-math speed drills + global leaderboards, difficulty tiers | **Free (Pro upsell)** | Arithmetic drill | Arithmetic-only; decimal set reported "unrepresentative"; no trader content |
| **Brainstellar** — [brainstellar.com](https://brainstellar.com/puzzles/) | **Free, well-loved puzzle bank** (Easy→Hard, probability/strategy) with step-wise solutions | **Free** | Static puzzle pages | No timing/sim/MM/mock/adaptivity; not a training loop |
| **Quant-EV.io** — [quant-ev.io](https://www.quant-ev.io/) | Free Optiver-style probability/EV + MM simulators, **community benchmarking**, "student-priced" ethos | **Free / low** | Test simulators | Narrow (Optiver-focused); early-stage; small content |
| **MyntBit** — [myntbit.com](https://myntbit.com/) | **1,000+ Qs, free tier**, trader+dev+researcher, 13 firm plans, 4 free games | Freemium | Bank + games | Generalist (not trader-pure); games shallow vs dedicated MM sims |
| **Green Book — Xinfeng Zhou** ("A Practical Guide to Quantitative Finance Interviews") | **Canonical** probability/brainteaser/Markov reference; the universal starting text | ~$40 book | Static book | No mental-math/sequences drilling, no MM sim, no coding, terse solutions, dated; must be supplemented |
| **Wall Street Oasis / Reddit r/quant / 1point3acres / Discords (getcracked)** | **Real candidate experience reports & current firm intel**, social proof, free | Free | Forums / community | Noisy, unstructured, no training loop or grading; the *thing our community layer wants to be* |
| **Interview Query (quant)** — [interviewquery.com](https://www.interviewquery.com/) | Guides + some quant questions, mock-interview marketplace | Freemium/$ | Bank + guides | More DS/analytics than prop-trader; thin MM/mental-math |

**Cross-cutting read:** the market splits into (1) **speed drills** (Zetamac/RankYourBrain/TraderMath), (2) **question banks** (QuantVault/QuantGuide/QuantQuestions/Green Book), (3) **market-making sims** (TradingInterview + marketmakinggames.com, TraderMath), and (4) **community/intel** (WSO/Reddit/Discord). *No single incumbent unifies all four with an adaptive engine and a reasoning-verified verbal mock — that unification is our wedge.* The flip side: each incumbent is deeper than us **within its lane** (volume, multiplayer, brand).

---

## PART C — Honest ranking (quant-trader roles)

### Where we LEAD (best-in-class)
- **Adversarial market-making realism.** The Trading Floor's informed-with-noise bot + Superday lookahead is a *genuine adverse-selection* model. TradingInterview/TraderMath MM games are more scripted/flow-based; marketmakinggames.com wins on *multiplayer* but not on modeled adverse selection. **We lead on the MM *learning model*.**
- **AI-verified verbal mock interview.** Spoken math + graded adversarial follow-ups + MM round + brutal firm-tier diagnosis, with a hard correctness firewall around the LLM. **No competitor has this.**
- **Adaptivity & diagnostics.** IRT + Glicko + Thompson + reliability/Brier calibration + weak-spot mental-math targeting + remediation. QuantVault has an adaptive Elo plan (closest); everyone else is static. **We lead on psychometric rigor.**
- **Breadth of *skill* coverage in one loop.** Mental math → probability/EV → arbitrage/de-vig → estimation-with-CI → sequences → timed OA → MM → verbal mock → adaptive review, integrated. Others make you stitch 3–4 tools together.
- **Timed-OA rule fidelity.** Correct +1/−1/0 vs +1/0/0 penalty semantics, module-locking, free-nav, and per-firm pacing are implemented, not just labeled.

### Where we're at PARITY
- **Timed OA realism** — on par with TradingInterview/TraderMath firm simulators (they win on *named-firm branding*, we win on *scoring correctness + adaptivity*).
- **Market-making games catalog** — 10 games ≈ TradingInterview's 8 and TraderMath's suite. Comparable variety; they have multiplayer, we have the better bot + integrated diagnosis.
- **Mental-math speed drilling** — Speed Arena ≈ TraderMath/QuantGuide Quantify, *better* on weak-spot analytics, but Zetamac/RankYourBrain win on frictionless free daily-habit UX.
- **Estimation/Fermi** — our CI-elicitation + Winkler scoring is *ahead* of TraderMath's Fermi trainer conceptually, but at parity on volume.

### Where we LAG (be candid)
- **Raw question volume + verified provenance.** ~76 verified items + generators vs QuantVault 2,800+ / QuantQuestions 1,200+ / QuantGuide 1,000+ / TradingInterview 900+ — all with human-written solutions and (for QuantQuestions/QuantVault) firm playlists. This is our **single biggest deficit** for a candidate who wants "lots of varied graded reps."
- **Live head-to-head multiplayer.** marketmakinggames.com runs real-time multiplayer rooms + tournaments today. Every one of our games/bots is single-player. This is a *format* competitors already ship.
- **Brand, community & social proof.** WSO/Reddit/Discord and the incumbents have years of candidate reports, verified solutions, placement claims, and traffic. Our community layer is built but empty; no track record, no "I got the Optiver offer using this."
- **Firm-specific fidelity.** Ours are firm-*inspired* formats. TraderMath/TradingInterview sell *named* Akuna/Flow/Optiver/Maven test replicas (and TraderMath literally powers firm assessments). Candidates chasing a specific firm perceive those as more authoritative.
- **Mobile-first daily-habit UX.** The speed-drill audience is phone-first; Zetamac/TraderMath are the daily habit. SRS + responsive layout exist, but a frictionless installable mobile drill loop isn't our front door.
- **Coding judge.** QuantVault/MyntBit run an in-browser auto-graded coding judge. We intentionally scope this out for *trader* (coding is a QR/QD/SWE gate), so this is a *deliberate* lag, not an oversight — but Citadel-QR/HRT/Jump-style trader-adjacent screens do include coding.

**Overall placement:** For a quant-**trader** candidate, we are a **credible #1 on the "simulate the real adversarial + verbal interview and adaptively fix my weak spots" job**, and roughly **#3–4 on the "give me a huge graded question bank + firm playlists + a proven community" job** (behind QuantVault, QuantQuestions/QuantGuide, TradingInterview on those axes). We are *not yet* the default first tool a candidate opens daily (that's Zetamac) nor the one they trust for a specific firm's OA (that's TraderMath/TradingInterview) — but we are the most complete *interview simulator*.

---

## Gap analysis — prioritized, with effort + partial-credit

Effort key: **S** ≤ 1 wk · **M** 1–3 wk · **L** 3–8 wk · **XL** own workstream/ongoing.

| # | Gap | Why it matters (trader) | Effort | Do we have a partial? |
|---|---|---|---|---|
| **1** | **Question volume + verified provenance** → ≥300–500 (target 1,000+) human-verified, firm-tagged, solution-backed items with an ongoing sourcing cadence | Closes our biggest deficit vs QuantVault/QuantQuestions; "lots of graded reps" is the #1 reason candidates pay | **XL** (content swarm + cadence) | **Yes** — `verifiedBank` schema/loader + ~76 items + parametric generators; needs scale + firm tags |
| **2** | **Live head-to-head multiplayer** MM/mental-math rooms + tournaments | marketmakinggames.com already ships this; multiplayer is stickier and mirrors super-day group games | **L** (realtime backend + matchmaking) | **Partial** — adverse-selection bot, leaderboards, deterministic engines to reuse; no realtime transport |
| **3** | **Community & social proof at volume** — seeded experience reports, verified-solution flags, reputation, placement stories | Trust/credibility gap vs WSO/Reddit/incumbents; drives organic growth | **L–XL** (seed content + growth, not just code) | **Yes (code) / No (content)** — `src/lib/community/*` built but empty |
| **4** | **Firm-specific verified OA replicas** (named Optiver 80-in-8, Akuna sequences, Flow, SIG Mettl, Five Rings) + per-firm funnels | Candidates prep for a *specific* firm; named replicas out-perceive "inspired" formats | **L** | **Partial** — 7 firm-*calibrated* OA formats + research clusters; not verified named replicas |
| **5** | **Mobile-first PWA daily-habit loop** (installable, offline drill, push reminders) fronting Speed Arena/Fermi | Speed-drill audience is phone-first; retention/habit is where Zetamac wins | **L** | **Partial** — SRS engine + responsive layout; no installable PWA / notifications front door |
| **6** | **Mental-math speed breadth & frictionless free entry** — fraction/decimal/percentage/price-P&L drills, one-click no-login trial | Match Zetamac/TraderMath convenience; fractions are the gap Zetamac can't cover | **S–M** | **Partial** — Speed Arena + weak-spot analytics + firm presets; add explicit fraction/decimal modes + zero-friction entry |
| **7** | **Sequences & pattern depth** (numeric + alphabetic + matrix/odd-one-out) matched to Akuna/Optiver/Maven batteries | Named sequence tests are a real gate; volume matters | **S–M** | **Yes** — `src/content/sequences/*` exists; needs volume + alphabetic/matrix breadth + OA wiring |
| **8** | **Verified solution quality & explanations** (video/step-through) across the whole bank | QuantGuide's hints + QuantVault's intuition-first solutions are a selling point | **M** (paired with #1) | **Partial** — worked solutions + Socratic tutor + misconception feedback exist |
| **9** | **Brand/credibility signals** — public benchmark cohorts, "readiness score" candidates can share, firm-assessment partnerships | TraderMath's firm-assessment business is its moat; social benchmarking (Quant-EV) drives virality | **L–XL** (BD + product) | **Partial** — calibration/readiness + leaderboards exist; not externalized/shareable |
| **10** | **Trader-adjacent coding screen** (Citadel-QR / HRT / Jump lines) — *optional*, since pure-trader is deliberately no-code | Only for candidates crossing into QR/quant-dev-adjacent screens | **M** (deliberately deprioritized) | **No** — intentionally out of scope for trader focus |

**Recommended next order:** #1 (volume/provenance) and #6/#7 (cheap breadth wins) in parallel → #4 (firm replicas, rides on #1) → #2 (multiplayer, the format we're missing) → #5 (mobile habit) → #3/#9 (community + brand, which compound only once there's a user base).

---

## Sources (2026)

- QuantVault — pricing/bank/coding-judge/games: https://quantvault.org/ · https://quantvault.org/pricing.html · https://quantvault.org/best-quant-interview-prep.html
- TradingInterview.com — pricing/courses/MM games: https://www.tradinginterview.com/ · https://www.tradinginterview.com/packages/ · https://www.tradinginterview.com/introducing-market-making-games/
- Market Making Games (live multiplayer): https://marketmakinggames.com/
- TraderMath — trainers/pricing/firm tests/assessments: https://www.tradermath.org/ · https://www.tradermath.org/trainers · https://www.tradermath.org/assessments
- QuantGuide — pricing/questions/Quantify: https://www.quantguide.io/ · https://www.quantguide.io/pricing · https://www.quantguide.io/questions
- QuantQuestions.io — firm playlists/1,200+: https://quantquestions.io/explore
- Zetamac: https://arithmetic.zetamac.com/ · guide https://spacecomplexity.ai/blog/zetamac-mental-math-quant-interview
- RankYourBrain: https://rankyourbrain.net/
- Brainstellar: https://brainstellar.com/puzzles/
- Quant-EV.io: https://www.quant-ev.io/
- MyntBit (comparisons, free tier): https://myntbit.com/compare/tradermath · https://myntbit.com/blog/best-quant-interview-platforms-2026
- Green Book (Xinfeng Zhou) reviews: https://quantvault.org/green-book-solutions.html · https://www.quantt.co.uk/resources/green-book-quant-guide · https://quantprep.io/practical-guide-to-quantitative-finance-interviews
- Mental-math benchmarks / trader-round context: https://quantvault.org/mental-math-for-trading-interviews.html · https://www.techinterview.org/post/3233474714/mental-math-drills-trading-interviews/
- Community-tool discussion (Zetamac/TraderMath/RankYourBrain/OpenQuant/TradingInterview): https://quant.stackexchange.com/questions/71373/
- Firm OA calibration (internal): `datasets/QUANT_OA_RESEARCH_CLUSTER1.md`, `datasets/QUANT_OA_RESEARCH_CLUSTER2.md`
- Our capabilities (internal code): `src/lib/oa/config.ts`, `src/lib/tradingFloor/{bot,config}.ts`, `src/lib/games/catalog.ts`, `src/lib/mock/*` + `datasets/MOCK_AI_CONTRACT.md`, `src/lib/mastery/*`, `src/lib/arena/weakSpot.ts`, `src/lib/mode/visibility.ts`, `src/content/verifiedBank/*`, `src/App.tsx`
