# Optiver 2026 Deep Dive — Assessment, Interview, and a Verified Hard-Archetype Catalog

**Compiled:** 7 Aug 2026 via live WebSearch/WebFetch + independent computational verification (exact DP/enumeration in Python + Monte-Carlo cross-checks).
**Scope:** Goes deeper than `datasets/OPTIVER_2026_OA_RESEARCH.md`. That doc mapped the *shape* of the battery for a game-builder. This doc is for a **content engineer generating many HARD questions**: it (1) re-verifies the process/format with fresh 2025–2026 sources and per-claim confidence, (2) builds a **hard question-archetype catalog** where every answer is *actually computed and cross-checked*, each with a **deterministic verifier** and a **generation recipe**, and (3) **fully solves the lattice random-walk "anchor" example** (exact DP + Monte-Carlo agreement) to prove the rigor.

**Do not restate the companion doc.** Where a claim is already well-established there, it is summarized in one line with a pointer and the new evidence added; the bulk of the effort here is the archetype catalog and the anchor solution.

**Verification note (important):** Every numeric answer in the archetype catalog and the anchor section was computed by a short exact program (dynamic programming, exact enumeration, or exact rational linear algebra using Python `fractions`) and, where the closed form is subtle, independently cross-checked by a Monte-Carlo simulation with a stated seed and trial count. The exact value and the simulation agree in every case (agreement reported inline). These programs were run ephemerally for verification only; no code was added to the repo.

---

## Part 0 — Methodology and the difficulty calibration

- **Sourcing tiers (same discipline as the companion doc):** Tier 1 = firm-official / test-vendor (Zyvo, `tools.optiver.com`). Tier 2 = 2025–2026 first-hand candidate/offer-holder accounts (WSO, a Medium offer-holder write-up, 1Point3Acres/PracHub candidate problem banks). Tier 3 = prep-vendor/aggregator breakdowns (QuantVault, EverythingQuant, Aptitude-Test-Prep, JobTestPrep, SpaceComplexity, InterviewChamp, TheInterviewDen). **Prep vendors recycle each other's numbers**, so cross-vendor agreement is *weak* evidence; the confidence labels weight Tier 1/2 far more heavily.
- **Confidence key:** **High** = vendor-official and/or ≥2 independent 2025–2026 first-hand accounts agree. **Medium** = consistent across several aggregators + ≥1 primary confirmation. **Low** = single source or vendor-only.
- **Paraphrase rule:** every example below is an original, parameterized paraphrase of a *family*. No proprietary item is reproduced.
- **The difficulty anchor.** The user who sat the 2026 assessment gave a calibration example (paraphrased): *A starts at (0,0) stepping up/right with prob 1/2 each; B starts at (3,4) stepping left/down with prob 1/2 each; find the probability their paths ever intersect.* This is **materially harder** than "EV of two dice" because (a) it has a **parity trap** (the two particles can never occupy the same point at the same *time*, so the naive same-time-meeting answer is 0, which is a wrong reading of the question), and (b) the correct "paths ever share a lattice point" quantity requires a **two-particle state DP**, not a one-line formula. The catalog is calibrated to **this tier or harder**. It is solved in full in Part 3.

---

## Part 1 — Process and format, re-verified (2025–2026)

The companion doc already establishes the spine. This section adds fresh corroboration, tightens per-stage confidence, and adds the **cognitive-skill-per-mini-game** and **live/phone/onsite** detail requested, flagging anything thin.

### 1.1 Stage map (quant trader / researcher track), with confidence

| Stage | What it is | Volume / timing (directional) | Cognitive skill tested | Confidence + recency |
|---|---|---|---|---|
| **80-in-8** (mental arithmetic) | 80 MC arithmetic Q, no calc, no skip/back, auto-advance | 80 Q / 8 min (~6 s/Q); pass ~55–70/80 | Raw speed + accuracy under a punishing clock; the filter | **High** on format; **Medium** on universal inclusion (role/cycle dependent). 2025–26 |
| **NumberLogic** (sequences) | 5-option MC, next/missing term; skip + back-nav | ~26 Q / 25 min | Inductive pattern recognition; triage discipline (hard tail) | **High**. 2025–26 |
| **Beat the Odds** (probability/EV) | 5-option "pick the closest"; no back-nav | ~20–30 Q, **90 s/Q** (phone-screen variant ~10 Q/15 min) | Fast probabilistic reasoning; recognize the family, estimate the bucket | **High** on format/scoring; **Medium** on exact count. 2025–26; *reported harder in 2025/26* |
| **Zap-N** (cognitive games) | Battery of mini-games; classically **9**, recent QT/PhD invites often **~3** | ~45–120 min total | Per-game: reaction, inhibition, planning, memory, risk, deduction | **High** roster; **Medium** per-game scoring. 2025–26 |
| **Zap-Q** (personality) | Forced-choice statement pairs, untimed | ~150 items / ~25 min; 24 traits | Trait profile (IRT); non-eliminating, steers behavioral round | **High** (Zyvo-official). Evergreen |
| **Phone screen** | Recruiter/team member call | 30–45 min | "Why Optiver / why market making" + light probability + a quick mental-math drill | **High** (multiple 2025–26 accounts) |
| **Onsite / assessment day** | Multiple rounds | Half day | Harder math test, **probability deep-dive**, **market-making game**, behavioral, sometimes coding | **High** structure; **Medium** on exact composition |
| **Superday** | Final loop | Group + technical + in-house trading sim | Same domains, group communication under pressure | **Medium** |

**Cross-source confirmation of the spine (High):** the **NumberLogic + Beat the Odds + Zap-N (+ Zap-Q)** battery is confirmed by (i) a 2026 **offer-holder** Medium write-up, (ii) a 2025/26 WSO Amsterdam QR first-hand account, (iii) a 2025 WSO Chicago first-hand account, and (iv) multiple Tier-3 breakdowns (QuantVault, EverythingQuant, programhelp). The **80-in-8 "fully phased out" claim is still only partially supported** — the offer-holder Medium (2026) and EverythingQuant (2026) both *still list 80-in-8*, while two 2025/26 first-hand quant accounts omit a standalone 80-in-8. **Reading (Medium):** 80-in-8 is present-but-role/cycle-dependent, not universally retired.

### 1.2 Zap-N mini-games — the cognitive skill each one probes (roster High; per-game scoring Medium)

Confirmed roster and mechanics cross-checked between **EverythingQuant (2026, explicit 9-game list)**, **Aptitude-Test-Prep (2026)**, **QuantVault (2026)**, and **JobTestPrep (2026)**. The cognitive-paradigm mapping is corroborated by **Quant Career Hub**. Naming varies by source (noted).

| Mini-game (aliases) | Mechanic | Underlying paradigm → skill measured | Timing/scoring signal | Confidence |
|---|---|---|---|---|
| **Stockmaster / Stock Indicator / "Barbeque"** | Click a moving indicator while its needle sweeps the target zone (EverythingQuant's 2026 list renders the timing game as a grill "take the meat off at the right moment" variant) | Reaction-time + sustained vigilance → **timed execution, speed-accuracy tradeoff** | ~2 min; window shrinks as it ramps; score = hits − early/late | Medium |
| **Shape Shift / Shapeshift** | Circle→one arrow, square→other, regardless of screen position | Simon-effect → **inhibitory control under spatial interference** | ~60 rounds; start slow, accelerate | High |
| **Number Box** | Combine 4 numbers with + − × ÷ (pairwise, implicit brackets) to hit a target | 24-Game → **creative arithmetic, find *a* valid path fast** | ~10 rounds; give-up-and-advance | High |
| **Balloon (BART)** | Pump for money; cash out before a random pop; round 2 adds a pop penalty | Balloon Analogue Risk Task → **calibrated, consistent risk policy** | 2 rounds (~30 then ~20 balloons) | High |
| **Skyscraper / Tower** | Rearrange stacks to a target, move only the top block, fewest moves | Tower of London → **forward planning; pre-move planning latency logged** | ~10 levels; too-fast planning reads as impulsivity | Medium |
| **Pincode / Digit** | Recall flashed digit strings; later rounds reverse then sort | Digit span → **working memory + mental manipulation** | span grows; reverse in round 2 | Medium |
| **The Switch** | Alternate between "is the sum odd?" and "are the arrow sets identical?" as the active rule flips | Task-switching → **cognitive flexibility, switch cost** | ~35 rounds | Medium |
| **Code Compare / Comparisons** | Pick the exact match of a 7–10 char code from near-identical options | Perceptual matching → **attention to detail under a shrinking clock** | ~30 rounds; ~5 s → ~3 s | Medium |
| **Figure It Out / Pattern Guess** | Deduce a hidden figure's attributes from "how many correct" feedback | Mastermind → **hypothesis-driven info use, minimize guesses** | ~5 rounds; move-count (not time) scored | Low–Medium |

**Scoring reality (Medium):** each game emits its own behavioral metrics; recent accounts say **one weak game no longer auto-rejects** — the math modules (NumberLogic, Beat the Odds) carry the weight. There is **no published rubric**; per-game interpretation is inferred from the paradigms.

### 1.3 Live / phone / onsite trader rounds (High on existence; Medium on specifics)

Cross-checked across TheInterviewDen (2026), InterviewChamp (2026), QuantVault (2026), EverythingQuant (2026), Applr (2026), and a 2026 offer-holder Medium account:

- **Phone screen (30–45 min):** motivational + **light probability + a rapid mental-math drill** ("what is 7×14", "√225"). SpaceComplexity documents a phone-screen "Beat the Odds"-style block (**~10 Q / 15 min**, ~90 s each) built on EV, conditional probability, combinatorics, and game scenarios (tennis, gambler's ruin, die optimization). *Confidence: High that a probability/mental-math phone block exists; Medium on exact counts.*
- **Numerical & probability round (30–45 min, trader-led):** conversational; **EV problems and probability brainteasers where reasoning is graded over the final number**. Recurring named families: EV of a die roll (3.5), sequential/optimal-stopping ("see numbers one at a time, pick one"), Bayes (disease false-positive, coin-bias), and "twist" brainteasers (expected flips to three heads in a row, light-bulbs/switches, weighing). *High.*
- **Market-making game ("make me a market"):** quote a two-sided market on something (sum of dice, EV of a card draw, count of windows in the building), get hit/lifted, **update on the counterparty's action, requote, manage spread and inventory**. Spread management and Bayesian updating on order flow are explicitly graded. *High; this is Optiver's signature round.*
- **Onsite / Superday:** a harder written math test, a probability deep-dive, an in-person/**group** trading simulation ("Optinomicon" card or sports-betting games), and behavioral. *Medium on exact composition; varies by office and cycle.*

**Flagged as thin:** exact per-round question counts; the "Optinomicon" naming (Tier-3 EverythingQuant); the SHL "General Ability" add-on (single source, region-dependent).

---

## Part 2 — HARD ARCHETYPE CATALOG (the core deliverable)

Each archetype below is a **family actually attested at Optiver** (Beat the Odds and/or the onsite probability round; sources cited per item). For each: **concept + round**, a **paraphrased hard example**, a **full solution**, the **exact computed answer** (verified), a **deterministic verifier** (formula/DP so instances are correct-by-construction), a **generation recipe** (parameter ranges + algorithm), and a **difficulty tier** relative to the anchor.

Difficulty tiers: **T1** = standard Beat-the-Odds reflex (single closed form). **T2** = requires a state/first-step setup or a non-obvious symmetry. **T3** = anchor-level (multi-state DP, parity/reflection subtlety, or two coupled processes).

> **Cross-cutting verifier tools** (reused across archetypes): exact rational linear-system solver for absorbing Markov chains (hitting probabilities / expected times), exact path enumeration with `fractions`, binomial tail sums, and a Monte-Carlo harness with a fixed seed. All answers below were produced and checked with these.

### Archetype A — Lattice random-walk **path intersection** (the anchor family) · **T3**
- **Concept / round:** two coupled monotone random walks; lattice-path counting + **parity**. Beat the Odds "harder tail" and onsite. Attested: 1Point3Acres/PracHub "random walk" family; AMC-2003-12A-#22 is the same-time cousin; the user's 2026 anchor.
- **Paraphrased example:** A at (0,0) steps up/right (½,½); B at (a,b) steps left/down (½,½). Probability their **paths ever share a lattice point** (over all time)?
- **Two readings (state the trap):**
  1. **Same point at the same time step.** Possible only if the Manhattan gap `a+b` is **even**; then they can meet only at step `t=(a+b)/2` on the anti-diagonal `x+y=(a+b)/2`, with probability **`C(a+b, a) / 2^(a+b)`**. If `a+b` is **odd**, this is **exactly 0** (parity). *(This is the AMC/textbook version.)*
  2. **Paths ever share a lattice vertex** (the user's phrasing "ever occupy the same point / paths intersect"). Because each walker visits **exactly one vertex per anti-diagonal**, the paths share a vertex iff for some diagonal `k` both walkers sit at the *same* vertex on `Dk` (possibly at different times). This is the genuinely hard reading and needs a DP. Fully solved for `(a,b)=(3,4)` in Part 3.
- **Exact answers (verified):** same-time `(5,7) → C(12,5)/2^12 = 792/4096 ≈ 0.1934` (matches AMC, "closest to 0.20"), `(2,4) → 15/64`, `(1,1) → 1/2`. Path-intersection `(3,4) → 3273/4096 ≈ 0.7991` (Part 3), `(5,7) → 1544071/2097152 ≈ 0.7363`. **Anchor `(3,4)` same-time = 0** (odd gap) — the trap.
- **Deterministic verifier:**
  - Same-time: `P = 0 if (a+b) odd else comb(a+b,a)/2**(a+b)`.
  - Path-intersection: enumerate each walker's in-box trace (box = `0..a × 0..b`; monotonicity ⇒ no re-entry, finite) with its `(1/2)^moves` probability; `P = Σ_{tA,tB} p(tA)p(tB)·[trace_A ∩ trace_B ≠ ∅]`. Correct-by-construction; feasible for interview-scale boxes. (Polynomial alternative: DP over anti-diagonals tracking both x-coordinates, absorbing on equality — see Part 3.)
- **Generation recipe:** pick `(a,b)` with `a,b ∈ {1..6}`. Difficulty knobs: **odd `a+b`** forces the parity trap and the harder path-intersection reading; larger `a+b` and skew (`|a−b|` large) reduce intersection probability and increase counting work. Emit the exact answer from the verifier; the coarse 5 options should bracket it (e.g., for 0.7991 use {0.5, 0.65, 0.8, 0.9, 1.0}).
- **Difficulty:** **T3** (the calibration anchor).

### Archetype B — **Meeting time of two walkers on an n-cycle** · **T3**
- **Concept / round:** two independent symmetric walkers on a cycle; **first-step analysis on the gap**, with a **parity subtlety** mirroring the anchor. Attested: PracHub "Compute expected coin flips to meet on octagon" (Optiver, Jul 2025); 1Point3Acres polygon family.
- **Paraphrased example:** two tokens on the 8 vertices of a regular octagon start at **opposite** vertices. Each tick, each token moves to a neighbor (±1) with prob ½. Expected ticks until they occupy the same vertex?
- **Full solution:** the gap `d` (mod 8) changes by −2/0/+2 with prob ¼/½/¼ each tick, so `d` stays **even**. Restrict to even residues {0,2,4,6}, absorbing at 0, start `d=4`. Solve `E_d = 1 + ¼E_{d-2} + ½E_d + ¼E_{d+2}` (mod 8). Exact rational solution gives **`E = 8`**.
- **Exact answer (verified):** **8 ticks** (exact linear solve); Monte-Carlo 300k trials, seed 5 → **8.010** (agree). Closed form across sizes: opposite start on an `n`-cycle with `4 | n` gives **`E = n²/8`** (`n=4→2, 8→8, 12→18, 16→32`, all verified exactly).
- **Parity trap:** if the opposite gap is **odd** (e.g., `n=6` → gap 3, or `n=10` → gap 5), the gap stays odd forever and **they never meet** (expected time infinite). Great hard distractor.
- **Deterministic verifier:** build the absorbing chain on the reachable (even) gap residues and solve `(I−Q)E = 1` exactly; or use `n²/8` when `4 | n` and the start is opposite. Return ∞ when the start gap is odd.
- **Generation recipe:** choose `n ∈ {4,6,…,16}` and a start gap `g`. If `g` even → finite, answer from the linear solve (or `n²/8` for opposite, `4|n`). If `g` odd → "never meet". Vary `n` and start (not only opposite) to produce distinct instances; the odd-gap version is the hardest because the reflexive answer (`n`) is wrong.
- **Difficulty:** **T3**.

### Archetype C — **Symmetric random walk return / hitting time on a graph** · **T2**
- **Concept / round:** first-step analysis / electrical-network intuition. Beat the Odds recurring family. Attested: 1Point3Acres ("expected return time on an n-gon = n"), QuantVault ("expected return time to start on a 6-node cycle").
- **Paraphrased example:** a token does a symmetric walk on the vertices of a hexagon (6-cycle). Expected number of steps to **return to its start**?
- **Full solution:** for a symmetric random walk on a vertex-transitive graph, **expected return time = number of vertices = n** (stationary distribution uniform ⇒ `E[return] = 1/π_v = n`). Hexagon → **6**. Expected time to reach the **opposite** vertex of an `n`-cycle is `(n/2)·(n/2)`... more precisely, hitting time between vertices distance `d` apart on an `n`-cycle is `d(n−d)`; opposite on hexagon (`d=3`) → `3·3 = 9`.
- **Exact answers (verified):** return time hexagon = **6**; distance-`d` hitting time on `n`-cycle = **`d(n−d)`** (checked by exact absorbing-chain solve: `n=6,d=3 → 9`; `n=6,d=1 → 5`).
- **Deterministic verifier:** return time = `n` for any vertex-transitive graph; general hitting times via exact solve of `E_i = 1 + Σ_j P_{ij} E_j` with the target absorbing. For the `n`-cycle, closed form `h(d) = d(n−d)`.
- **Generation recipe:** pick a graph family (cycle `C_n`, complete `K_n`, path, small custom graph) and ask return or hitting time. Cycle `d(n−d)` and `K_n` return `= n`, hitting `= n−1` give clean tunable answers; `n ∈ {4..12}`.
- **Difficulty:** **T2** (T3 if you ask a hitting time on an irregular graph requiring the full linear solve).

### Archetype D — **Gambler's ruin** (biased and unbiased) · **T2**
- **Concept / round:** ruin probability + expected duration. Attested: 1Point3Acres, SpaceComplexity, Quantt, everywhere in the family lists.
- **Paraphrased example:** you start with $k, bet $1 per round, win each round with prob `p` (lose with `q=1−p`), stop at $0 (ruin) or $N (goal). P(ruin)? Expected rounds?
- **Full solution:** with `r=q/p`, **P(ruin) = (r^k − r^N)/(1 − r^N)** for `p≠½`, and **`(N−k)/N`** for `p=½`. Expected duration `p=½`: **`k(N−k)`**; biased: `D_k = k/(q−p) − (N/(q−p))·(1−r^k)/(1−r^N)`.
- **Exact answers (verified):** fair `k=3,N=10 → P(reach N)=3/10=0.3`, `E[duration]=3·7=21`; biased `p=9/19` (single-number roulette even-money), `k=5,N=10 → P(ruin)=0.6287` (exact rational, verified).
- **Deterministic verifier:** the two closed forms above; guard `p=½` separately to avoid division by zero.
- **Generation recipe:** `p ∈ {0.4, 9/19, 0.5, 0.55}`, `k ∈ {1..N−1}`, `N ∈ {5..20}`. Ask P(ruin), P(goal), or expected duration. Biased small-edge cases with `N` large are hardest (answers cluster near 0 or 1, demanding care with `r^N`).
- **Difficulty:** **T2**.

### Archetype E — **Expected wait for a coin pattern** (Markov / Conway) · **T2**
- **Concept / round:** expected flips until a target string; the **HH vs HT asymmetry** is the trap. Attested: TheInterviewDen ("expected flips to see three heads in a row"), InterviewChamp.
- **Paraphrased example:** fair coin. Expected flips to first see **HHH**? And to first see **HT**?
- **Full solution:** absorbing Markov chain on matched-prefix length with KMP-style overlaps. **E[HHH] = 2+4+8 = 14** (`= Σ 2^i` for `i=1..3`), **E[HT] = 4**, **E[HH] = 6**. General fair-coin identity: `E[pattern] = Σ_{overlaps} 2^i` (Conway leading numbers); patterns with self-overlap (HH, HHH) wait longer than non-overlapping ones (HT).
- **Exact answers (verified):** `E[HH]=6`, `E[HHH]=14`, `E[HT]=4` (exact linear solve, all confirmed).
- **Deterministic verifier:** build the prefix-automaton (state = longest suffix that is a prefix of the target), solve `E = (I−T)^{-1} 1`. For fair coins, the correlation-polynomial / Conway-leading-number formula gives the same value in closed form.
- **Generation recipe:** choose an alphabet coin bias `p` and a target string of length `L ∈ {2..4}`. Overlapping targets (HHH, HTH) are harder than non-overlapping (HTT). Emit exact `E` from the automaton solve.
- **Difficulty:** **T2**.

### Archetype F — **Optimal stopping / secretary** · **T2–T3**
- **Concept / round:** sequential decisions, "see values one at a time, pick one". Attested: TheInterviewDen and InterviewChamp ("see numbers one at a time, pick one"); PracHub optimal-stopping family.
- **Paraphrased example:** `n` candidates arrive in random order; you see relative ranks only and must accept/reject irrevocably; you win only if you pick the single best. Optimal rule and win probability?
- **Full solution:** reject the first `r`, then take the first candidate better than all seen. Win prob `P(r) = (r/n)·Σ_{i=r+1}^{n} 1/(i−1)`. Optimize over `r`; as `n→∞`, `r/n → 1/e` and `P → 1/e ≈ 0.3679`.
- **Exact answers (verified):** `n=5 → r=2, P=0.4333`; `n=10 → r=3, P=0.3987`; `n=50 → r=18, P=0.3743`; `n=100 → r=37, P=0.3710` (all exact rational sums; converging to `1/e`).
- **Deterministic verifier:** compute `P(r)` for all `r∈{0..n−1}` exactly and take the max (returns both optimal `r` and `P`).
- **Generation recipe:** `n ∈ {5..100}`; ask for optimal cutoff, win probability, or "is stopping at position `j` optimal?". Variants (maximize expected value rather than P(best), or known distribution → threshold rule) push to **T3**.
- **Difficulty:** **T2** (best-choice); **T3** for value-maximizing / prophet variants.

### Archetype G — **Order statistics via symmetry** (draws without replacement) · **T2**
- **Concept / round:** linearity + symmetry; "remove/scan until an event". Attested: 1Point3Acres ("remove matched pairs/sets until one type remains"), PracHub order-statistics family.
- **Paraphrased example:** a bag has `R` red and `B` black balls; draw all without replacement. Expected number of **reds drawn before the first black**?
- **Full solution:** place the `B` blacks; they split the `R` reds into `B+1` gaps of equal expected size by symmetry, so expected reds before the first black = **`R/(B+1)`**. (Same symmetry gives "expected position of the last of `m` special cards among `N`" = `m(N+1)/(m+1)`.)
- **Exact answer (verified):** `R=7,B=3 → 7/4 = 1.75`; Monte-Carlo 200k shuffles, seed 9 → **1.741** (agree).
- **Deterministic verifier:** closed form `R/(B+1)`; or exact expectation `Σ_k k·P(k reds then black)` for a sanity check. For the "last special card" variant use `m(N+1)/(m+1)`.
- **Generation recipe:** `R ∈ {3..12}`, `B ∈ {1..6}`; or reframe as cards/tickets. Ask reds-before-first-black, or the position of the last ace in a deck (`4·53/5 = 42.4`). The symmetry insight is the difficulty.
- **Difficulty:** **T2**.

### Archetype H — **Coupon collector** · **T1–T2**
- **Concept / round:** expected time to collect all types. Attested: 1Point3Acres cheat-sheet family.
- **Paraphrased example:** rolling a fair die, expected rolls to see **all six** faces?
- **Full solution:** `E = n·H_n = n·Σ_{k=1}^n 1/k`. Die (`n=6`): **`6·(1+½+⅓+¼+⅕+⅙) = 147/10 = 14.7`**.
- **Exact answer (verified):** **14.7** exactly (`147/10`).
- **Deterministic verifier:** `E = n·sum(1/k for k in 1..n)`; variance `= n²·Σ 1/k² − n·H_n` for follow-ups.
- **Generation recipe:** `n ∈ {3..10}`; or unequal probabilities (then `E = ∫_0^∞ (1 − Π(1−e^{−p_i t})) dt`, a harder T3 variant). Ask "expected rolls" or "P(collected all within m rolls)" (inclusion-exclusion).
- **Difficulty:** **T1** (uniform); **T3** (non-uniform).

### Archetype I — **Bayesian update with a hidden parameter** · **T2**
- **Concept / round:** posterior after evidence, then a predictive probability. Attested: SpaceComplexity/Quantt/InterviewChamp (coin-bias, disease false-positive, urn composition).
- **Paraphrased example:** a coin is fair (P(H)=½) or biased (P(H)=¾), equally likely a priori. You flip **3 heads in a row**. P(biased)? P(next flip is heads)?
- **Full solution:** likelihoods `(½)³=1/8` vs `(¾)³=27/64`. Posterior biased `= (27/64)/(27/64+8/64) = 27/35`. Predictive next-head `= (8/35)(½)+(27/35)(¾) = 97/140`.
- **Exact answers (verified):** **P(biased|HHH)=27/35 ≈ 0.7714**, **P(next H)=97/140 ≈ 0.6929** (exact rational).
- **Deterministic verifier:** `post_i ∝ prior_i·Π likelihood_i(data)`; predictive `= Σ_i post_i·p_i`. Generalizes to `k` heads, `m` hypotheses, urn compositions, disease/test tables.
- **Generation recipe:** choose hypotheses `{p_1,…,p_m}` with priors, a data string (`h` heads / `t` tails), ask posterior or predictive. Difficulty rises with more hypotheses or a continuous prior (Beta → `T3`, posterior mean `(α+h)/(α+β+h+t)`).
- **Difficulty:** **T2** (discrete); **T3** (continuous/Beta or "at least two reds in three draws" with unknown composition).

### Archetype J — **Random-walk price crossing** (reflection principle) · **T2–T3**
- **Concept / round:** first-passage / barrier probability for a ±1 price. Attested: PracHub "Random-Walk Price Crossing Probability" (Optiver SWE, Aug 2025).
- **Paraphrased example:** a price starts at `s` units above 0 and each day moves ±1 (½ each) for `n` days. P(price is **negative after `n` days**)? P(price is **ever negative** within `n` days)?
- **Full solution:** after `n` days, `P(S_n<0)` is a binomial tail: negative iff up-days `U < (n−s)/2`. "Ever negative" uses **reflection**: `P(min < 0) = 2·P(S_n<0) + P(S_n hits the barrier exactly)` — computed cleanly by an absorbing-barrier DP.
- **Exact answers (verified, `s=2, n=10`):** `P(S_10<0) = 11/64 = 0.171875`; `P(ever<0) = 11/32 = 0.34375` (exactly `2×` the endpoint probability here — a clean reflection illustration). Both exact via DP.
- **Deterministic verifier:** endpoint via `Σ_{U: s+2U−n<0} C(n,U)/2^n`; "ever" via a DP that absorbs paths crossing the barrier and accumulates their mass.
- **Generation recipe:** `s ∈ {1..5}`, `n ∈ {6..20}`, optional drift `p≠½` (then `T3`, no clean reflection). Ask endpoint or first-passage probability; add a step size `x` (irrelevant to probability, tests unit-reasoning).
- **Difficulty:** **T2** (symmetric); **T3** (with drift or a two-sided barrier).

### Archetype K — **Combinatorial-symmetry EV** (dice/cards duels) · **T1–T2**
- **Concept / round:** count favorable equally-likely outcomes; symmetry. Attested: companion doc + Beat-the-Odds family; classic "P(my die beats yours)".
- **Paraphrased example:** two fair dice rolled; P(die 1 **strictly** greater than die 2)? Fair price for a game paying the higher of two dice?
- **Full solution:** by symmetry `P(>) = P(<) = (1 − P(=))/2 = (1 − 6/36)/2 = 15/36 = 5/12`. `E[max of two dice] = Σ k·(2k−1)/36 = 161/36 ≈ 4.47`.
- **Exact answers (verified):** `P(die1>die2) = 5/12 ≈ 0.4167`; `E[max] = 161/36 ≈ 4.472`.
- **Deterministic verifier:** enumerate the `d^2` (or `d^m`) equally-likely outcomes and count/average exactly.
- **Generation recipe:** vary die faces `d`, number of dice `m`, and the statistic (max, min, sum, "beats"). `E[max of m d-sided] = Σ_{k} k·(k^m−(k−1)^m)/d^m`. Fast to generate, easy to verify.
- **Difficulty:** **T1–T2**.

**Catalog coverage vs the requested skill list:** lattice-path counting (A), random-walk meeting probabilities (A, B), optimal stopping (F), Bayesian with hidden composition (I), expectation via states/recursion (B, C, E), martingale/stopping-time and gambler's-ruin variants (D, J), order statistics (G), combinatorial identities (K), coupon-collector (H). All present, each with a verified answer, verifier, and generator.

---

## Part 3 — The ANCHOR example, fully solved (proof of rigor)

**Problem (paraphrased):** A starts at (0,0) and each step moves up or right with prob ½ each; B starts at **(3,4)** and each step moves left or down with prob ½ each. Both step **synchronously**, indefinitely. What is the probability that A and B **ever occupy the same lattice point** (their paths intersect)?

### 3.1 Precise definitions and the parity trap

- **"Same point at the same time step" (synchronous meeting):** after `t` steps, A's coordinate sum is `t` (each step adds 1) and B's coordinate sum is `7 − t` (each step subtracts 1). Equal sums require `t = 7 − t ⇒ t = 3.5`, **not an integer**. Equivalently the gap `B_sum − A_sum` starts at 7 and decreases by 2 each step (7, 5, 3, 1, −1, …), never 0. **So the synchronous-meeting probability is exactly 0.** This is the trap: the "AMC-style" reflex answer `C(7,3)/2^7` is **wrong here** because the Manhattan gap (7) is **odd**. (Contrast: the classic AMC 2003 12A #22 uses start (5,7), gap 12 **even**, answer `C(12,5)/2^12 ≈ 0.19`.)
- **"Paths ever intersect" (the intended reading):** do the two trajectories, as sets of visited lattice vertices over all time, share a vertex? Key structural fact: each walker visits **exactly one vertex on each anti-diagonal** `Dk = {x+y=k}` (its sum increases/decreases by exactly 1 per step). So on diagonal `Dk`, A sits at a unique vertex `a_k` and B at a unique vertex `b_k`, and **the paths share a vertex iff `a_k = b_k` for some `k`** — even though that shared vertex is visited by A and B at *different* times (A at time `k`, B at time `7−k`). This is a well-posed, finite question because the only vertices reachable by both are inside the box `[0,3]×[0,4]` (A needs `x,y ≥ 0`; B needs `x ≤ 3, y ≤ 4`), and monotonicity means neither walker re-enters the box once it leaves.
- **"Paths cross" as continuous staircases:** identical to the shared-vertex event. Any crossing of an A-edge (horizontal at integer `y`, or vertical at integer `x`) with a B-edge occurs at an integer point that is necessarily a **vertex of both** staircases. So "continuous curves cross" ⇔ "share a lattice vertex". No separate case.

### 3.2 Exact solution by two-particle DP / enumeration

Enumerate each walker's **in-box trace** (the finite set of visited vertices with `0≤x≤3, 0≤y≤4`) together with its probability. From any in-box vertex the walker takes R/U (A) or L/D (B) with prob ½; a move leaving the box terminates the trace (the outside vertex is not recorded). Because every branch eventually exits the finite box, the leaf probabilities sum to 1 exactly (verified: `Σ p_A = Σ p_B = 1`, with 126 distinct traces each). Then

`P(intersect) = Σ_{trace_A, trace_B} p(trace_A)·p(trace_B)·[trace_A ∩ trace_B ≠ ∅]`.

**Result (exact):**

```
P(paths intersect | B=(3,4)) = 3273 / 4096 = 0.799072265625
```

**Equivalent efficient verifier (anti-diagonal DP):** sweep `k = 0,1,2,…`; track the joint distribution of `(a_k, b_k)` restricted to "not yet equal on any earlier diagonal"; add the mass wherever `a_k = b_k`. A's x-coordinate is a forward Markov chain in `k` (R: `x+1`, U: `x` same), B's is the reverse-direction chain; absorbing on equality. This is `O(box area)` and returns the same `3273/4096`.

### 3.3 Independent Monte-Carlo cross-check

Simulate both walkers until each exits the box; record whether their visited-vertex sets intersect.

```
Exact:                              0.799072265625  (= 3273/4096)
Monte-Carlo, 2,000,000 trials each:
  seed 1  -> 0.799579   (|Δ| = 0.000507)
  seed 7  -> 0.799623   (|Δ| = 0.000551)
  seed 42 -> 0.799175   (|Δ| = 0.000103)
Sampling s.e. at p≈0.799, N=2e6:   ≈ 0.00028
```

All three seeds agree with the exact value within roughly 1–2 standard errors. The DP and the simulation are independent implementations (one exact-rational enumeration, one sampled), so their agreement is strong evidence the answer `3273/4096` is correct. As a second independent validation, the same harness reproduces the known **same-time** results: `(5,7) → 99/512 = 792/4096 ≈ 0.1934` (matches AMC 2003 12A #22, "closest to 0.20"), `(2,4) → 15/64`, `(1,1) → 1/2`, and confirms the **anchor same-time = 0**.

### 3.4 Parameterized generation recipe (from the anchor)

- **Parameters:** B's start `(a, b)` (A fixed at origin). Optionally a finite horizon `T` (cap both walks at `T` steps); with no cap the box makes the walks effectively finite.
- **Which quantity to ask:**
  - *Same-time meeting:* answer `= 0` if `a+b` odd, else `comb(a+b, a)/2**(a+b)`.
  - *Path intersection:* answer from the in-box enumeration (or anti-diagonal DP) verifier.
- **Difficulty control:** **odd `a+b`** activates the parity trap and forces the path-intersection reading (hardest). Larger `a+b` increases the lattice-path counting load; increasing skew `|a−b|` lowers the intersection probability (e.g., `(1,4) → 231/512 ≈ 0.451`, `(5,2) → 4341/8192 ≈ 0.530`) while balanced starts raise it (`(4,4) → 27409/32768 ≈ 0.836`). The 5 coarse options should straddle the exact value so "pick the closest" stays non-trivial.
- **Correct-by-construction:** the generator emits `(a,b)`, runs the verifier to get the exact rational answer, then builds distractor buckets around it. Every emitted instance is guaranteed correct.

**Sample generated instances (exact answers, all verified):**

| B start | `a+b` | Same-time meet | Paths intersect |
|---|---|---|---|
| (3,4) | 7 (odd) | **0** | **3273/4096 ≈ 0.7991** |
| (5,7) | 12 (even) | 792/4096 ≈ 0.1934 | 1544071/2097152 ≈ 0.7363 |
| (2,3) | 5 (odd) | 0 | 203/256 ≈ 0.7930 |
| (4,5) | 9 (odd) | 0 | 52613/65536 ≈ 0.8028 |
| (1,4) | 5 (odd) | 0 | 231/512 ≈ 0.4512 |
| (4,4) | 8 (even) | 70/256 ≈ 0.2734 | 27409/32768 ≈ 0.8365 |

---

## Part 4 — What is uncertain or conflicting (be explicit)

- **80-in-8 inclusion:** genuinely conflicting. 2026 offer-holder Medium and EverythingQuant list it; two 2025/26 first-hand quant accounts omit a standalone version. **Medium** confidence it is role/cycle-dependent, not universally retired.
- **Beat the Odds question count:** 10 (phone-screen block, SpaceComplexity/EverythingQuant), ~20 (Aptitude-Test-Prep), ~30 (programhelp/1Point3Acres/QuantVault). The **90 s/Q, 5-option "pick the closest", +1/−1/0, no back-nav** structure is consistent (**High**); the **count varies by role/cycle** (directional).
- **"Harder in 2025/26":** multiple candidate reports say the Beat the Odds pool got harder and now includes anchor-style random-walk/meeting problems. This is first-hand but **qualitative** (**Medium**); it directly motivates the T3 tier here.
- **Zap-N roster size:** classically 9; recent QT/PhD invites often ~3. Both attested; the *exact set is invite-specific* (**Medium**).
- **Per-game Zap-N scoring:** no official rubric exists; interpretations are inferred from the cognitive paradigms (**Medium**).
- **New 2026/27 modules (Likelihood / Intervals / Order Books):** thin sourcing (one mentor write-up + one aggregator). Kept out of the hard-archetype catalog because they are estimation-style, not the hard-math tier requested. **Low–Medium.**
- **Onsite composition and "Optinomicon" naming:** structure is well-attested (probability deep-dive + market-making game + behavioral); exact per-round counts and internal names are **Medium/Low** and vary by office.

---

## Sources (accessed 7 Aug 2026; confidence)

**Tier 1 (firm/vendor):** Zyvo Zap-Q product page (High, Zap-Q psychometrics); `tools.optiver.com` practice site (High, 80-in-8 exists and is drilled).

**Tier 2 (2025–2026 first-hand / candidate problem banks):**
- Medium — "Optiver Interview Experience 2026 (offer holder)" — https://medium.com/@yourhome1106/optiver-interview-experience-2026-full-process-honest-tips-from-an-offer-holder-403461a76924 — **Medium** (full loop; 80-in-8 + NumberLogic + Beat the Odds + Zap-N/Zap-Q + HackerRank; "Beat the Odds notoriously difficult").
- 1Point3Acres — "Beat the Odds — Probability Test — Optiver" — https://www.1point3acres.com/interview/problems/company/optiver/beat-the-odds-probability — **Medium** (topic list: dice/coin/card, EV, **symmetric random walks on polygons (return time = n)**, **gambler's ruin**, combinatorics, CLT estimation, **optimal-stopping**; "2025/26 pool noticeably harder"; rotating bank).
- PracHub — Optiver Statistics & Math (Updated 2026) — https://prachub.com/companies/optiver/categories/statistics-and-math — **Medium** (dated candidate items: "Meeting Time on a Random Walk Around an Octagon" Jul 2025; "Random-Walk Price Crossing Probability" Aug 2025; "At Least Two Reds in Three Draws" Sep 2025).
- WSO — Optiver Chicago (Oct 2025) and Amsterdam QR (2025/26) first-hand accounts — **Medium** (battery contents; GDPR-confirmed passing score despite rejection).
- SpaceComplexity — "Optiver Phone Screen" — https://spacecomplexity.ai/blog/optiver-phone-screen-interview — **Medium** (phone Beat-the-Odds block ~10 Q/15 min; EV/geometric, Bayes, combinatorics, tennis/gambler's ruin/die optimization; ~55/80 practical cutoff).

**Tier 3 (prep/aggregator — shape and family lists, weak evidence):**
- EverythingQuant — Optiver Trader Guide — https://everythingquant.com/guides/quantitative-trading-at-optiver/ — **Low–Medium** (explicit 9-game Zap-N list incl. Number Box/reverse digit span/Figure It Out; onsite probability families: Tennis, Die Optimisation, Defective Coin; brainteasers; market-making "Optinomicon" card/sports games).
- QuantVault — Optiver OA + Interview + Zap-N pages — https://quantvault.org/optiver-online-assessment.html — **Low–Medium** ("expected return time on a 6-node cycle"; ~30 Q/45 min Beat the Odds; recent ~3 Zap-N games).
- TheInterviewDen — https://theinterviewden.com/companies/optiver-trading-interview — **Low–Medium** (numerical/probability round; EV of a die = 3.5; optimal stopping "see numbers one at a time"; Bayes; "expected flips to three heads in a row").
- InterviewChamp — https://interviewchamp.ai/interview-questions/optiver/quant-research-new-grad — **Low–Medium** (pipeline; market-making coin-flip game; EV/spread discussion).
- Aptitude-Test-Prep, JobTestPrep, Quant Career Hub, Quantt, Applr — **Low–Medium** (Zap-N mechanics, 80-in-8 gate, per-game paradigms).

**Calibration references (math, for verifying answers):**
- AMC 2003 12A Problem 22 (Po-Shen Loh solution) — https://live.poshenloh.com/past-contests/amc12/2003A/problem/22 — same-time meeting `C(12,5)/2^12 ≈ 0.19` (validates the same-time formula).
- MathOverflow "probability two random walkers meet" (parity/Pólya) and Math.StackExchange "(2,4) meet = 15/64" — validate the parity argument and the same-time machinery.

---

## Appendix — Verifier pseudocode (for the content-engineering pipeline)

All answers above come from these routines (described, not shipped as repo code):

1. **Absorbing-chain solver (C, D, E, B):** build transition matrix `P` over transient states, target absorbing; solve `(I − Q) x = 1` for expected times, or `(I − Q) h = R·1_target` for hitting probabilities, using exact rationals.
2. **Two-particle path enumeration (A, anchor):** recursively enumerate each monotone walker's in-box trace with `(1/2)^moves` weight; `P(intersect) = Σ p_A p_B [traces overlap]`. Anti-diagonal DP is the `O(area)` equivalent.
3. **Binomial tail / reflection (J, A same-time):** `Σ C(n,k)/2^n` over the qualifying range; barrier DP for first-passage.
4. **Exact enumeration (K):** iterate all `d^m` dice/card outcomes; count or average.
5. **Monte-Carlo harness (cross-check):** fixed seed, ≥1e6 trials; report point estimate and compare to exact within `sqrt(p(1−p)/N)`.

**Correct-by-construction guarantee:** a generator samples parameters in the stated ranges, calls the matching verifier to obtain the exact answer, then constructs the 5 coarse "pick the closest" options to straddle it. No instance ships without a computed answer.
