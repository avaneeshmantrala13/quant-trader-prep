# Jane Street 2026 — Deep, Verified Interview & Hard Archetype Catalog

**Compiled:** 7 Aug 2026. **Purpose:** Source-attributed research on Jane Street's *current* (2025–2026) trader assessment + interview, turned into a **verified, hard question-archetype catalog** for generating similar hard questions. Companion + deeper successor to `FIRM_INTERVIEW_LIVE_RESEARCH_2026.md` and `FIRM_MOCK_PRESETS.md`.

**How this file was built:** (1) Fresh WebSearch/WebFetch pass over Jane Street's own published material and 2025–2026 first-hand candidate write-ups, cross-checked against the prior research files. (2) Every quantitative answer below was **computed and verified in this pass** with an exact dynamic-program / enumeration **and** an independent Monte-Carlo cross-check; the reported DP-vs-MC agreement is stated inline. Verification harness (scratch, not committed): `verify.py` (exact DP for the bank-or-roll cascade, 2^7×2^7 enumeration for the lattice-meeting anchor, closed-form + MC for the market-making P&L engine).

**Difficulty anchor (calibration target, do NOT copy):** *"A starts at (0,0) stepping up/right w.p. 1/2 each; B starts at (3,4) stepping left/down w.p. 1/2 each; probability their paths ever intersect."* Every archetype here is calibrated to this level or harder. (The anchor itself is solved and verified in Archetype B1 below: **3273/4096 ≈ 0.7991**.)

**Paraphrase rule:** every example question is paraphrased/generalized so we can generate our own variants. The one long primary artifact quoted (Jane Street's own mock-interview video) is the firm's own published sample and is still summarized rather than reproduced.

**Confidence key:** **High** = firm-official and/or multiple independent 2025–2026 primary reports agree. **Medium** = consistent across aggregators + some primary confirmation. **Low** = single/old/lead-gen source. **Recency** tags are inline.

---

# PART 1 — PROCESS & FORMAT (2025–2026)

Jane Street's trader loop has four load-bearing stages. The mental-math screen is a **separate hard gate**; the reasoning/market-making rounds are where the real signal lives.

## 1.1 The mental-math screen (a SEPARATE gate) — Confidence: High

- **Format:** ~**60 questions in ~8 minutes** (≈8 s/question), no calculator, no scratch paper. Content: 2-digit × 2-digit multiplication, division, percentages of round numbers, decimal arithmetic, fraction↔decimal comparison. Zetamac-style.
- **Bar:** roughly **70–85% correct** to pass, varying by role/cycle. Treat as directional, not a literal key.
- **Gating:** **Failing the math test ends the process regardless of resume.** "Multiple well-credentialed candidates fail the mental-math test and get rejected without further interviews each year. There is no 'make it up later' mechanism." (techinterview.org, updated Jul 2026). Zetamac ≥60 in 2 minutes correlates with passing; <40 generally does not.
- **Nuance / mild source conflict:** techinterview.org treats the screen as decisive and gatekeeping; **tradermath.org** frames it as "accuracy over speed" and says you don't need to be a mental-math savant, only numerate. Reconciliation: the *screen* is a hard speed gate; the *conversational rounds* value accuracy/clarity over raw speed. Both are true of different stages. (Confidence High on the gate existing; Medium on exact cutoff.)

## 1.2 Phone / video technical rounds (1–3) — Confidence: High

- **Shape:** 45–60 min each, conducted by traders. "Feels a lot more like a conversation than a quiz" and "won't require previous knowledge of finance or... complicated math." (janestreet.com/trading-interviews, firm-official, evergreen 2026.)
- **Content:** 3–5 probability/EV/brainteaser problems solved out loud. Coin/dice/card problems, random walks, stopping times, multi-stage games, conditional probability, expected-value reasoning under constraints. Interviewers **vary the problem if they suspect a memorized answer**.
- **First-hand (Dev.to, "Jane Street Interview Experience," 2025):** Round 1 = "quick, sequential probability puzzles" where "they care more about how you think than the final number" and "push deeper — 'Why?' 'Can you optimize this?' 'Can we simplify the model?'". Round 2 = a **trading simulation** where "the interviewer simulated a series of trading scenarios, **changing parameters mid-discussion**." (Primary, 2025.)

## 1.3 Super Day / final committee — Confidence: High

- **Shape:** full day (in person in NYC or virtual equivalent), **4–6 back-to-back 45–60 min rounds** with traders/researchers and at least one senior partner, plus an evaluated informal lunch/chat. Decision typically within 1–2 weeks. Total pipeline ≈ 6–10 weeks. (myntbit 2026; theinterviewden 2026.)
- **The morning is dominated by market-making games.** First-hand (QuantVault, "What I Went Through in the Jane Street Quant Trader Interview," 2026): *"The morning was entirely market-making games — same format whether you're going for trader or researcher. You get chips (your capital), there's some random process (dice, cards, a constructed scenario), and you quote two-sided markets on some quantity over many rounds. Sometimes several things trade at once."* Named games in that account: **Three-Dice Min** ("make a market on the minimum of three hidden dice — the canonical Super Day game"), **Card Sum Trader**, **Hedge the Sum**, **RGB Counts Product**, **Beat the Odds**.
- **Figgie:** Jane Street's own trading card game shows up in interviews as a market-awareness/risk exercise (Arjun Mathur, Medium 2025; the game is firm-published). Tests reading order flow, adapting to prices, arithmetic under pressure.
- **What they grade on (firm's own recap + first-hand):** clarify the problem before working (they *praise* re-asking until rules are clear); **think out loud**; break the problem into solvable pieces; **try a concrete strategy to generate better ideas** even if suboptimal; take hints and run; composure. Explicitly: *the final number is secondary to reasoning and collaboration* — "iterative and collaborative problem solving replicates a conversation on the trading desk." (Mock video recap.) QuantVault adds the trader-desk habits: **think in variance not just EV** (distribution width sets your spread), **check downside before you quote** (keep single-trade worst case to ~70–80% of stack), and **narrate everything** ("a good trade made quietly counted for less than a so-so one I talked through").

## 1.4 The signature adversarial move — Confidence: High (firm-official)

After you solve a part, the interviewer does **not** move on. The canonical cascade (straight from Jane Street's own mock video, and corroborated by efinancialcareers' write-up of that mock):
1. **Change a rule of the game** (structural mutation, not arithmetic on your answer).
2. **Introduce an adversary** (single-agent optimization → game-theoretic equilibrium).
3. **Push you to generalize** (solve for the optimal threshold as a function of parameters / generalize-to-n).
4. **Offer an elegant reframe as a hint** ("you make ~$X/turn — so should you spend a turn to bank a small value?"), rewarding candidates who take the hint and run.
5. In make-a-market: **adverse selection** ("I keep lifting your ask — what does that tell you? Adjust." / "Your spread's too wide, I won't trade. Tighten.").

## 1.5 Sources (Part 1)

- **[firm-official]** Jane Street — *Trading Interviews* — https://www.janestreet.com/trading-interviews/ — evergreen/2026 ("conversation not a quiz"; no finance/advanced math; phone then in-person final).
- **[firm-official primary]** Jane Street (YouTube) — *A Jane Street Trading Mock Interview with Graham and Andrea* — https://www.youtube.com/watch?v=NT_I1MjckaU — pub. 2022, still the firm's canonical reference in 2026. **Full 25:42 transcript reviewed**; the flagship bank-or-roll game and its exact 3-part mutation cascade are transcribed directly from it.
- **[primary, 2026]** QuantVault — *What I Went Through in the Jane Street Quant Trader Interview* — https://quantvault.org/blog-jane-street.html — Super-Day morning = all market-making; Three-Dice Min canonical; variance→spread; downside sizing; named games.
- **[primary, 2025]** Dev.to (net_programhelp) — *Jane Street Interview Experience* — https://dev.to/net_programhelp_e160eef28/jane-street-interview-experience-the-most-intense-yet-inspiring-quant-interview-ive-ever-had-4lc2 — OA→2 phone→superday; params changed mid-discussion; "how you think > final number."
- **[secondary, 2026]** techinterview.org — *Jane Street Interview Guide 2026* (updated Jul 21 2026) — https://www.techinterview.org/companies/jane-street/ — 60Q/8min gate, 70–85% bar, archetype list, market-making mechanics.
- **[secondary, 2026]** theinterviewden.com — *Jane Street Quantitative Trader Interview* — https://theinterviewden.com/companies/jane-street-quant-trader-interview — market-making 45–60 min; "number 1–100" example; adverse-selection framing.
- **[secondary, 2026]** myntbit — *Jane Street Quant Interview Guide 2026* — https://myntbit.com/blog/jane-street-quant-interview-guide-2026 — 5-stage funnel; superday 4–6 rounds; calibration/Bayes/aggression grading.
- **[secondary]** efinancialcareers — *How to get a job at Jane Street* — https://www.efinancialcareers-canada.com/news/how-to-get-a-job-at-jane-street — narrates the mock's 20-sided-die cascade and "follow-up depends on how right you were."
- **[secondary]** Quantt — *Jane Street Interview Guide* — https://www.quantt.co.uk/resources/jane-street-interview — "market sense" questions; meteorologist adverse-selection example; update beliefs.
- **[context]** Arjun Mathur (Medium, 2025) — Figgie used in interview; mnshah0101 (Medium) — Monte-Carlo analysis of the mock's strategies.

> **Cross-check status:** Process shape (four stages, math gate, market-making-centric superday, mutate/adversary/generalize follow-ups) is **corroborated by ≥2 independent sources including firm-official material → High**. Exact cutoffs, per-round counts, and comp figures are **directional (vendor-recycled)** and labeled as such. Thin/single-sourced items (specific named superday games beyond Three-Dice-Min) are flagged Medium.

---

# PART 2 — HARD ARCHETYPE CATALOG (CORE)

Each archetype gives: **name · concept · round**, a **paraphrased concrete example**, a **full step-by-step solution**, the **exact verified answer** (computed this pass), a **deterministic verifier** (formula/DP/recurrence), and a **generation recipe** (parameter ranges + algorithm for many distinct hard instances).

Notation: all "verified" answers below were produced by an exact method **and** an independent Monte-Carlo run; DP-vs-MC agreement is stated.

---

## A. EV / OPTIMAL STOPPING — "bank-or-roll" (the flagship). Round: reasoning / trading-sim.

**Concept.** A finite-horizon Markov decision process. At each step you choose between *banking* a known current reward (which may persist) and *rerolling* for a fresh random reward, sacrificing the turn. Optimal policy is a **time-varying threshold**: bank iff the current face beats the value of continuing.

> The full base problem + a chain of 4 mutations (change a rule → add an adversary → generalize-to-n) is the **Jane Street Mutation Cascade**, given in **Part 3**. Here we record the base archetype's verifier and recipe.

**Paraphrased example (base).** *A 20-sided die sits showing 1. You have 100 rounds. Each round you either reroll (replace the face with a fresh uniform draw, earning nothing that round) or bank (collect dollars equal to the current face; the die keeps showing that face). Maximize expected total. What's your strategy and expected earnings?*

**Full solution.** Let `V(r, v)` be the optimal expected future earnings with `r` rounds left and face `v` showing.
- Bank: `v + V(r-1, v)`.
- Reroll: `(1/n) · Σ_w V(r-1, w)` (call it the *continuation value* `C(r-1)`).
- `V(r,v) = max(v + V(r-1,v), C(r-1))`, with `V(0,·)=0`.

Bank iff `v ≥ threshold(r)`, where `threshold(r)` is the smallest `v` with `v + V(r-1,v) ≥ C(r-1)`. Early in the game you're picky (hold out for 18+); as rounds run out the threshold falls (a bird in hand).

**Exact verified answer (n=20, R=100).** **E[optimal total] = 1773.34** (DP exact; Monte-Carlo 200k = 1773.18, Δ=0.16). Optimal threshold schedule `take iff v ≥ t(r)`:

| rounds left r | 100–61 | 60–35 | 34–23 | 22–16 | 15–11 | 10–8 | 7–6 | 5 | 4 | 3 | 2 | 1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| threshold t(r) | 18 | 17 | 16 | 15 | 14 | 13 | 11–12 | 10 | 9 | 8 | 6 | 1 |

(Sanity: a naive fixed "bank ≥18 forever" strategy yields ≈1767, matching the mock candidate's estimate; the time-varying optimum adds ≈6.)

**Deterministic verifier.** Backward DP above; O(n·R) time. To score a candidate's *policy* (a threshold function or fixed threshold), evaluate its expected value by the same recursion restricted to that policy, and compare to `V(R, start)`. Loss = `V(R,start) − V_policy`.

**Generation recipe.** Parameters: die faces `n ∈ {6,10,12,20,100}`; rounds `R ∈ {5,10,20,50,100,∞-approx}`; optional per-reroll cost `c ≥ 0` (subtract `c` from reroll branch); optional payoff transform `g(v)` (bank `g(v)` instead of `v`, e.g. `v²`, to shift the threshold). Algorithm: run the DP, read off `V(R,start)` and the threshold schedule; emit the question with those hidden. Distinct hard instances come from `(n,R,c,g)`; each has a unique exact answer from the DP. Difficulty scales with `R` (longer horizon = more threshold structure) and with nonlinear `g`.

---

## B. PROBABILITY / COMBINATORICS. Round: phone + reasoning.

### B1. Lattice-path random-walk meeting (the ANCHOR archetype)

**Concept.** Two monotone lattice walks approaching each other; probability their **visited-point sets intersect**. Key structural insight: on the anti-diagonal `x+y=k`, each walk visits **exactly one** point, so the walks can only meet on matching anti-diagonals, and a finite number of steps fully determines the outcome.

**Paraphrased example.** *A starts at (0,0) and each step moves right or up with prob 1/2. B starts at (3,4) and each step moves left or down with prob 1/2. What is the probability their paths ever share a lattice point?*

**Full solution.**
1. `x+y` increases by 1 each A-step and decreases by 1 each B-step. A starts on anti-diagonal 0, B on anti-diagonal 7. A visits anti-diagonals 0,1,…,7 (one point each); B visits 7,6,…,0 (one point each). **7 steps each fully determines intersection** (beyond that they diverge forever).
2. Meeting ⇔ ∃ `k ∈ {0,…,7}` with `A_k = B_k`, where `A_k`/`B_k` are the unique points each visits on anti-diagonal `k`.
3. Enumerate all `2^7 × 2^7 = 16384` path pairs, count those with a shared point.

**Exact verified answer.** **13092 / 16384 = 3273/4096 ≈ 0.79907** (exact enumeration; Monte-Carlo 500k = 0.7987, Δ=0.0003).

**Deterministic verifier.** For start `B=(bx,by)` with `s=bx+by`: enumerate `2^s × 2^s` pairs of ±-step sequences, build each walk's visited-point set, count pairs with nonempty intersection, divide by `4^s`. (Closed-form alternative: A on anti-diagonal `k` is `Binomial(k, ·)`-distributed along the diagonal; B likewise from its corner; `P(meet) = 1 − Π_k P(A_k ≠ B_k)` is **not** valid because the per-diagonal events are dependent through the shared step history — so enumeration/DP is the correct verifier, not a naive product.)

**Verified generalizations** (same method): `B=(1,1)→7/8`; `(2,2)→109/128`; `(2,3)→203/256`; `(3,3)→431/512`; `(3,4)→3273/4096`.

**Generation recipe.** Parameters: start corner `B=(bx,by)` with `bx+by=s ∈ {2,…,10}` (enumeration is `4^s`, cheap to `s≈12`); optionally asymmetric step probs `p≠1/2` (weight each path by `p^(#right)(1−p)^(#up)`); optionally "meet at the **same time**" variant (require `A_k=B_k` at equal step index only) which changes the answer and is a good adversarial twist. Emit `(bx,by,p)`; the exact answer is the enumeration output. Difficulty scales with `s` and with the same-time twist.

### B2. Lattice-path counting / ballot (combinatorics backbone)

**Concept.** Count monotone lattice paths under a constraint; the engine behind card-sum and random-walk problems.

**Paraphrased example.** *How many monotone paths from (0,0) to (n,n) stay weakly below the diagonal `y ≤ x`?*

**Full solution.** Catalan number `C_n = (1/(n+1))·binom(2n,n)`; unconstrained paths `binom(2n,n)`; reflection principle gives the constrained count.

**Exact verified answer (examples).** `C_3 = 5`, `C_4 = 14`, `C_5 = 42` (direct formula; trivially enumerable).

**Deterministic verifier.** `C_n = binom(2n,n)/(n+1)`; or DP over the grid counting paths with the ≤-constraint. For ballot "candidate A always strictly ahead" use `(a−b)/(a+b)·binom(a+b,a)`.

**Generation recipe.** Parameters: grid `n ∈ {3,…,12}`; barrier line `y ≤ x + b`; or ballot margins `(a,b)`. Emit constraint; verifier = reflection formula cross-checked by grid DP.

---

## C. MARTINGALE / STOPPING & CONDITIONAL EXPECTATION VIA STATES. Round: phone + reasoning.

### C1. Expected time via absorbing-state recurrences ("expected flips to a pattern")

**Concept.** Set up a small Markov chain over "progress" states; solve linear equations for expected hitting time. The canonical anti-memorization target (interviewers vary the pattern).

**Paraphrased example.** *Flip a fair coin until you first see two heads in a row (HH). Expected number of flips?*

**Full solution.** States `S0` (no progress), `S1` (last flip H). `E0 = 1 + ½E1 + ½E0`; `E1 = 1 + ½·0 + ½E0`. Solve: `E0 = 6`.

**Exact verified answer.** **E[flips to HH] = 6** (linear-system exact; Monte-Carlo 500k = 5.99). For comparison, HT has expected 4 — a great "why are they different?" follow-up (HH can "waste" the built-up H on a tail; HT cannot).

**Deterministic verifier.** Build the pattern's **prefix-automaton** (KMP failure function), form the transition matrix over automaton states, solve `(I−Q)·e = 1` for expected steps to the absorbing accept state. Handles any target string over any finite alphabet, exactly.

**Generation recipe.** Parameters: alphabet size `m ∈ {2,…,6}` (coin/die faces), pattern length `L ∈ {2,…,5}`, biased symbol probs. The automaton verifier returns the exact expected time and, as a bonus, the exact variance. Distinct instances = distinct `(pattern, probs)`; overlapping patterns (HH, HHH, HTHT) are the hard ones.

### C2. Gambler's ruin / symmetric random walk (martingale identity)

**Concept.** Optional-stopping on the martingale `X_t` (position) and on `X_t² − t`; yields both ruin probability and expected duration without solving big systems.

**Paraphrased example.** *A fair ±1 walk starts at 3; it stops at 0 or at 10. Probability it reaches 10 first? Expected number of steps?*

**Full solution.** `X_t` is a martingale ⇒ `P(hit N) = a/N`. `X_t² − t` is a martingale ⇒ `E[τ] = a·(N−a)`.

**Exact verified answer (a=3, N=10).** **P(reach 10) = 3/10 = 0.30**; **E[steps] = 3·7 = 21** (closed form; Monte-Carlo 300k = 0.2998 and 21.04).

**Deterministic verifier.** Biased case (`p≠½`): `P(hit N) = (1−(q/p)^a)/(1−(q/p)^N)`; `E[τ] = a/(q−p) − (N/(q−p))·(1−(q/p)^a)/(1−(q/p)^N)`. Cross-check by absorbing-chain linear solve.

**Generation recipe.** Parameters: start `a`, barriers `0` and `N` with `N ∈ {6,…,20}`, step bias `p ∈ {0.4,0.5,0.6}`, optional asymmetric step sizes. Emit `(a,N,p)`; verifier = the closed forms above + chain solve.

---

## D. GAME-THEORETIC QUOTING & MAKE-A-MARKET. Round: superday market-making.

Covered in depth in **Part 3 (Mutation 2, the casino adversary)** and **Part 4 (market-making verifier)**. Concept: turn a single-agent EV problem into a two-player zero-sum by letting a counterparty act against you; solve for the equilibrium threshold / equilibrium spread by minimax DP.

---

# PART 3 — THE JANE STREET MUTATION CASCADE (fully specified, each mutation verified)

This is the flagship deliverable: one base problem and a chain of mutations that **change a rule → add an adversary → generalize-to-n**, each with its own exact verified answer. Base problem and Mutations 1–2 are transcribed (paraphrased) from Jane Street's own mock video; Mutation 3 (generalize-to-n) and Mutation 4 (per-reroll cost) are our verified extensions in the same spirit.

**All values verified this pass by exact backward DP + independent Monte-Carlo (200k trials); DP-vs-MC deltas < 0.2 on totals.**

## Base — "bank-or-roll, die stays"
- **Rules:** 20-sided die showing 1, 100 rounds; each round reroll (0 earned, fresh uniform face) or bank (collect face; die keeps that face).
- **Optimal policy:** time-varying threshold (table in Archetype A).
- **Exact answer:** **E = 1773.34** (MC 1773.18). Start-of-game threshold: bank iff face ≥ **18**.

## Mutation 1 (CHANGE A RULE) — "die removed after banking"
- **New rule:** when you bank, the die is taken off the table; you must **spend a turn rerolling** to restore it before you can bank again.
- **Why it's a framework test:** banking now costs a future turn, so the trade-off is *value banked vs. turns consumed*. The threshold collapses dramatically.
- **State DP:** `V(r,off) = C(r-1)` (forced reroll); `V(r,on,v) = max(v + V(r-1,off), C(r-1))`, `C(r-1)=mean_w V(r-1,on,w)`.
- **Optimal policy:** steady threshold **bank iff face ≥ 6** for essentially the whole game (r≥8), with minor endgame wobble.
- **Exact answer:** **E = 555.05** (MC 555.23, Δ=0.18). That's ≈ **$5.55/turn**.
- **The elegant reframe hint (from the mock):** "You make about $5 per turn overall — so should you ever spend a turn to bank a 7?" Answer: yes, bank anything above your per-turn rate; hence threshold ≈ 6. This closes the loop between the DP and the one-line intuition.

## Mutation 2 (ADD AN ADVERSARY) — "the casino rerolls"
- **New rule:** revert to die-stays rules, but after you bank, the **casino** may reroll the die for free (doesn't cost your turn), choosing to **minimize** your total.
- **Why it's a step up:** single-agent optimization becomes a **two-player zero-sum**; solve by minimax DP.
- **Minimax DP:** `V(r,v) = max( v + C(r-1,v), mean_w V(r-1,w) )` where the casino's post-bank value `C(r-1,v) = min( V(r-1,v), mean_w V(r-1,w) )` (keep vs reroll).
- **Equilibrium (verified):** **you bank iff face ≥ 9**; **casino rerolls iff face ≥ 9** (stable for r≥8). Clean fixed point.
- **Exact answer:** **game value = 863.93** (MC 864.06, Δ=0.12) ≈ **$8.64/turn**. The adversary roughly **halves** your base winnings (1773 → 864).
- **The per-turn intuition still works:** you earn ≈$8.6/turn, so you bank anything above ≈8.6 → threshold 9. (The mock candidate guessed "≈10–11"; the exact equilibrium is **9**. Recording this as a source-vs-computation delta: the video is a live discussion, not a solved answer; our DP is the authority.)

## Mutation 3 (GENERALIZE-TO-n) — closed form for the die-removed variant
- **Setup:** n-sided die, die-removed-after-bank rule (Mutation 1), long horizon. Choose a threshold `k` (accept faces `k..n`).
- **Rate derivation:** an "accept-then-restore" cycle uses `n/(n−k+1)` expected rerolls to hit an acceptable face plus 1 banking turn; the banked value averages `(k+n)/2`. Long-run **per-turn rate** `R(k) = [(k+n)/2] / [ n/(n−k+1) + 1 ]`. Maximize over integer `k`.
- **Verified optima (closed form):**

| n | optimal threshold k* (accept k..n) | per-turn rate |
|---|---|---|
| 6 | 2 | 1.818 |
| 10 | 3 | 2.889 |
| 20 | **6** | 5.571 |
| 100 | 28 | 27.006 |

  The `n=20, k*=6, rate≈5.57` row reproduces Mutation 1 (DP gave $5.55/turn and threshold 6) — **the closed form and the DP agree**, validating both.
- **Generation recipe:** pick `n`, compute `k*` and `R(k*)` from the formula; ask the candidate to *derive the maximization* (Jane Street explicitly asks candidates to *set up* rather than grind). Optional harder twist: reroll cost `c` shifts `k*` upward (see Mutation 4).

## Mutation 4 (our extension: PER-REROLL COST — sharpens the trade-off)
- **New rule:** each reroll costs `c` dollars (base/Mutation-1 rules otherwise).
- **DP:** subtract `c` from the reroll branch: reroll value `= C(r-1) − c`.
- **Effect (verified direction):** higher `c` raises the acceptance threshold and lowers `E`; at large `c` you bank almost anything. Provides a continuous difficulty dial and a clean "how does the answer move in `c`?" probe. (Verifier = same DP with the cost term; each `(n,R,c)` yields a unique exact answer.)

**Cascade design note for our mock:** deliver Base → Mutation 1 → Mutation 2 → Mutation 3 in order, each unlocking only after the prior is answered, and score **framework survival** (did the threshold logic adapt?) over the raw number. The per-turn reframe should be offered as a hint after Mutation 1 and reused in Mutation 2 — rewarding "take the hint and run."

---

# PART 4 — MARKET-MAKING ARCHETYPE + DETERMINISTIC P&L VERIFIER

**Concept.** Quote a two-sided market on a hidden value drawn from a known distribution. You face a mix of **informed** flow (knows the true value, picks you off = adverse selection) and **uninformed** flow (trades a random side). A correct quote balances the **half-spread edge** you earn from uninformed flow against the **adverse-selection loss** to informed flow, while **competition** punishes quotes that are too wide. This is precise enough to drive a deterministic P&L scorer.

## 4.1 Model (fully specified)
- **Hidden value** `V ~ Uniform{1..N}` (default `N=100`, fair value `μ=(N+1)/2=50.5`). Any known distribution works (e.g. min-of-3-dice, card sums).
- **Candidate quote:** any `(bid, ask)` and size (size scales P&L linearly).
- **Per round, one counterparty arrives:**
  - **Informed w.p. q** (knows `V`): **lifts your ask iff `V > ask`**, **hits your bid iff `V < bid`**, never trades inside your spread. This is the adverse-selection channel.
  - **Uninformed w.p. 1−q:** wants a random side (50/50), but **only fills with you with competition probability `φ(h) = max(0, 1 − h/H)`**, where `h = (ask−bid)/2` is your half-spread and `H` is the widest half-spread the market tolerates before a competitor takes the flow. Wider quote ⇒ fewer uninformed fills. (This term is what forces a finite optimal spread; without it the trivial answer is "quote infinitely wide.")
- **P&L per fill:** sold at ask → `ask − V`; bought at bid → `V − bid`.

## 4.2 Closed-form P&L (the deterministic scorer)
```
E[P&L]/round = (1−q)·φ(h)·((ask−bid)/2)              # uninformed: half-spread × fill prob
             − q·( E[(V−ask)^+] + E[(bid−V)^+] )      # informed: pay both tails (adverse selection)
```
- The **uninformed term** rewards spread but is throttled by competition `φ(h)`.
- The **informed term** is the **adverse-selection score**: it grows with the tails outside your quote and, crucially, **penalizes a mispriced mid** (an off-center quote fattens one tail). This is exactly what "the counterparty keeps lifting your ask" is measuring.

## 4.3 Verified results (N=100, H=40; closed-form vs Monte-Carlo 400k agree to < 0.03/round)
- **Optimal symmetric quote widens with informed fraction q:** `q=0.3 → h*≈24.5, E*≈+4.70`; `q=0.5 → h*≈28.5, E*≈+1.79`; `q=0.7 → h*≈34.5, E*≈−0.26` (past a point, informed flow makes even the best quote unprofitable — you should *widen and reduce size*, or decline).
- **Scoring examples at q=0.5** (best achievable ≈ +1.8/round):
  - Quote `49.5/51.5` (**too tight**): **E = −11.52/round** — destroyed by adverse selection. Verifier: closed-form −11.5175 vs MC −11.5168.
  - Quote `10.5/90.5` (**too wide**): **E = −0.50/round** — almost no uninformed fills; only informed trade (rarely), net small loss.
  - Quote `58.5/78.5` (**mispriced mid, skewed high**): **E = −5.87/round** — the off-center mid fattens the lower informed tail; strictly worse than a centered quote of the same width.
  - A moderate centered quote `38.5/62.5` (h=12): **E ≈ −3.02/round** — still too tight for this `H`; illustrates that "reasonable-looking" spreads can lose when informed flow is heavy.

## 4.4 Deterministic verifier + scoring
- **Verifier:** given `(N-distribution, q, H, size)` and a candidate `(bid, ask)`, compute `E[P&L]/round` by the closed form above (tails computed exactly by summation over the support). Optionally confirm with a fixed-seed Monte-Carlo (they agree to MC noise, as shown).
- **Score the candidate** on: (a) **mid accuracy** = |their mid − μ| (drives the adverse-selection term); (b) **spread calibration** = |their h − h*(q,H)|; (c) **P&L gap** = `E*[optimal] − E[their quote]`; (d) **adverse-selection awareness** = did they widen/skew after being repeatedly lifted (simulate a few informed hits and re-quote)? (e) **inventory/skew** = after a fill, does the next quote skew to flatten?
- **Adverse selection reproduced deterministically:** raise `q` and watch the optimal spread widen and P&L fall — the engine turns "who's trading against me and why" into a number.

## 4.5 Generation recipe
- **Distributions:** Uniform{1..N} (number 1–100), **min-of-3-dice** (verified fair value **441/216 = 2.0417**, sd 1.144, mass concentrated low: P(1)=0.4213, P(2)=0.2824, …, P(6)=0.0046 — a great "the mean is not the median, quote accordingly" instance), sum-of-k-cards, product-of-RGB-counts (fat tails, per QuantVault).
- **Parameters:** `q ∈ {0.2,…,0.8}` (adverse-selection intensity), `H ∈ {10,…,N/2}` (competition tightness), size, info-reveal schedule (reveal a bound on `V`, shrink the support, force a re-quote and a tighter optimal spread). Each `(dist, q, H)` yields a unique `h*` and `E*` from the closed form. Difficulty scales with `q` and with skewed/fat-tailed distributions where the naive "quote around the mean" is wrong.

---

# PART 5 — SUMMARY, CONFIDENCE, AND SOURCE CONFLICTS

## 5.1 Verified-answer ledger (everything computed this pass)
| Archetype | Exact answer | Method | MC cross-check |
|---|---|---|---|
| Bank-or-roll base (n=20,R=100) | **E = 1773.34**, start threshold 18 | backward DP | 1773.18 (200k) ✓ |
| Mut 1 (die removed) | **E = 555.05**, threshold 6 (~$5.55/turn) | state DP | 555.23 ✓ |
| Mut 2 (casino adversary) | **value = 863.93**, equilibrium threshold 9 (~$8.64/turn) | minimax DP | 864.06 ✓ |
| Mut 3 (generalize-to-n, die-removed) | k*(20)=6 rate 5.57; k*(100)=28 rate 27.0 | closed form | matches DP ✓ |
| Anchor: two walks meet, B=(3,4) | **3273/4096 ≈ 0.7991** | 2^7×2^7 enumeration | 0.7987 (500k) ✓ |
| Walks meet generalizations | (1,1)7/8; (2,2)109/128; (2,3)203/256; (3,3)431/512 | enumeration | ✓ |
| E[flips to HH] | **6** (HT=4) | linear system / KMP automaton | 5.99 ✓ |
| Gambler's ruin (a=3,N=10) | **P=3/10, E[steps]=21** | martingale closed form | 0.2998, 21.04 ✓ |
| Min-of-3-dice fair value | **441/216 = 2.0417** | exact enumeration | — |
| Market-making P&L | closed-form E[P&L] matches MC to <0.03/round; h* rises with q | closed form + MC | ✓ |

## 5.2 Confidence self-assessment
- **High:** process shape (math gate → phone → superday), market-making-centric superday, the mutate/adversary/generalize follow-up doctrine, the flagship bank-or-roll cascade and its Mutation 1/2 answers (verified by DP+MC), the anchor answer (verified by enumeration+MC). All quantitative answers are **computed**, not cited.
- **Medium:** exact math-gate cutoff (70–85% is vendor-recycled, directional), named superday games beyond Three-Dice-Min (single primary source, QuantVault), comp figures.
- **Low / flagged:** any single-sourced specific claim; treat per-round counts and timings as directional shapes, not literal keys.

## 5.3 Source conflicts (recorded)
1. **Mental-math importance:** techinterview.org = "decisive hard gate, savant-level speed"; tradermath.org = "accuracy over speed, needn't be a savant." Reconciled: the *screen* is a speed gate; the *conversational rounds* value accuracy/clarity. Not a true contradiction once stages are separated.
2. **Mock video answer vs our computation (Mutation 2):** the mock candidate verbally guessed the casino-adversary equilibrium at "≈10–11." Our minimax DP gives the **exact equilibrium threshold = 9** (value 863.93, MC-confirmed). The video is a live, unfinished discussion; **the DP is authoritative** for the number.
3. **Mock video age:** published 2022 but still the firm's currently-linked canonical description in 2026 and consistent with every 2025–2026 first-hand account; treated as current.
4. **Superday universality:** most sources say market-making dominates the superday for traders; a minority frame it as "trader or researcher, same games" (QuantVault) vs role-specific loops elsewhere. Low-stakes discrepancy; we model the market-making-heavy version.

## 5.4 Recommended use in our mock
- Implement the **Jane Street preset** around the **Part 3 cascade** (deliver base → mutation → mutation, gating each), scoring **framework survival + narration** over the number, with the **per-turn reframe** offered as a hint.
- Use the **Part 4 verifier** as the engine for all make-a-market items across presets (parameterize `q`, `H`, distribution, reveal schedule); it deterministically scores mid accuracy, spread calibration, adverse-selection response, and inventory skew.
- Seed probability items from Archetypes B/C; every one ships with an exact verifier (DP/enumeration/automaton/closed form) so generated instances can be auto-graded.
