# Proposed NEW Brainteaser Flashcards (for review — NOT yet added to the app)

> Modeled on the 13 existing flashcards in `src/content/brainteasers/levels.ts`. Same
> `Flashcard` shape (prompt / answer / explanation, integrity-based reveal — no MC).
> Each proposal below lists a suggested difficulty, the existing card/technique it
> mirrors, and a verification note. Nothing here has been written into app source.

---

## Part 1 — What each EXISTING brainteaser teaches (core technique in one line)

1. **bt-ropes** (Burning ropes → 45 min) — *Rates / simultaneous processes*: lighting both ends doubles the burn rate, so a rope finishes in half the TIME regardless of uneven length.
2. **bt-bridge** (Bridge & torch → 17 min) — *Optimization, greedy vs optimal*: pair the two SLOWEST together so you pay for the big time only once; ferry the torch with the fastest.
3. **bt-lockers** (100 lockers → 10 open) — *Divisor parity / invariant*: a locker ends open iff it has an odd number of divisors ⇒ exactly the perfect squares.
4. **bt-switches** (3 switches, 1 bulb) — *Manufacture an extra information channel*: use heat as a third observable state (lit / off-warm / off-cold).
5. **bt-8balls** (8 balls, 1 heavy → 2 weighings) — *Ternary information per weighing*: 3 outcomes/weighing ⇒ split 3-3-2, not 4-4.
6. **bt-poison** (1000 bottles → 10 testers) — *Binary encoding / parallel yes-no tests*: each tester = one bit; dead/alive pattern spells the bottle in binary.
7. **bt-monty** (Monty Hall → switch, 2/3) — *Conditional probability / the host's informed action carries information*.
8. **bt-25horses** (25 horses, 5 lanes → 7 races) — *Tournament / partial-order pruning*: eliminate horses that provably can't place.
9. **bt-2eggs** (2 eggs, 100 floors → 14) — *Minimax / triangular numbers*: decreasing step sizes flatten the worst case; n(n+1)/2 ≥ 100.
10. **bt-12balls** (12 balls, heavy-or-light → 3) — *Information-theoretic bound (ternary)*: 24 cases, 3^3 ≥ 24 ⇒ 3 weighings, then a rotating scheme.
11. **bt-blueeyes** (Blue-eyed islanders → night 100) — *Common knowledge + induction*: the announcement makes a known fact common knowledge, seeding the induction.
12. **bt-pirates** (5 pirates, 100 coins → 98) — *Backward induction / game theory*: buy the cheapest majority relative to each rival's fallback payoff.
13. **bt-100prisoners-switch** (light switch protocol) — *Distributed counting protocol*: funnel all info through one counter via a single reliable bit.

**Distribution to mirror:** measuring/rates, optimization, invariants/parity, information/weighing/encoding (the heaviest cluster), conditional probability & EV/symmetry, tournament/partial order, minimax, common-knowledge induction, backward-induction game theory, protocols. The set is light on **pigeonhole/extremal** and **linearity-of-expectation**, so I added fresh instances of those too.

---

## Part 2 — 8 PROPOSED new brainteasers

### 1. Whiteboard Wipe · **Easy** · Invariant / parity
**Prompt.** A trader writes the integers 1 through 100 on a whiteboard. A cleanup routine repeatedly erases any two numbers `a` and `b` and writes their absolute difference `|a − b|` back on the board. It repeats until a single number is left. Can that final number be odd?

**Answer.** No — the final number is always **even**. (Its parity equals the parity of 1 + 2 + … + 100 = 5050, which is even.)

**Explanation (the aha).** Track the **parity of the sum** of all numbers on the board. Replacing `a, b` with `|a − b|` changes the sum by `a + b − |a − b|`, which is always even (since `a + b` and `|a − b|` have identical parity). So the total's parity never changes. It starts at 5050 (even) and stays even; when only one number remains, that number *is* the whole board's sum, so it must be even. You never need to know the intermediate values — the invariant decides it. (Note: had the range been 1…101, the sum 5151 is odd, so the final number would be forced odd — same technique, flipped conclusion.)

*Modeled on:* **bt-lockers** (parity/divisor invariant). *Verification:* Brute-forced random reduction orders for n=100 (always parity 0) and n=101 (always parity 1) over 2000 trials each — matches the sum-parity prediction.

---

### 2. The Round-Trip Mandate · **Easy** · Rates (harmonic-mean trap)
**Prompt.** You drive from home to the exchange at 30 mph. You want the *round trip* (there and back, same distance) to average 60 mph. How fast must you drive on the return leg?

**Answer.** **Impossible** — no finite speed works; you'd need infinite speed.

**Explanation (the aha).** Average speed is total distance ÷ total *time*, and time — not distance — is what you're implicitly weighting. Let each leg be distance `d`. A 60 mph average over `2d` requires total time `2d / 60 = d / 30`. But the outbound leg at 30 mph *already* consumes `d / 30` — the entire time budget. That leaves **zero** time for the return, i.e. infinite speed. The trap is averaging the two speeds arithmetically ((30 + x)/2 = 60 ⇒ x = 90); the correct combination is the **harmonic mean**, which is dominated by the slower leg. Same lesson bites when "averaging" returns, fill rates, or yields over unequal time/exposure.

*Modeled on:* **bt-ropes** (reasoning about rates rather than lengths). *Verification:* Algebraic — total-time budget is fully spent by the first leg; harmonic mean of {30, x} can never reach 60 for finite x since it's < 2·30 = 60 always.

---

### 3. Which Bags Are Light? · **Medium** · Single-reading weighing / binary encoding
**Prompt.** You have 5 bags of coins. A genuine coin weighs 10 g. An unknown SUBSET of the bags (possibly none, possibly all) is counterfeit — in a fake bag every coin weighs 9 g. With a **single** reading on a digital scale, identify *exactly which* bags are fake. How many coins do you draw from each bag?

**Answer.** Take **1, 2, 4, 8, 16** coins from bags 1–5. Compute the deficit `310 − (measured grams)`; written in binary, its set bits name the fake bags (bit 0 = bag 1, …, bit 4 = bag 5).

**Explanation (the aha).** Each counterfeit coin is exactly 1 g light, so bag `i` contributes a deficit of `2^(i−1)` grams **iff** it's fake. Because every integer has a unique binary representation, the summed deficit uniquely determines the subset of fake bags — all 32 possibilities map to distinct deficits (0 g … 31 g). The all-genuine weight is `(1+2+4+8+16)·10 = 310 g`. The classic single-bag version uses 1, 2, 3, 4, 5 coins, but that FAILS when *any subset* can be fake: e.g. {bag 2, bag 3} and {bag 5} both give a 5 g deficit. Powers of two are what guarantee uniqueness. This is the poisoned-bottle idea applied to a scale: the reading is read off in binary.

*Modeled on:* **bt-poison** (binary encoding) + **bt-8balls** (extract maximum info from one weighing). *Verification:* Enumerated all 32 subsets — powers-of-two deficits are all distinct; confirmed the 1..5 scheme collides (e.g. {2,3} vs {5}).

---

### 4. A Fair Coin From a Rigged One · **Medium** · Probability / symmetry
**Prompt.** Your only randomness source is a biased coin with an *unknown* probability `p` of heads (0 < p < 1). You need to settle a 50/50 tie-break fairly. How do you produce an exactly fair yes/no decision?

**Answer.** Flip the coin **twice**. Call **HT** → "yes", **TH** → "no". If you get **HH** or **TT**, discard and repeat. This gives yes/no each with probability exactly 1/2, whatever `p` is.

**Explanation (the aha).** Look for a symmetry that cancels the unknown bias. In two independent flips, `P(HT) = p(1−p)` and `P(TH) = (1−p)p` — *identical*, regardless of `p`. The mixed outcomes are equally likely; the matched outcomes (HH, TT) carry the bias, so you throw them away and re-flip. Conditioning on "the two flips differed," yes and no split 50/50 exactly. (Von Neumann's trick.) It always terminates: each round ends with probability `2p(1−p) > 0`. The principle — find a pair of outcomes the nuisance parameter treats symmetrically — is the same move behind a lot of "debias my signal" problems.

*Modeled on:* **bt-monty** (probability; extracting a clean result via the right conditioning/symmetry). *Verification:* Simulated 200k trials at p = 0.8 and p = 0.3 → fraction "yes" = 0.4987 and 0.5007.

---

### 5. New Desk Records · **Medium–Hard** · Linearity of expectation / symmetry
**Prompt.** Traders are hired one at a time. Each has a distinct, permanent skill level drawn independently from the same continuous distribution. A "new desk record" is declared whenever a newly hired trader is the best hired so far. Over 100 hires, what is the **expected number** of times a new record is set?

**Answer.** `H₁₀₀ = 1 + 1/2 + 1/3 + … + 1/100 ≈ **5.19**` records.

**Explanation (the aha).** Don't chase the joint distribution — use **linearity of expectation** plus symmetry. Let `Xₖ = 1` if the k-th hire is a record. The first `k` hires are exchangeable (i.i.d., all distinct), so each is equally likely to be the largest of that prefix; hence the k-th is the max with probability exactly `1/k`, giving `E[Xₖ] = 1/k`. Summing, `E[records] = Σₖ 1/k = H₁₀₀ ≈ 5.19`. The surprise is how *slow* records accrue: doubling the desk to 200 hires adds only ~0.7 more expected records, because `Hₙ ≈ ln n + 0.577`. Records (and, e.g., running maxima of a price series of i.i.d. shocks) grow logarithmically, not linearly.

*Modeled on:* **bt-monty** family (probability) — specifically the EV/symmetry style the lesson calls out. *Verification:* `H₁₀₀ = 5.1874`; Monte-Carlo over 40k trials of 100 hires averaged **5.1845** records.

---

### 6. Two-Thirds of the Average · **Hard** · Game theory / iterated dominance + common knowledge
**Prompt.** Ten analysts each secretly pick a real number in [0, 100]. The winner is whoever is closest to **two-thirds of the average** of all ten picks. Everyone is perfectly rational, and everyone knows everyone is rational. What number should you pick?

**Answer.** **0** — the unique equilibrium under common knowledge of rationality is everyone choosing 0.

**Explanation (the aha).** Iteratively eliminate dominated choices. The average can be at most 100, so the target `(2/3)·avg` can be at most 66.67 — any pick above 66.67 is dominated and no rational player uses one. But once *everyone* is known to pick ≤ 66.67, the target is ≤ (2/3)·66.67 ≈ 44.4, so picks above that are eliminated too. Each round of "everyone knows that everyone knows…" shaves the ceiling by a factor of 2/3, driving it toward 0. The only fixed point is everyone at 0, where the target is `(2/3)·0 = 0` and all ten tie. The subtlety (as in the blue-eyes card) is that the collapse requires *common knowledge* of rationality, not just individual rationality — with real, boundedly-rational players the winning guess is famously well above 0.

*Modeled on:* **bt-pirates** (backward-induction / game theory) with the common-knowledge engine of **bt-blueeyes**. *Verification:* Pure reasoning — iterated elimination of strictly dominated strategies has the unique Nash equilibrium at 0 (the classic Keynesian beauty-contest result); the fixed-point equation `x = (2/3)x` has only `x = 0`.

---

### 7. The Locker Room Gamble · **Expert** · Strategy / permutation-cycle protocol
**Prompt.** 100 traders are numbered 1–100. In a room are 100 closed lockers, each secretly containing one distinct trader's ID card in random order. One at a time (others isolated, no communication after start), each trader may open **at most 50** lockers, looking for their own card, then must leave the lockers exactly as found. **Every** trader must find their own card, or the whole group fails. With the best pre-agreed strategy, what is the probability of success — and what is the strategy?

**Answer.** About **31.2%** (exactly `1 − (H₁₀₀ − H₅₀) ≈ 0.3118`). Strategy: each trader **follows the cycle** — open the locker with your own number, read the card inside, go to the locker with *that* number, and repeat, up to 50 times.

**Explanation (the aha).** The lockers define a random permutation; "card `j` is in locker `i`" is an arrow `i → j`, so the trader-follows-cycle rule walks the permutation cycle that contains their own number — and their card sits at the step that *closes* that cycle back to their start. So a trader succeeds **iff the cycle containing their number has length ≤ 50**. Crucially, *all* traders succeed together iff the permutation has **no cycle longer than 50**. A random permutation of 100 has a cycle of length `L > 50` for at most one value of `L`, and the probability such a long cycle exists is `Σ_{L=51}^{100} 1/L = H₁₀₀ − H₅₀ ≈ 0.688`. Success probability is therefore `1 − 0.688 ≈ 0.312` — astonishingly high versus the ~`(1/2)^100 ≈ 0` you'd get from everyone opening 50 random lockers. Correlating everyone's search through the shared permutation structure is the whole trick.

*Modeled on:* **bt-100prisoners-switch** (a clever pre-agreed protocol turns an impossible-looking coordination task feasible) — different mechanism (cycle-following vs. counting). *Verification:* Theory `1 − (H₁₀₀ − H₅₀) = 0.3118`; simulated 20k random permutations checking "longest cycle ≤ 50" → **0.309**.

---

### 8. Fifty-One Fills · **Medium–Hard** · Pigeonhole / extremal
**Prompt.** From the integers 1 to 100, you pick any 51 distinct numbers. Prove that, no matter which 51 you choose, some one of them must **divide** another.

**Answer.** It's **always** true — among any 51 numbers from 1–100, at least one divides another.

**Explanation (the aha).** Write every integer as `2ᵏ · m` with `m` odd — its "odd core." The odd numbers in 1–100 are `1, 3, 5, …, 99`: exactly **50** of them, so there are only 50 possible odd cores. Pick 51 numbers and pigeonhole forces **two of them to share the same odd core** `m`, say `2ᵃ·m` and `2ᵇ·m` with `a < b`. Then the smaller divides the larger (their ratio is `2^{b−a}`, an integer). Done. The extremal check that 51 is tight: `{51, 52, …, 100}` is 50 numbers with none dividing another (any proper multiple of an element ≥ 51 exceeds 100), so 50 can be safe but 51 never can. The move — bucket the objects by an invariant (odd core) and count buckets — is the essence of pigeonhole.

*Modeled on:* fills the set's gap in **extremal/pigeonhole** arguments (kin to the divisor-structure reasoning in **bt-lockers**). *Verification:* Counted odd cores in 1–100 = 50 (so 51 picks collide by pigeonhole); the block {51,…,100} confirms 50 is achievable, so the bound is tight.

---

## Suggested slotting (if approved)
- **Warm-Ups (easy):** #1 Whiteboard Wipe, #2 Round-Trip Mandate.
- **Classics (medium):** #3 Which Bags Are Light?, #4 Fair Coin From a Rigged One, #5 New Desk Records, #8 Fifty-One Fills.
- **Hard (expert):** #6 Two-Thirds of the Average, #7 The Locker Room Gamble.

All eight are independently verified (see per-item notes). None reproduces an existing card; #6 and #7 are famous enough to flag for a human sanity read, though both are standard, well-established results.
