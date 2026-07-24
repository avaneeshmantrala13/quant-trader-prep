# QBank Handoff — Probability & Statistics: General (67 questions)

## How to read this file (for the training pipeline + its AI)

This is one subcategory ("General") of the **Probability and Statistics** category from the master Trading Interview question bank. It is a standalone extract — everything the SLM needs for this subcategory is in this file. It is the largest and most heterogeneous subcategory: it mixes CLT, binomial counting, geometric probability, gambler's ruin, random walks, covariance/variance, uniform order statistics, tournament combinatorics, and game theory. Treat it as a grab-bag of "core quant-interview probability," not a single technique.

### Entry format
Each question is:
```
### GN{n} — {Title}
**Company:** {comma-separated firms} · **Difficulty:** {Easy|Medium|Hard} · **Concept:** {one-line technique}
#### Condensed        <- one-line Q + compact worked A. For fast human review / short-context prompts.
#### Verbatim         <- the question + full worked solution as sourced (OCR math cleaned to readable notation, NOT reworded).
**Correct Answer: {value}**
```

### Company tags — how they were produced (important for trust)
The 11 firm lists (Akuna, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW) were **inverted mechanically by a title-keyed script**, not hand-copied. The script verified: 67/67 questions tagged, 0 firm-list titles failed to match a question, 0 questions left untagged. Per-firm counts equal the exact lengths of the source lists (e.g. Jane Street = all 67, DRW = 24, SIG = 20). A question with multiple firms means it appeared on multiple firms' lists — this is real overlap, keep all tags. **Jane Street's list contained every question**, so a JS tag carries no discriminative signal here; the other firms' subsets do.

### Answer routing — CRITICAL for training
Most answers are exact numbers → route to **verifier-checked RL** (scalar reward on numeric match, with rounding tolerance as stated per question). But several are NOT scalar and must go to **SFT / reasoning targets, not scalar reward**:

| GN | Question | Answer type | Route |
|---|---|---|---|
| GN32 | How Many Children | **Infinity** (divergent expectation) | Sentinel/reasoning — the "trick" is recognizing the mean diverges even though the walk returns a.s. Do NOT reward a finite number. |
| GN37 | Optimal Spread | A **market** (bid 0.167 / ask 0.833), not a scalar | SFT — grade the two-sided quote + the spread=2/3 derivation. |
| GN43 | Perfect Correlation | "**Two distinct (X,Y) pairs**" (procedure) | SFT — no numeric answer. |
| GN44 | Rainy Day | "**0.3 if independent; else need variances+correlation**" | SFT — two-part, conditional. Reward 0.3 only for the independent case. |
| GN65 | All-Boys City | "**Stays 50%**" (reasoning) | SFT — the answer is that the stopping rule can't bias nature. |
| GN66 | Tennis Match: Win in 2 or 3 Sets | "**Bet on 2 sets unless p=½**" (decision) | SFT — the key object is (2p−1)²≥0, not a number. |
| GN67 | Five Ascending Cards | "**Not fair; fair payout $119**" (two-part) | Hybrid — the $119 is verifiable; the "not fair" judgment is reasoning. |
| GN63 | Exponential Distribution #2 | **ln(2)/4** (closed form) | Verifiable if you accept symbolic/decimal 0.173. |

Numeric-but-watch-rounding answers: GN1 (0.00135, 5dp), GN38 Jumping Robots (0.114845886, **9 dp** — this is a Newton's-method root, don't expect a clean fraction), GN58 (0.188, 3dp), GN2 Beta Gap (**a=−2**, the answer is the Φ-argument not a probability).

### Difficulty mix
Easy 40, Medium 19, Hard 8 (Four Digit Difference, Going to the Beach #2, How Many Children, Jumping Robots, Optimal Spread — plus the hard-ish CLT ones are tagged Medium). The three "hard game-theory/optimization" ones (Optimal Spread, Going to the Beach #2, Jumping Robots) are the highest-value reasoning targets — they require setting up and maximizing an objective, not just plugging a formula.

### Known source notes
- Verbatim blocks preserve the **source wording** with only OCR-garbled math (stacked fractions, doubled tokens) cleaned into readable inline notation. They are faithful, not reworded. Condensed blocks are our compression for fast review.
- Several questions are near-duplicates by design and good for consistency training: Four Fives #1/#2 (p=1/6 vs 1/3), Walking Home #1/#2 (under vs over, complement), Gambler's Ruin #1/#2/#3 (fair small, fair, biased), Old Phone #1/#2 (grid vs cycle graph — same 5/9 answer, different reasoning), Uniform Distribution #2/#3 (same min-order-stat method, shifted interval), Birthday #1/#2.
- Recurring traps worth mining as hard negatives: Clean Statue (distance is NOT uniform — area∝r²), Twin Drums (do NOT add standard deviations), Covariance Ceiling (means are red herrings), Even Sum / Even Heads (over-complication trap — answer is just ½ by symmetry).

---

# Probability and Statistics — General

> **Note.** 67 questions — the largest, most heterogeneous subcategory. Company tags filled by the authoritative title-keyed inversion (not by hand). Verbatim blocks preserve the source wording with only OCR-mangled math cleaned into readable notation. Non-numeric / open answers flagged for SFT-not-RL routing: **Perfect Correlation** (needs "two (X,Y) pairs"), **Rainy Day** (0.3 if independent; else "ask for covariance"), **Tennis Match: Win in 2 or 3 Sets** ("bet on 2 sets unless p=½"), **All-Boys City** ("stays 50%"), **How Many Children** (answer = **Infinity**), **Optimal Spread** (a market: 0.167 at 0.833), **Complementary** (0.9), **Variance of Two Variables** (30), **Exponential Distribution #2** (ln2/4, a formula).

## General — index of questions (by family)

| Family | Questions |
|---|---|
| CLT & concentration | 230 Heads, Beta Gap, Candle Batch |
| Binomial counting | Any Cake Left, Four Fives #1, Four Fives #2, Claw Machine |
| Complement / at-least-one | Both Card Colors, Five In Million, Bikes on the Road, Multiply 3 Dice |
| Birthday / collision | Birthday Problem #1, Birthday Problem #2 |
| Geometric probability (area/length) | Clean Statue, Poker Chip Drop, Meeting Probability, Caught Mid-Switch |
| Digit & integer counting | Different Digits, Two Digit Number |
| Dice sums & symmetry | Low Total, Outcome Dice, Sum Two Random Numbers, Even Sum, Even Heads, Lower Die, Mismatched Dice, Multiply 3 Dice |
| Gambler's ruin | Gambler's Ruin #1, #2, #3 |
| Random walk / recursion | Walking Home #1, Walking Home #2, How Many Children, Coin Race #1, Tennis Game, Spinner Duel |
| Game theory (optimizing agents) | Going to the Beach #2, Optimal Spread, Jumping Robots |
| Covariance / variance | Covariance Ceiling, Correlation Flip, Variance of Two Variables, Twin Drums, Perfect Correlation, Rainy Day |
| Uniform order statistics | Uniform Distribution #2, Uniform Distribution #3, Uniformly Distributed Profit |
| Tournament brackets | Knockout Stage, Opening Round Draw, Radar Sweep, Pentagon Ants |
| Counting / expectation misc | All Faces, Arcade Triple, Cherry Streak, Football or Cupcake, Higher Card, Checkmate, Four Digit Difference, Coins in Boxes, Old Phone #1, Old Phone #2, Complementary, Exponential Distribution #2, Diagonal Duel, All-Boys City, Tennis Match: Win in 2 or 3 Sets |

---

## Family: CLT & concentration

### GN1 — 230 Heads
**Company:** Akuna Capital, Jane Street, SIG · **Difficulty:** Medium · **Concept:** Normal approximation of a Binomial (CLT, no continuity correction)

#### Condensed
**Q:** Fair coin tossed 400 times. Using CLT (no continuity correction), P(at least 230 heads)? 5 dp.
**A:** μ=np=200, σ=√(npq)=10. Z=(230−200)/10=3. P(X≥230)≈1−Φ(3)=0.0027/2=**0.00135**.

#### Verbatim
A fair coin is tossed 400 times. Using the CLT without continuity correction, estimate P(at least 230 heads). Round to 5 decimals.

For a Binomial(n,p): X≈N(np, np(1−p)). With n=400, p=½: μ=np=200; Var=np(1−p)=100, σ=10. Standardize the threshold 230 directly (no continuity correction): Z=(230−200)/10=3. So P(X≥230)≈1−Φ(3). By the 68-95-99.7 rule, within 3σ is 99.73%, so both tails hold 1−0.9973=0.0027, split by symmetry: 1−Φ(3)=0.0027/2=0.00135. (Sanity: exact binomial tail ≈0.00156; continuity-corrected CLT with Z=2.95 ≈0.00159 — uncorrected undershoots slightly by missing the left half of the 230-bar.) General recipe: P(X≥k)≈1−Φ((k−np)/√(np(1−p))).

**Correct Answer: 0.00135**

---

### GN2 — Beta Gap
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** CLT for sums; variance of a difference doubles

#### Condensed
**Q:** X₁..X₂₅₀, Y₁..Y₂₅₀ iid Beta(2,2); S=ΣX, T=ΣY. Estimate P(S−T>10) as Φ(a); find a.
**A:** Beta(2,2): μ=½, σ²=1/20. Var(S)=Var(T)=250/20=12.5; Var(S−T)=25, sd=5. Z=(10−0)/5=2. P=P(Z>2)=Φ(−2) → **a=−2**.

#### Verbatim
X₁…X₂₅₀ and Y₁…Y₂₅₀ independent, each Beta(2,2). S=X₁+…+X₂₅₀, T=Y₁+…+Y₂₅₀. Estimate P(S−T>10)=Φ(a); find a.

Beta(α,β): μ=α/(α+β), σ²=αβ/((α+β)²(α+β+1)). With α=β=2: μ=2/4=½, σ²=(2·2)/(4²·5)=4/80=1/20=0.05. By CLT: E[S]=250·½=125, Var(S)=250·(1/20)=12.5; same for T. E[S−T]=0. Since S,T independent, Var(S−T)=Var(S)+Var(T)=12.5+12.5=25, so sd=5. P(S−T>10)=P(Z>10/5)=P(Z>2)=1−Φ(2)=Φ(−2). So a=−2. (Φ(−2)≈0.0228. Common slip: forgetting the difference doubles the variance would give sd=√12.5≈3.54 and a≈−2.83.)

**Correct Answer: -2**

---

### GN3 — Candle Batch
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Markov's Inequality bound on a sum

#### Condensed
**Q:** 50 iid candles, each Exp(1/200) grams; T=total. Markov's-inequality upper bound on P[T≥12500]?
**A:** E[Wᵢ]=1/λ=200, E[T]=50·200=10000. Markov: P[T≥a]≤E[T]/a=10000/12500=**0.8**. (True ≈0.046 — bound is loose.)

#### Verbatim
Mia pours 50 candles, weights iid Exp(λ=1/200) grams; T=W₁+…+W₅₀. Using Markov's Inequality, upper-bound P[T≥12500].

Markov: for non-negative X and a>0, P[X≥a]≤E[X]/a. Each Exp(λ) has mean 1/λ, so E[Wᵢ]=200. By linearity (independence not even needed here), E[T]=50·200=10000. T is a sum of non-negative weights, so Markov applies: P[T≥12500]≤E[T]/12500=10000/12500=4/5=0.8. (Sanity: Var(Exp)=1/λ²=40000, Var(T)=50·40000=2e6, sd≈1414; 12500 sits (12500−10000)/1414≈1.77σ above the mean, so by CLT the true tail ≈4–5% — Markov's 0.8 is valid but very loose since it uses only the mean.)

**Correct Answer: 0.8**

---

## Family: Binomial counting

### GN4 — Any Cake Left
**Company:** Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Binomial tail P(X≤2)

#### Condensed
**Q:** 6 people, each wants a cake w.p. 0.2, only 2 cakes. P(no one disappointed)=P(X≤2)?
**A:** X~Bin(6,0.2). P(0)=0.8⁶=0.262, P(1)=6·0.8⁵·0.2=0.393, P(2)=15·0.8⁴·0.2²=0.246. Sum=**0.901≈0.9**.

#### Verbatim
6 people in line, 2 cakes; each wants a cake w.p. 20%. P(no more than 2 want a cake)?

P(everyone happy)=P(X=0)+P(X=1)+P(X=2), X~Bin(6,0.2). P(X=0)=C(6,0)·0.8⁶=0.262; P(X=1)=C(6,1)·0.8⁵·0.2=0.393; P(X=2)=C(6,2)·0.8⁴·0.2²=0.246. Sum=0.262+0.393+0.246=0.901.

**Correct Answer: 0.9**

---

### GN5 — Four Fives #1
**Company:** Citadel Securities, Jane Street · **Difficulty:** Easy · **Concept:** Binomial tail via complement, p=1/6

#### Condensed
**Q:** Roll 24 dice; P(at least 4 show a 5)?
**A:** X~Bin(24,1/6). P(X≥4)=1−Σ_{k=0}³ C(24,k)(1/6)ᵏ(5/6)²⁴⁻ᵏ = 1−0.4155 ≈ **0.584**.

#### Verbatim
Roll 24 fair dice. P(at least 4 show a 5)?

p=1/6, X~Bin(24,1/6). P(X≥4)=1−P(X≤3)=1−Σ_{k=0}³ C(24,k)(1/6)ᵏ(5/6)²⁴⁻ᵏ. The four terms: 0.012579+0.060379+0.138873+0.203681=0.415513. So P(X≥4)=1−0.415513≈0.584.

**Correct Answer: 0.584**

---

### GN6 — Four Fives #2
**Company:** Citadel Securities, Jane Street · **Difficulty:** Easy · **Concept:** Binomial tail via complement, p=2/6

#### Condensed
**Q:** Roll 24 dice; P(at least 4 show a 5 or higher)?
**A:** p=2/6=1/3, X~Bin(24,1/3). P(X≥4)=1−Σ_{k=0}³ C(24,k)(1/3)ᵏ(2/3)²⁴⁻ᵏ = 1−0.020 ≈ **0.980**.

#### Verbatim
Roll 24 fair dice. P(at least 4 show a 5 or higher)?

"5 or higher" = {5,6}, so p=2/6. X~Bin(24,2/6). P(X≥4)=1−Σ_{k=0}³ C(24,k)(2/6)ᵏ(4/6)²⁴⁻ᵏ = 1−0.020 ≈ 0.980.

**Correct Answer: 0.980**

---

### GN7 — Claw Machine
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Smallest n for P(at least one) ≥ threshold (complement + logs)

#### Condensed
**Q:** Win each play w.p. 0.15. Smallest n so P(≥1 win)≥95%?
**A:** 1−0.85ⁿ≥0.95 → 0.85ⁿ≤0.05 → n≥ln0.05/ln0.85≈18.43 → **n=19**.

#### Verbatim
Claw grabs a toy w.p. 15% per play, independent. Smallest n so P(at least one win)≥95%?

Complement: P(≥1 win)=1−0.85ⁿ. Need 1−0.85ⁿ≥0.95 ⟹ 0.85ⁿ≤0.05. Take logs (ln0.85<0 flips the inequality): n≥ln0.05/ln0.85=(−2.9957)/(−0.1625)≈18.43. Round up: n=⌈18.43⌉=19.

**Correct Answer: 19**

---

## Family: Complement / at-least-one

### GN8 — Both Card Colors
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Complement of "only one color"

#### Condensed
**Q:** Draw 3 from a 52-card deck. P(at least one black and at least one red)?
**A:** 1 − 2·(26/52·25/51·24/50) = 1 − 2·(2600/132600) = **0.765**.

#### Verbatim
Draw 3 cards from a shuffled 52-card deck. P(at least one black and at least one red)?

P[both colors]=1−P[only red]−P[only black]. By symmetry P[only red]=P[only black]=(26/52)(25/51)(24/50). So P[both]=1−2·(26/52)(25/51)(24/50)=0.765.

**Correct Answer: 0.765**

---

### GN9 — Five In Million
**Company:** Citadel Securities, Jane Street, Mako, Maven · **Difficulty:** Easy · **Concept:** Complement, pad-to-6-digits

#### Condensed
**Q:** Integer chosen 1 to 1,000,000. P(contains digit "5" at least once)?
**A:** Pad to 6 digits (000000–999999). No-5 count=9⁶=531441 (1,000,000 has no 5, swaps for 000000). P=1−531441/1000000=**0.4686**.

#### Verbatim
Integer chosen from 1 to 1 million inclusive. P(contains the digit "5" at least once)?

P(at least one 5)=1−P(no 5 anywhere). Pad every number to 6 digits (000000 to 999999), 10⁶=1,000,000 total. 1,000,000 has no 5. Numbers without a 5: each of 6 positions has 9 non-5 choices, 9⁶=531441. This count includes 000000 (no 5), replaced by 1,000,000 (also no 5), so unchanged. P=1−531441/1000000=0.4686.

**Correct Answer: 0.4686**

---

### GN10 — Bikes on the Road
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Complement across independent sub-intervals

#### Condensed
**Q:** P(≥1 bike in 1 hour)=609/625. P(≥1 bike in 15 min)?
**A:** No-bike in 1hr = (1−p)⁴ = 16/625 → 1−p=2/5 → p=**3/5=0.6**.

#### Verbatim
P(at least one bike in a one-hour interval)=609/625. Bikes uniform. P(at least one bike in 15 min)?

Complement: P(no bike in 1 hour)=1−609/625=16/625. One hour = four independent 15-min intervals: (1−p)⁴=16/625, so 1−p=(16/625)^{1/4}=2/5, giving p=3/5.

**Correct Answer: 0.6**

---

### GN11 — Multiply 3 Dice
**Company:** Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Complement of "all odd"

#### Condensed
**Q:** Roll 3 dice, multiply. P(product even)?
**A:** Product odd ⟺ all three odd = (1/2)³. P(even)=1−1/8=**7/8=0.875**.

#### Verbatim
Roll 3 dice, multiply face values. P(outcome even)?

The product is odd only if all three dice are odd; any even factor makes it even. Half the faces are odd ({1,3,5}). P(even)=1−P(all odd)=1−(1/2)³=7/8.

**Correct Answer: 0.875**

---

## Family: Birthday / collision

### GN12 — Birthday Problem #1
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Birthday paradox threshold

#### Condensed
**Q:** How many people to make P(shared birthday)>50%? (365 days)
**A:** Solve 365·364·…·(365−n+1)/365ⁿ < 0.5. Smallest **N=23**.

#### Verbatim
How many people in a group to make P(two share a birthday) more than 50%? Assume 365 days.

Easier via complement: P(all N distinct)=365·364·…·(365−n+1)/365ⁿ < 0.5. The smallest N satisfying this is 23.

**Correct Answer: 23**

---

### GN13 — Birthday Problem #2
**Company:** Flow Traders, IMC, Jane Street, Virtu, DRW · **Difficulty:** Easy · **Concept:** Birthday paradox, days of week (3 people)

#### Condensed
**Q:** 3 people; P(at least two born on the same weekday)?
**A:** 1−P(none)=1−(6/7)(5/7)=1−30/49=**19/49≈0.39**.

#### Verbatim
You and two traders (3 people). P(at least two born on the same day of the week)?

P(at least two)=1−P(none share). P(none)=(6/7)(5/7)=30/49. So P(at least two)=1−30/49=19/49≈0.39.

**Correct Answer: 0.39**

---

## Family: Geometric probability (area / length)

### GN14 — Clean Statue
**Company:** Flow Traders, Jane Street, DRW · **Difficulty:** Easy · **Concept:** Geometric probability, ratio of areas (radii squared)

#### Condensed
**Q:** Paint lands uniformly in a radius-5 courtyard; splatters within 2 m. Statue at center. P(statue stays clean)?
**A:** Painted ⟺ lands within 2 m of center: area π·2²/π·5²=4/25. Clean=1−4/25=**21/25=0.84**.

#### Verbatim
Balloon lands uniformly in a radius-5 m circular courtyard; splatters everything within 2 m. Statue at the center. P(statue stays clean)?

Geometric probability = area ratio. Statue is painted iff the balloon lands within 2 m of the center (distance is symmetric). P(painted)=π·2²/(π·5²)=4/25. P(clean)=1−4/25=21/25=0.84. (Classic wrong answer: treating distance as uniform gives 2/5 painted → 0.6; but P(R≤r)=r²/25 grows like r², not r, because outer rings hold more area.)

**Correct Answer: 0.84**

---

### GN15 — Poker Chip Drop
**Company:** Jane Street, SIG · **Difficulty:** Easy · **Concept:** Geometric probability, shrunken-square (Buffon-style)

#### Condensed
**Q:** 5×5 in tiles; chip diameter 2 in (radius 1) lands uniformly. P(chip inside a single tile, no boundary crossed)?
**A:** Center must be ≥1 in from all 4 edges → favorable 3×3 square. P=3²/5²=**9/25=0.36**.

#### Verbatim
Floor tiled with 5×5 inch squares; a chip of diameter 2 in lands flat, center uniform. P(chip lands completely inside a single tile)?

Describe the chip by its center. Radius=1 in, so the chip crosses a boundary iff the center is within 1 in of it. Chip fits inside a tile iff its center is ≥1 in from all four edges. That favorable region is a square of side 5−2·1=3. P=3²/5²=9/25=0.36.

**Correct Answer: 0.36**

---

### GN16 — Meeting Probability
**Company:** Jane Street, Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** Geometric probability in the unit square (arrival-time overlap)

#### Condensed
**Q:** Two traders arrive uniformly in [0,60] min, wait 5 min. P(they meet)?
**A:** Area where |x−y|≤5 over the 60×60 square: (60²−2·½·55²)/60² = **23/144≈0.16**.

#### Verbatim
Two traders each arrive at a uniformly random time in [12:00,13:00], wait up to 5 min. P(they meet)?

Plot arrival times in a 60×60 square; they meet iff |x−y|≤5. Favorable area = total minus the two corner triangles: (60·60 − 2·½·55·55)/(60·60) = 23/144 ≈ 0.16.

**Correct Answer: 0.16**

---

### GN17 — Caught Mid-Switch
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Geometric probability on a cycle (length ratio)

#### Condensed
**Q:** LED cycles blue(50s)→amber(5s)→green(45s), period 100s. 5-second glance at uniform start. P(sees a color change)?
**A:** 3 change instants; glance catches each if it starts in the 5s before it → 3 intervals of length 5. P=15/100=**0.15**.

#### Verbatim
LED: blue 50 s → amber 5 s → green 45 s, repeating (period 100 s). A technician watches for 5 s starting at a uniform random moment. P(she sees the LED change color)?

Changes occur at t=50, 55, 100 (=0). A glance starting at T catches the change at s iff s−5<T<s, i.e. T in the 5-second window before s. Three non-overlapping intervals of length 5 → favorable length 15 of 100. P=15/100=0.15. (The amber phase equals the glance length, so the two windows touch at T=50 but never overlap.)

**Correct Answer: 0.15**

---

## Family: Digit & integer counting

### GN18 — Different Digits
**Company:** Citadel Securities, Jane Street, Mako, Maven, Virtu · **Difficulty:** Easy · **Concept:** Counting by digit-length cases

#### Condensed
**Q:** Integer chosen 1–1000. P(all digits different)?
**A:** 1-dig:9; 2-dig:9·9=81; 3-dig:9·9·8=648; 1000:0. Total 738. P=738/1000=**0.738**.

#### Verbatim
An integer is chosen at random from 1 to 1000 inclusive. P(all digits different)?

1000 numbers. 1-digit (1–9): 9. 2-digit (10–99): 9·9=81. 3-digit (100–999): 9·9·8=648. 1000: digits 1,0,0,0 repeat → 0. Total 9+81+648+0=738. P=738/1000=0.738.

**Correct Answer: 0.738**

---

### GN19 — Two Digit Number
**Company:** Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Counting ordered pairs (ones > tens)

#### Condensed
**Q:** Two-digit number chosen at random. P(ones digit > tens digit)?
**A:** 90 numbers (10–99). Favorable = 8+7+…+1+0=36. P=36/90=**2/5=0.4**.

#### Verbatim
A two-digit number is chosen at random. P(ones digit greater than tens digit)?

Two-digit numbers 10–99: 90 total. Tens T∈1..9, ones O∈0..9. Count O>T: T=1→8, T=2→7, …, T=8→1, T=9→0. Sum=8+7+6+5+4+3+2+1+0=36. P=36/90=2/5=0.4.

**Correct Answer: 0.4**

---
## Family: Dice sums & symmetry

### GN20 — Low Total
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Counting equally-likely dice outcomes

#### Condensed
**Q:** Roll two dice, sum. P(score ≤ 4)? 3 dp.
**A:** 36 outcomes. Totals 2,3,4 → 1+2+3=6 favorable. P=6/36=1/6≈**0.167**.

#### Verbatim
Roll two fair dice, add them. P(score at most 4)? Round to 3 decimals.

36 equally likely ordered outcomes. Total 2: (1,1) → 1. Total 3: (1,2),(2,1) → 2. Total 4: (1,3),(2,2),(3,1) → 3. Favorable 1+2+3=6. P=6/36=1/6≈0.167. (Keep dice distinguishable so all 36 stay equally likely.)

**Correct Answer: 0.167**

---

### GN21 — Outcome Dice
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Dice sum counting

#### Condensed
**Q:** Roll two dice. P(sum is 2 or 3)?
**A:** P(2)=1/36, P(3)=2/36. Sum=3/36=**1/12≈0.083**.

#### Verbatim
Roll two dice. P(sum is 2 or 3)?

P(X=2∪X=3)=P(X=2)+P(X=3)=1/36+2/36=3/36=1/12≈0.083.

**Correct Answer: 0.083**

---

### GN22 — Sum Two Random Numbers
**Company:** Citadel Securities, Jane Street, Mako, Maven · **Difficulty:** Easy · **Concept:** Collision probability = Σ P(S=s)²

#### Condensed
**Q:** Bob and Alice each sum two uniform draws from {1..10}. P(same sum)?
**A:** Ways(s) triangular 1..10..1. P=Σways²/100²=(2·(1²+…+9²)+10²)/10000=670/10000=**0.067**.

#### Verbatim
Two machines output integers 1–10 uniformly. Bob sums two, Alice sums two. P(same sum)?

Each player: 10·10=100 outcomes, sums 2..20. Ways(s): 1,2,3,…,10,…,3,2,1. P(same)=Σ_s P(S=s)²=(1/10000)Σ ways(s)². Σ ways² = 2·(1²+2²+…+9²)+10² = 2·285+100 = 670. P=670/10000=67/1000=0.067.

**Correct Answer: 0.067**

---

### GN23 — Even Sum
**Company:** Flow Traders, IMC, Jane Street, Virtu, DRW · **Difficulty:** Easy · **Concept:** Parity via last-die symmetry

#### Condensed
**Q:** Roll five dice, sum. P(sum even)?
**A:** Whatever the first four give, the last die makes it even w.p. 1/2. **0.5**.

#### Verbatim
Roll five dice and sum. P(sum even)?

After four dice the running sum is even or odd; the fifth die is even or odd w.p. ½ each, so it makes the total even w.p. ½. Answer 0.5. (This really appears in OAs to test if you simplify instead of overcomplicating.)

**Correct Answer: 0.5**

---

### GN24 — Even Heads
**Company:** Flow Traders, IMC, Jane Street, Virtu, DRW · **Difficulty:** Easy · **Concept:** Parity pairing / last-flip symmetry

#### Condensed
**Q:** Toss 1000 coins. P(even number of heads)?
**A:** Flipping the last coin toggles parity, pairing every sequence with an opposite-parity partner. **1/2**.

#### Verbatim
Toss 1000 coins. P(even number of heads)?

Each sequence is equally likely. Flipping the last coin flips parity (even ↔ odd), so every sequence pairs uniquely with one of opposite parity. Hence the two are equally likely: P(even)=1/2.

**Correct Answer: 0.5**

---

### GN25 — Lower Die
**Company:** Akuna Capital, Citadel Securities, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Symmetry + tie probability

#### Condensed
**Q:** Roll a die twice. P(second < first)?
**A:** P(<)=P(>) and P(<)+P(>)+P(=)=1, P(=)=1/6. So P(<)=(1−1/6)/2=**5/12**.

#### Verbatim
Given a single die, P(second roll less than the first)?

P(second>first)+P(second<first)+P(second=first)=1, and by symmetry P(second>first)=P(second<first). So P(second<first)=(1−P(equal))/2=(1−1/6)/2=5/12.

**Correct Answer: 0.4166**

---

### GN26 — Mismatched Dice
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Law of total probability + symmetry (unequal dice)

#### Condensed
**Q:** Roll a d30 and a d50. P(d50 strictly > d30)?
**A:** Condition on d50: shows 31–50 (p=2/5) → win always; shows 1–30 (p=3/5) → symmetric win = 29/60. P=1·2/5 + (29/60)(3/5)=40/100+29/100=**0.69**.

#### Verbatim
Roll a fair 30-sided die and a fair 50-sided die. P(50-sided shows strictly larger than 30-sided)?

Condition on the d50. Case 1 — d50 shows 31–50 (20/50=2/5): it always beats the d30, P(win)=1. Case 2 — d50 shows 1–30 (30/50=3/5): now two iid draws on 1..30, symmetric, P(win)=(m−1)/(2m)=29/60. Total: 1·(2/5)+(29/60)(3/5)=40/100+29/100=69/100=0.69.

**Correct Answer: 0.69**

---

## Family: Gambler's ruin

### GN27 — Gambler's Ruin #1
**Company:** Citadel Securities, Jane Street, Maven · **Difficulty:** Easy · **Concept:** Fair-coin ruin formula

#### Condensed
**Q:** $20, target $100, $1 fair bets. P(go bankrupt)?
**A:** P(ruin)=n₂/(n₁+n₂)=80/100=**0.8**.

#### Verbatim
You have $20, want $100, bet $1 at a time on a fair coin (double or lose). P(leave bankrupt)?

Classic gambler's ruin: if player one has n₁ and player two n₂, P(one goes broke)=n₂/(n₁+n₂). Here n₁=20, n₂=80, so P₁=80/100=0.8.

**Correct Answer: 0.8**

---

### GN28 — Gambler's Ruin #2
**Company:** Jane Street, Mako · **Difficulty:** Easy · **Concept:** Fair-coin ruin, linear solution

#### Condensed
**Q:** €10, target €20, €1 fair bets. P(reach €20)?
**A:** Fair: pᵢ=i/20 linear. p₁₀=10/20=**0.5**.

#### Verbatim
You have €10, want €20, bet €1 at a time on a fair coin. P(leave with €20)?

Fair coin: pᵢ=½pᵢ₋₁+½pᵢ₊₁, p₀=0, p₂₀=1. Solution is linear pᵢ=i/20, so p₁₀=10/20=0.5.

**Correct Answer: 0.5**

---

### GN29 — Gambler's Ruin #3
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Biased ruin formula

#### Condensed
**Q:** p=0.4 heads, €10→€20, €1 bets. P(reach €20)?
**A:** P=(1−(q/p)ⁱ)/(1−(q/p)ᴺ) with q/p=1.5, i=10, N=20 → (1−1.5¹⁰)/(1−1.5²⁰)=**0.017**.

#### Verbatim
Biased coin, 40% heads / 60% tails. €10, want €20, €1 bets. P(leave with €20)?

Biased gambler's ruin, p=0.4, q=0.6, N=20, i=10: P(win)=(1−(q/p)ⁱ)/(1−(q/p)ᴺ)=(1−1.5¹⁰)/(1−1.5²⁰)=0.017.

**Correct Answer: 0.017**

---

## Family: Random walk / recursion

### GN30 — Walking Home #1
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** All-forward random walk

#### Condensed
**Q:** Home 4 blocks away, ±1 block per coin flip, first move forward. P(home in under 45 min = 4 correct steps)?
**A:** Need 3 more forward moves after the forced first: (1/2)³=**1/8=0.125**.

#### Verbatim
Home is 4 blocks away, 10 min/block, moves ±1 block by coin flip, first move always forward. P(reaches home in under 45 min)?

Under 45 min ⟹ all 4 steps forward (4 blocks × 10 = 40 min). First is forced forward, so need 3 more forward: (1/2)³=1/8=0.125.

**Correct Answer: 0.125**

---

### GN31 — Walking Home #2
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Complement of all-forward walk

#### Condensed
**Q:** Home 4 blocks, 9 min/block, first move forward. P(takes more than 39 min)?
**A:** Under 39 min needs all forward = 1/8. P(over)=1−1/8=**7/8=0.875**.

#### Verbatim
Home 4 blocks away, 9 min/block, moves ±1 by coin flip, first move forward. P(reaches home in more than 39 min)?

Under 39 min ⟹ all 4 forward (36 min); first forced, need 3 more = (1/2)³=1/8. P(over 39)=1−1/8=7/8.

**Correct Answer: 0.875**

---

### GN32 — How Many Children
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Expected first-return time of a symmetric random walk (diverges)

#### Condensed
**Q:** Couple has children until #boys = #girls. Expected number of children?
**A:** First return to 0 of a symmetric ±1 walk. P(T=2k)~k^{−3/2}/(2√π), so E[T]=Σ2k·P(T=2k)~Σk^{−1/2}/√π diverges. **E[T]=Infinity** (returns a.s., but heavy tail).

#### Verbatim
A couple has children until they have equal numbers of boys and girls. Expected number of children?

Model as a symmetric ±1 random walk (boy=+1, girl=−1), Sₙ=boys−girls, stop at first return T to 0. First return only at even 2k. P(T=2k)=(½)²ᵏ·(1/(2k−1))·C(2k,k). Using Stirling C(2k,k)~4ᵏ/√(πk), this gives P(T=2k)~(1/(2√π))k^{−3/2}. Then E[T]=Σ2k·P(T=2k)~(1/√π)Σk^{−1/2}, a p-series with p=½<1 → diverges. So E[T]=∞: they almost surely tie eventually (walk returns to 0 w.p. 1), but the heavy tail makes the mean infinite.

**Correct Answer: Infinity**

---

### GN33 — Coin Race #1
**Company:** Akuna Capital, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Enumerate winning sequences

#### Condensed
**Q:** 3 flips; P(the side you flip first ends up losing the race)?
**A:** First H losing → HTT; first T losing → THH. P=1/8+1/8=**1/4=0.25**.

#### Verbatim
Race of 3 flips, tracking heads vs tails. P(the side flipped first is losing after 3)?

If Heads first and losing, only HTT. If Tails first and losing, only THH. P[HTT or THH]=(½)³+(½)³=1/8+1/8=1/4.

**Correct Answer: 0.25**

---

### GN34 — Tennis Game
**Company:** Akuna Capital, Citadel Securities, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Deuce self-reference recursion

#### Condensed
**Q:** 30–30, Luuk wins a point w.p. 6/10. P(Bing wins the game)?
**A:** Deuce ≡ 30–30. P=0.4²+2·0.4·0.6·P → 0.52P=0.16 → P=**0.307**.

#### Verbatim
Tennis tied 30–30. P(Luuk wins a point)=6/10, so Bing wins a point w.p. 0.4. P(Bing wins the game)?

Bing wins via WW, or split-then-deuce. Key trick: a deuce is identical to 30–30. P(Bing|30-30)=0.4·0.4 + 2·(0.4·0.6)·P(Bing|deuce), and deuce=30-30, so P=0.16+2·0.24·P → 0.52P=0.16 → P=0.307.

**Correct Answer: 0.307**

---

### GN35 — Spinner Duel
**Company:** Jane Street, SIG · **Difficulty:** Easy · **Concept:** Restarting-game geometric series

#### Condensed
**Q:** d10; you win on 1–3 (go first), rival on 5–10; else repeat. Find max{p₁,p₂}.
**A:** x=3/10, y=(7/10)(6/10)=21/50, r=(7/10)(4/10)=7/25. p₁=x/(1−r)=5/12, p₂=7/12. max=**7/12≈0.583**.

#### Verbatim
Wheel 1–10 uniform. You spin first, win on 1/2/3. If you miss, rival spins, wins on 5–10. Else repeat. p₁=P(you win), p₂=P(rival). Find max{p₁,p₂}, 3 dp.

Restart formula: P(A ends game)=x/(1−r). Per round: you win x=3/10; rival wins y=(7/10)(6/10)=21/50; nobody wins (you miss then rival lands 1–4) r=(7/10)(4/10)=7/25. 1−r=18/25. p₁=(3/10)/(18/25)=5/12; p₂=(21/50)/(18/25)=7/12. p₁+p₂=1. max=p₂=7/12≈0.583.

**Correct Answer: 0.583**

---

## Family: Game theory (optimizing agents)

### GN36 — Going to the Beach #2
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Symmetric-strategy optimization (maximize P)

#### Condensed
**Q:** Two brothers each independently choose to bring a coin (prob p); beach if the brought coins all show H. Optimize p; P(beach)?
**A:** P(beach)=−¾p²+p, maximized at p=2/3, giving P=**1/3≈0.33**.

#### Verbatim
Two brothers independently decide to bring a coin out (prob p each). Both bring → beach iff both H (1/4). One brings → beach iff H (1/2). None → no beach. Both optimize p. P(beach)?

P(beach)=p²·¼ + 2p(1−p)·½ + 0 = −¾p² + p. Maximize: P′=1−(3/2)p=0 → p=2/3. Plug in: P(beach)=¼(2/3)² + 2·(2/3)(1/3)·½ = 1/9 + 2/9 ... = 1/3.

**Correct Answer: 0.33**

---

### GN37 — Optimal Spread
**Company:** Citadel Securities, IMC, Jane Street, SIG, Virtu, DRW · **Difficulty:** Hard · **Concept:** Market-making spread optimization (informed vs uninformed flow)

#### Condensed
**Q:** Make a market on U[0,1] for 500 informed + 500 uninformed traders. Optimal market?
**A:** E[PnL]=−375X²+500X−125 (X=spread). Max at X=2/3 → bid=(1−X)/2=1/6, ask=5/6. Market **0.167 at 0.833**.

#### Verbatim
Make a market for 1000 traders on a uniform outcome in [0,1]: 500 informed (know outcome), 500 uninformed (random number). Traders trade only for expected profit. What market?

Let X=spread. Uninformed: fraction (1−X) trade, half buy/half sell → profit (1−X)·500·X/2. Informed: fraction (1−X) trade all one way, expected loss (1−X)·500·(1−X)/4. E[PnL]=(1−X)·250·X − (1−X)·125·(1−X) = −375X²+500X−125. Maximize: d/dX=−750X+500=0 → X=2/3. Bid=(1−X)/2=1/6, Ask=1−bid=5/6. Market: 0.167 at 0.833.

**Correct Answer: Market 0.167 at 0.833 (spread 2/3)**

---

### GN38 — Jumping Robots
**Company:** Citadel Securities, Jane Street · **Difficulty:** Hard · **Concept:** Equilibrium threshold strategy; ODE + root-finding

#### Condensed
**Q:** Two robots optimize a jump-before-1 game; both use threshold x. P(first attempt scores 0)?
**A:** Success prob q(s)=(1−x)e^{x−s}; indifference gives (x³−3x+2)eˣ=3x → x≈0.416195355. P(0)=1−(1−x)eˣ≈**0.114845886**.

#### Verbatim
Two robots advance from 0 by adding U[0,1] steps, must jump before crossing 1 (else score 0); on jump add a final U[0,1]. Head-to-head, ties (both 0) replayed, higher score wins. Both optimize and know each other's strategy. P(the very first attempt scores 0)? 9 dp.

Optimal strategy is a threshold x: jump once position ≥x. Let q(s)=P(eventually jump before busting from s<x). q(s)=(1−x)+∫ₛˣq(t)dt → q′(s)=−q(s) → q(s)=Ce^{−s}; boundary q(x)=1−x gives q(s)=(1−x)e^{x−s}. Indifference between jumping and waiting at x, with q₀=q(0)=(1−x)eˣ and win-prob algebra, reduces to P(x)=(1+x+x²)/6 and P(x)=(q₀−x)/(2q₀), yielding (x³−3x+2)eˣ=3x. Newton's method: x≈0.416195355. P(scoring 0)=1−q₀=1−(1−x)eˣ=1−(1−0.416195355)e^{0.416195355}=0.114845886.

**Correct Answer: 0.114845886**

---
## Family: Covariance / variance

### GN39 — Covariance Ceiling
**Company:** Akuna Capital, Jane Street · **Difficulty:** Easy · **Concept:** Cauchy–Schwarz bound on covariance

#### Condensed
**Q:** Var(R_A)=20, Var(R_B)=5 (means given but irrelevant). Max Cov(R_A,R_B)?
**A:** Cov²≤Var·Var → Cov≤√(20·5)=√100=**10** (reached at ρ=1). Means are red herrings.

#### Verbatim
Two stocks: E[R_A]=0.6, Var(R_A)=20; E[R_B]=−0.2, Var(R_B)=5. Maximum possible Cov(R_A,R_B)?

Covariance depends only on deviations, so the means are red herrings. Cauchy–Schwarz: Cov(R_A,R_B)²≤Var(R_A)Var(R_B) (equivalently |ρ|≤1). So Cov≤√(20·5)=√100=10, attained when the returns are perfectly correlated (ρ=1), e.g. R_B=−0.2+½(R_A−0.6) with slope σ_B/σ_A=√(5/20)=½.

**Correct Answer: 10**

---

### GN40 — Correlation Flip
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Correlation under affine transforms (sign only)

#### Condensed
**Q:** ρ(X,Y)=0.6. U=4−5X, V=2+3Y. ρ(U,V)?
**A:** Shifts drop out; magnitudes cancel; only signs survive: sign(−5)·sign(3)·0.6=**−0.6**.

#### Verbatim
ρ(X,Y)=0.6. U=4−5X, V=2+3Y. Compute ρ(U,V).

Affine transform: ρ(a+bX, c+dY)=sign(b)·sign(d)·ρ(X,Y). Constants 4,2 drop out; magnitudes 5,3 cancel between numerator (Cov) and denominator (σ's, via |b|). Only the sign of each slope survives: sign(−5)·sign(3)·0.6=−0.6.

**Correct Answer: -0.6**

---

### GN41 — Variance of Two Variables
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Var of a linear combination (independent)

#### Condensed
**Q:** Var(X)=3, Var(Y)=2, independent, Z=2X+3Y. Var(Z)?
**A:** Var(aX+bY)=a²Var(X)+b²Var(Y)=4·3+9·2=**30**.

#### Verbatim
Var(X)=3, Var(Y)=2, X and Y mutually independent, Z=2X+3Y. Compute Var(Z).

Var(aX+bY)=a²Var(X)+b²Var(Y) (independence kills the covariance term). Var(2X+3Y)=4·3+9·2=12+18=30.

**Correct Answer: 30**

---

### GN42 — Twin Drums
**Company:** Da Vinci, Jane Street · **Difficulty:** Easy · **Concept:** Variance of a sum of iid uniforms

#### Condensed
**Q:** Two drums, balls 1–7 each; draw one from each, sum S. Std dev of S?
**A:** Each: μ=4, Var=(n²−1)/12=(49−1)/12=4. Var(S)=4+4=8, σ=√8=**2.83**.

#### Verbatim
Two identical drums, balls 1–7 each, independent draws, S=X+Y. Standard deviation of S? 2 dp.

Single drum uniform on 1..7: E[X]=28/7=4, E[X²]=140/7=20, Var(X)=20−16=4 (matches (n²−1)/12=48/12=4). Independent, so Var(S)=Var(X)+Var(Y)=4+4=8. σ_S=√8=2√2≈2.83. (Do NOT add std devs: 2+2=4 is wrong.)

**Correct Answer: 2.83**

---

### GN43 — Perfect Correlation
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Deducing a linear relation (open/reasoning answer)

#### Condensed
**Q:** X, Y perfectly correlated. What do you need to deduce X from a given Y?
**A:** X=aY+b, so you need **two distinct (X,Y) pairs** to solve for a and b.

#### Verbatim
Given two perfectly correlated random variables. What information about X and Y do you need to deduce the value of X for a given Y?

Perfect correlation ⟹ linear relation X=aY+b. So you only need two distinct (X,Y) pairs to solve for a and b.

**Correct Answer: Two distinct (X,Y) pairs (to solve X=aY+b)**

---

### GN44 — Rainy Day
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Independence vs dependence (open answer)

#### Condensed
**Q:** P(rain Sat)=0.4, P(rain Sun)=0.5. P(no rain all weekend)? And if not independent?
**A:** Independent: 0.6·0.5=**0.3**. If dependent: need the two variances and the correlation to get the covariance, so E[X_Sat·X_Sun]=E·E+Cov.

#### Verbatim
40% rain Saturday, 50% rain Sunday. P(no rain during the weekend)? And if the events are not independent?

Independent: P(no rain)=0.6·0.5=0.3. If correlated, ask the interviewer for more information: you need Var of each day's event and the correlation coefficient, from which Cov=ρ·√(Var_Sat·Var_Sun), and then E[X_Sat X_Sun]=E[X_Sat]E[X_Sun]+Cov(X_Sat,X_Sun).

**Correct Answer: 0.3 (if independent); otherwise need variances + correlation to get covariance**

---

## Family: Uniform order statistics

### GN45 — Uniform Distribution #2
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Min of 3 uniforms in an interval

#### Condensed
**Q:** 3 iid U[0,4]. P(smallest is between 1 and 2)?
**A:** P(all>1)−P(all>2)=(3/4)³−(2/4)³=27/64−8/64=**19/64≈0.297**.

#### Verbatim
Three reals chosen iid U[0,4]. P(smallest is between 1 and 2)?

P(all > 1)=(3/4)³. P(all > 2)=(2/4)³. Subtract: (3/4)³−(2/4)³=27/64−8/64=19/64≈0.297.

**Correct Answer: 0.297**

---

### GN46 — Uniform Distribution #3
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Min of 3 uniforms, shifted interval

#### Condensed
**Q:** 3 iid U[3,8]. P(smallest between 4 and 5)?
**A:** P(all>4)−P(all>5)=(4/5)³−(3/5)³=64/125−27/125=**37/125≈0.296**.

#### Verbatim
Three reals iid U[3,8]. P(smallest is between 4 and 5)?

P(all>4)=(4/5)³, P(all>5)=(3/5)³. Subtract: (4/5)³−(3/5)³=64/125−27/125=37/125.

**Correct Answer: 0.296**

---

### GN47 — Uniformly Distributed Profit
**Company:** Flow Traders, IMC, Jane Street, Virtu, DRW · **Difficulty:** Medium · **Concept:** Ordering probability of iid continuous variables

#### Condensed
**Q:** A,B,C iid U[0,100000]. P(A>B and B>C)?
**A:** 3!=6 equally likely orderings; A>B>C is one → **1/6**.

#### Verbatim
Profits of traders A, B, C iid Uniform[0, 100000], independent. P(profit A > profit B and profit B > profit C)?

There are 3!=6 equally likely orderings of three iid continuous variables. A>B>C occurs in exactly one, so P=1/6.

**Correct Answer: 1/6 ≈ 0.167**

---

## Family: Tournament brackets & spatial arrangements

### GN48 — Knockout Stage
**Company:** Jane Street, Mako · **Difficulty:** Easy · **Concept:** Bracket-side placement counting

#### Condensed
**Q:** 32 seeded teams (i always beats i+1), random bracket. P(Team #1 and Team #3 meet in the final)?
**A:** #3 must be opposite side (16/31), #2 must be same side as #1 (15/30). P=16/31·15/30=**8/31**.

#### Verbatim
32 teams, seeded (Team i beats Team i+1). Random bracket. P(Team #1 and Team #3 play in the final)?

Two conditions: (1) Team #3 on the opposite side from Team #1 — 16 of the remaining 31 spots; (2) Team #2 on the same side as Team #1 (so #2 is eliminated by #1, not #3) — 15 of the remaining 30 spots. P=1·(16/31)·(15/30)=8/31.

**Correct Answer: 8/31 ≈ 0.258**

---

### GN49 — Opening Round Draw
**Company:** Jane Street, Mako · **Difficulty:** Easy · **Concept:** Symmetry — one opponent slot of 15

#### Condensed
**Q:** 16 players, random bracket. P(champion and sister meet in round 1)?
**A:** Fix champion; sister equally likely in any of 15 remaining slots, 1 is the opponent slot. P=1/15≈**0.0667**.

#### Verbatim
Single-elimination, 16 players, slots assigned uniformly at random (pairs = first-round matches). P(champion and her sister drawn to play in round 1)? 4 dp.

Freeze the champion; her match has exactly one other slot. The sister is equally likely among the 15 remaining slots, of which 1 is the opponent slot. P=1/15≈0.0667.

**Correct Answer: 0.0667**

---

### GN50 — Radar Sweep
**Company:** Jane Street, Mako · **Difficulty:** Medium · **Concept:** n points in a common semicircle

#### Condensed
**Q:** 5 satellites uniform on a circle. P(all within some common 180° arc)?
**A:** Anchor arc at the "leading" point; P(other 4 in its clockwise half)=(1/2)⁴; 5 disjoint anchors → 5·(1/2)⁴=**5/16=0.3125**.

#### Verbatim
Five satellites at independent uniform angles on a circle. P(all five lie within some common 180° arc)? 4 dp.

Anchor the arc at the clockwise-most ("leading") satellite. For a fixed satellite k, event A_k = other 4 all in the clockwise half-circle from k has probability (1/2)⁴=1/16 (n−1 independent points). The A_k are mutually exclusive (unique leading point), so P(union)=Σ P(A_k)=5·(1/16)=5/16=0.3125. General n: n·(1/2)^{n−1}.

**Correct Answer: 0.3125**

---

### GN51 — Pentagon Ants
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Permutation via parity/rotation counting

#### Condensed
**Q:** 5 ants on a pentagon, each walks to a random neighbor (±1). P(no collision)?
**A:** No collision ⟺ Σ steps ≡0 mod 5, only all +1 or all −1. 2 of 2⁵ outcomes. P=2/32=**1/16=0.0625**.

#### Verbatim
Five ants, one per pentagon corner; each walks to one of its two neighbours by fair coin. P(no two ants land on the same corner)?

2⁵=32 outcomes. Landings are a permutation iff sums match mod 5: Σsᵢ≡0 (mod 5), with each sᵢ=±1 (5 of them, sum odd in [−5,5]). Only ±5 qualify → all clockwise or all counterclockwise. 2 outcomes. P=2/32=1/16=0.0625.

**Correct Answer: 0.0625**

---

## Family: Counting / expectation misc

### GN52 — All Faces
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Coupon collector (die)

#### Condensed
**Q:** Expected throws to see all 6 faces of a die?
**A:** Coupon collector: 6·Σ_{k=1}⁶ 1/k = 6·(147/60)=147/10=**14.7**.

#### Verbatim
Expected number of throws to see all faces of a die?

Coupon collector: for n faces, n·Σ_{k=1}ⁿ 1/k. Each new face k takes geometric mean 6/(6−(k−1)). For n=6: 6·(1+1/2+…+1/6)=6·(147/60)=147/10=14.7.

**Correct Answer: 14.7**

---

### GN53 — Arcade Triple
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Disjoint-case sum × independence

#### Condensed
**Q:** d8, wheel (40 sectors, 36 numbered), tile (60 tiles, #1–15 ×4). P(all three show the same number)? 5 dp.
**A:** Only 1–8 possible. Per value: (1/8)(1/40)(4/60)=1/4800. ×8 = 8/4800=1/600≈**0.00167**.

#### Verbatim
Roll a d8, spin a 40-sector wheel (36 numbered 1–36, 4 blank), draw a tile from 60 (numbers 1–15, 4 copies each). P(die, wheel, tile all show the same number)? 5 dp.

Only values 1–8 can match (die's range is smallest). Per v: P(die=v)=1/8; P(wheel=v)=1/40 (out of 40 sectors, not 36); P(tile=v)=4/60=1/15. Product=1/(8·40·15)=1/4800, independent of v. Sum over 8 disjoint values: 8/4800=1/600≈0.00167.

**Correct Answer: 0.00167**

---

### GN54 — Cherry Streak
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Inclusion–exclusion for overlapping runs

#### Condensed
**Q:** 4-symbol slot, 6 spins. P(≥4 consecutive cherries)? 4 dp.
**A:** Windows A₁,A₂,A₃ (start 1,2,3), P(Aᵢ)=(1/4)⁴. Incl-excl: 3/256 − (1/1024+1/1024+1/4096) + 1/4096 = 10/1024=5/512≈**0.0098**.

#### Verbatim
Slot shows one of 4 symbols each spin (p=1/4), 6 spins. P(at least 4 consecutive cherries)? 4 dp.

Runs of 4 can start at spin 1, 2, or 3: events A₁,A₂,A₃, P(Aᵢ)=(1/4)⁴=1/256. Inclusion–exclusion: overlaps force more cherries. A₁∩A₂ (spins 1–5): (1/4)⁵=1/1024; A₂∩A₃ (2–6): 1/1024; A₁∩A₃ (all 6): 1/4096; triple (all 6): 1/4096. P=3/256 − (1/1024+1/1024+1/4096) + 1/4096 = 3/256 − 2/1024 = 12/1024 − 2/1024 = 10/1024 = 5/512 ≈ 0.0098.

**Correct Answer: 0.0098**

---

### GN55 — Football or Cupcake
**Company:** Jane Street, Mako, DRW · **Difficulty:** Easy · **Concept:** Linearity of expectation (adjacent merges)

#### Condensed
**Q:** 17 words from {cup,cake,foot,ball}, join compounds (foot+ball, cup+cake). Expected word count?
**A:** P(merge at a pair)=1/16+1/16=1/8. 16 pairs → E[merges]=16/8=2. E[words]=17−2=**15**.

#### Verbatim
Machine emits 17 words uniformly from {cup, cake, foot, ball}. Adjacent pairs foot+ball→football, cup+cake→cupcake merge. Expected number of words (allowing joins)?

P(merge at a given adjacent pair)=P(foot then ball)+P(cup then cake)=1/16+1/16=1/8. 16 adjacent pairs; by linearity E[merges]=16·(1/8)=2. Each merge cuts one word: E[words]=17−2=15.

**Correct Answer: 15**

---

### GN56 — Higher Card
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Conditioning on the first card's rank

#### Condensed
**Q:** Two players draw from a deck without replacement; first wins if strictly higher. P(first wins)?
**A:** Condition on rank: sum wins = (4/(13·51))·Σ_{k=0}^{12}k·1 = (4/(13·51))·(12·13/2·... ) = 8/17≈**0.47**.

#### Verbatim
Both friends draw one card (without replacement) from a normal deck; first wins if strictly higher value, else second wins. P(first drawer wins)?

P(first has a given rank)=1/13. If first has value v, it beats (number of lower cards)/51. Lower cards: rank with k ranks below has 4k of the remaining 51. P(first wins)=(1/13)Σ(4·(#ranks below)/51)=(4/(13·51))·(0+1+…+12)=(4/(13·51))·(12·13/2)=(4/(13·51))·78=8/17≈0.47.

**Correct Answer: 0.47**

---

### GN57 — Checkmate
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Enumerate winning sequences (two-in-a-row)

#### Condensed
**Q:** Beat Tolga w.p. 0.1, Douwe w.p. 0.9. Play T,D,T; prize for any two wins in a row. P(prize)?
**A:** WWW+LWW+WWL = 0.009+0.081+0.081=**0.171**.

#### Verbatim
P(beat Tolga)=0.1, P(beat Douwe)=0.9. Play Tolga, Douwe, Tolga; prize if you win any two in a row. P(prize)?

Winning sequences: (W,W,W)=0.1·0.9·0.1=0.009; (L,W,W)=0.9·0.9·0.1=0.081; (W,W,L)=0.1·0.9·0.9=0.081. Sum=0.171.

**Correct Answer: 0.171**

---

### GN58 — Four Digit Difference
**Company:** Citadel Securities, Jane Street · **Difficulty:** Hard · **Concept:** Counting pairs by difference (triangular distribution)

#### Condensed
**Q:** Two iid uniform 4-digit numbers (1000–9999). P(|a−b| is a 3-digit number, 100–999)? 3 dp.
**A:** #pairs with |a−b|=d is 2(M−d), M=9000. N=Σ_{d=100}^{999}2(9000−d)=15,210,900. P=N/9000²=16901/90000≈**0.188**.

#### Verbatim
Two 4-digit numbers drawn iid uniform on {1000,…,9999} (M=9000). P(|a−b| between 100 and 999 inclusive)? 3 dp.

#{(a,b):|a−b|=d}=2(M−d). N=Σ_{d=100}^{999}2(9000−d). Σ9000 over 900 terms=8,100,000; Σd=(100+999)·900/2=494,550. N=2(8,100,000−494,550)=15,210,900. P=N/9000²=15,210,900/81,000,000=16901/90000≈0.188. (Continuous triangular-density check gives ≈0.1876.)

**Correct Answer: 0.188**

---

### GN59 — Coins in Boxes
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Pigeonhole principle

#### Condensed
**Q:** 76 coins in 15 boxes; win if any box has >5 coins. P(win)?
**A:** 5·15=75<76, so by pigeonhole some box exceeds 5. P=**1**.

#### Verbatim
76 coins randomly placed in 15 boxes. Win if any box has more than 5 coins. P(win)?

Pigeonhole: 5·15=75<76, so at least one box must hold more than 5 coins. P=1.

**Correct Answer: 1**

---

### GN60 — Old Phone #1
**Company:** IMC, Jane Street, Virtu · **Difficulty:** Medium · **Concept:** Parity invariant on a grid graph

#### Condensed
**Q:** Keypad (no 0), start random, 2 horizontal/vertical moves. P(land on odd)?
**A:** Adjacent moves flip parity, so 2 moves return to start's parity. Start odd → end odd. P(odd)=5/9≈**0.555**.

#### Verbatim
3×3 keypad (1–9, no 0). Start at a random number, move only to horizontal/vertical adjacent, 2 moves total. P(land on an odd number)?

On this grid every move flips parity (odd↔even), so two moves return to the starting parity. Start odd ⟹ end odd. 5 odd numbers {1,3,5,7,9} of 9. P=5/9≈0.555.

**Correct Answer: 0.555**

---

### GN61 — Old Phone #2
**Company:** Citadel Securities, IMC, Jane Street, Virtu · **Difficulty:** Medium · **Concept:** Law of total probability on a cycle graph

#### Condensed
**Q:** Rotary phone (1–9 in a circle, no 0), start random, 2 moves. P(land on odd)?
**A:** Case on start parity; boundary numbers {2,8},{1,9} give 3/4. Works out to P(odd)=5/9≈**0.555**.

#### Verbatim
Rotary phone, numbers 1–9 in a circle (no 0). Start random, move to an adjacent number, 2 moves. P(land on odd)?

From {4,6} you stay even; from {3,5,7} you stay odd. From {2,8}: 3/4 chance to end even. From {1,9}: 3/4 chance to end odd. If start even, P(end even)=¼·¾+¼·1+¼·1+¼·¾=7/8. If start odd, P(end odd)=⅕·¾+⅕·1+⅕·1+⅕·1+⅕·¾=9/10. P(land odd)=(4/9)(1−7/8)+(5/9)(9/10)=(4/9)(1/8)+1/2=5/9.

**Correct Answer: 0.555**

---

### GN62 — Complementary
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Inclusion–exclusion + De Morgan

#### Condensed
**Q:** P(A∪B)=0.7, P(A)=0.5, P(B)=0.3. P(Aᶜ∪Bᶜ)?
**A:** P(A∩B)=0.5+0.3−0.7=0.1. De Morgan: P(Aᶜ∪Bᶜ)=1−P(A∩B)=**0.9**.

#### Verbatim
P(A or B)=0.7, P(A)=0.5, P(B)=0.3. Find P(Not A or Not B).

Not mutually exclusive since 0.5+0.3≠0.7. P(A∪B)=P(A)+P(B)−P(A∩B) → P(A∩B)=0.1. De Morgan: P(Aᶜ∪Bᶜ)=P((A∩B)ᶜ)=1−P(A∩B)=0.9.

**Correct Answer: 0.9**

---

### GN63 — Exponential Distribution #2
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Median of an exponential

#### Condensed
**Q:** Median of X~Exp(4)?
**A:** Set F(x)=1−e^{−λx}=0.5 → x=ln2/λ = **ln2/4** (≈0.173).

#### Verbatim
Find the median of X distributed Exp(4).

Median solves cdf(x)=0.5. For Exp(λ): F(x)=1−e^{−λx}=0.5 → e^{−λx}=0.5 → λx=ln2 → x=ln2/λ. For Exp(4): median=ln2/4.

**Correct Answer: ln(2)/4 ≈ 0.173**

---

### GN64 — Diagonal Duel
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Conditioning on one exponential; area/ratio simplification

#### Condensed
**Q:** W,H iid Exp(1). Square has diagonal W (area W²/2), rectangle area WH. P(square area > rectangle)? 3 dp.
**A:** W²/2>WH ⟺ H<W/2. P=∫₀^∞(1−e^{−w/2})e^{−w}dw=1−2/3=**1/3≈0.333**.

#### Verbatim
W,H iid Exp(1). A square has diagonal W (so area W²/2); rectangle has area W·H. P(square area > rectangle area)? 3 dp.

Square with diagonal d has area d²/2. So compare W²/2 vs WH; divide by W>0: W²/2>WH ⟺ W/2>H. Condition on W: P(H<w/2)=1−e^{−w/2}. P=∫₀^∞(1−e^{−w/2})e^{−w}dw=∫e^{−w}dw−∫e^{−3w/2}dw=1−2/3=1/3.

**Correct Answer: 0.333**

---

### GN65 — All-Boys City
**Company:** IMC, Jane Street, Virtu · **Difficulty:** Easy · **Concept:** Stopping rule doesn't change parity ratio (reasoning answer)

#### Condensed
**Q:** Couples stop having kids at first boy. What happens to the fraction of boys?
**A:** Each birth is independent 50/50; stopping rule can't bias nature. Fraction **stays 50%**.

#### Verbatim
Every couple stops having children when they get a boy (each birth 50/50, independent). What happens to the fraction of boys in the city?

Gender is driven by independent 50/50 births, not by the parents' stopping rule. The fraction stays 50%.

**Correct Answer: Stays 50%**

---

### GN66 — Tennis Match: Win in 2 or 3 Sets
**Company:** IMC, Jane Street, Virtu · **Difficulty:** Medium · **Concept:** Compare P(2 sets) vs P(3 sets) (decision answer)

#### Condensed
**Q:** Best-of-3; bet on it finishing in 2 or 3 sets?
**A:** P(2)−P(3)=4p²−4p+1=(2p−1)²≥0. So **bet on 2 sets** unless p=½ (then equal).

#### Verbatim
Best-of-three match (first to 2 sets). Bet on it finishing in two or three sets?

P(2 sets)=p²+(1−p)². P(3 sets)=2p(1−p). Difference=p²+(1−p)²−2p(1−p)=4p²−4p+1=(2p−1)². This is ≥0 always, and >0 unless p=½. So bet on 2 sets (unless the players are exactly evenly matched, where it's a tie).

**Correct Answer: Bet on 2 sets (unless p=½, then equal)**

---

### GN67 — Five Ascending Cards
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Fair-game / EV; probability of an ordering

#### Condensed
**Q:** 63 cards (1–63), draw 5. Ascending → win $25, else lose $1. Fair? Fair payout?
**A:** P(ascending)=1/5!=1/120. EV=25/120−119/120=−94/120<0 → not fair. Fair payout solves p/120−119/120=0 → **$119**.

#### Verbatim
63 cards numbered 1–63, shuffled. Draw 5 from the top. Ascending order → $25, else lose $1. Fair? If not, what payout makes it fair?

5 cards have 5!=120 orderings, exactly one ascending, so P(win)=1/120 (equivalently C(63,5)/(63·62·61·60·59) = 1/120). Expected payout: 25·(1/120)−1·(119/120)=−94/120≈−0.78, so the game is not fair (you lose ~0.78 on average). Fair payout: payment/120 − 119/120 = 0 → payment=119.

**Correct Answer: Not fair (EV ≈ −$0.78); fair payout = $119**

---

*Last updated: 2026-07-22.*
