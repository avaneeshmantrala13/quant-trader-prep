# Quant Question Bank — Probability & Statistics → Markov Chain Probability

> **Handoff note for [coworker] + the SLM training pipeline.** Sixth completed subcategory (**Markov Chain Probability**) of the **Probability and Statistics** category. 16 questions, company-tagged. Same format as the earlier handoffs.

## How to read this document

**What this is.** 16 Markov-chain questions grouped by **family**: expected hitting time (absorbing chains), gambler's ruin / reaching a target, and pattern races. Every question is a Markov-chain / absorbing-state setup solved by first-step analysis (E[s] = 1 + Σ P(s→s')E[s'], with E=0 at absorbing states) or the gambler's-ruin recurrence.

**Each question carries** Company tag(s), a Difficulty, a Concept, and two forms:
- **Condensed** — one-line question + compact worked answer.
- **Verbatim** — exact question text + full worked solution.
A per-question index table is at the top.

**Company tags — lists.** Firms present: Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW. (Flow Traders is NOT in this subcategory — no Markov questions.) Mako uses the most (all 16). The five "core" chains — Animal Migrations, Bankrupt, the three Coin Series, Jumping Toad, Random Ant — appear across almost every firm.

**Answers — all resolve to a single number, with two worth noting:**
- **The Drunkard's Walk** — the answer 0.5 is the fall probability for p=2/3; the full solution is a piecewise gambler's-ruin result (fall is certain if p ≤ ½). Numeric target = 0.5.
- **Top 2000 Songs** — framed as "is 100-without-repeat a safe bet + expected count"; the number is ≈56.72 (bet is not safe).
Two questions (**Escape the Square**, **Top 2000 Songs**) require a large linear solve / short code — the answers are given and the method shown. All 16 have exact numeric answers suitable for verifier-checked RL. Condensed = short-CoT target; Verbatim = long-CoT / full-derivation target.

**Useful pattern for generation:** the "expected wait for a coin pattern" and "n-in-a-row with reset" questions (Coin Series #1/#2, Parking Meter, Picking Tiles) share a first-step-recursion skeleton with closed forms (e.g. a run of n heads → 2^{n+1}−2), and the gambler's-ruin questions share the ruin recurrence — good candidates for parametric generation.

---

# Probability and Statistics — Markov Chain Probability

> **Note.** 16 questions, company-tagged. Grouped by family. Two questions have answers that are practical judgments plus a number: **The Drunkard's Walk** (escape probability, with a piecewise gambler's-ruin result) and **Top 2000 Songs** (a "is it a safe bet + expected count" framing). All others resolve to a single exact number. Two heavy questions (Escape the Square, Top 2000 Songs) require solving a large linear system / code — the answers are given.

## Markov Chain Probability — index of questions

| Question | Family | Difficulty | Answer |
|---|---|---|---|
| Animal Migrations | Expected hitting time | Easy | 1.25 |
| Coin Series #1 (HHH) | Expected hitting time (pattern) | Easy | 14 |
| Coin Series #2 (THH) | Expected hitting time (pattern) | Medium | 8 |
| Coin Series #3 (HHH before THH) | Pattern race | Medium | 1/8 |
| Jumping Toad | Expected hitting time | Medium | 2 |
| Parking Meter | Expected hitting time | Easy | 30 |
| Picking Tiles | Expected hitting time (two-in-a-row) | Easy | 9.78 |
| Random Ant | Expected hitting time (cube) | Medium | 10 |
| Region Spinner | Expected hitting time | Easy | 2.55 |
| Stop Sign Stroll | Expected hitting time (octagon) | Medium | 20 |
| Escape the Square | Expected hitting time (2D grid) | Hard | 29.24 |
| Bankrupt | Gambler's ruin | Easy | 0.57 |
| Bold Betting Strategy | Gambler's ruin (bold play) | Medium | 0.377 |
| Dominant Game | Gambler's ruin | Hard | ≈0.999 |
| The Drunkard's Walk | Gambler's ruin (semi-infinite) | Hard | 0.5 (fall) |
| Top 2000 Songs | Expected hitting time (birthday) | Medium | 56.72 |

---

## Family: Expected hitting time (absorbing chain)

*Method: define E[s] = expected steps to absorption from state s; write E[s] = 1 + Σ P(s→s')E[s'] with E=0 at absorbing states; solve the linear system.*

### MC1 — Animal Migrations
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Expected hitting time to a repeat state

#### Condensed
**Q:** Wolves→wolves 0.9 (bears 0.1); bears→bears 0.6 (wolves 0.4). Currently wolves. Expected migrations until the next wolf migration?
**A:** w = 0.9·0 + 0.1·b + 1, b = 0.4·0 + 0.6·b + 1 → b = 5/2; w = 0.1·(5/2)+1 = **1.25**.

#### Verbatim
If wolves are migrating, next is wolves w.p. 0.9, bears 0.1. If bears, next is bears 0.6, wolves 0.4. On average how many migrations before the next wolf migration?

Absorbing state = next wolf migration (w2=0). w1 = 0.9·w2 + 0.1·b + 1; b = 0.4·w2 + 0.6·b + 1 → 0.4b = 0.4·w2 + 1 → b = w2 + 5/2. Then w1 = 0.9·0 + 0.1·(0 + 5/2) + 1 = 5/20 + 1 = 25/20 = 1.25.

**Correct Answer: 1.25**

---

### MC2 — Coin Series #1 (HHH)
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Expected wait for pattern HHH

#### Condensed
**Q:** Fair coin; expected tosses to see HHH?
**A:** States s0,s1,s2,s3(abs). sᵢ = 1 + ½s₀ + ½s_{i+1}. Solve → **s0 = 14**. (General: for a run of n heads, 2^{n+1}−2.)

#### Verbatim
Keep tossing a fair coin. Expected number of tosses to get HHH?

s0 start, s3 absorbing. s0 = 1 + ½s0 + ½s1; s1 = 1 + ½s0 + ½s2; s2 = 1 + ½s0 + ½s3; s3 = 0. Back-substituting: s2 = 1 + ½s0, s1 = 3/2 + 3/4 s0, s0 = 7/4 + 7/8 s0 → (1/8)s0 = 7/4 → s0 = 14.

**Correct Answer: 14**

---

### MC3 — Coin Series #2 (THH)
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Expected wait for pattern THH

#### Condensed
**Q:** Fair coin; expected tosses to see THH?
**A:** States where a wrong toss resets to s1 (not s0, since a T keeps progress). s1 = 6, s0 = 8. **Answer 8**. (THH is faster than HHH because failures don't fully reset.)

#### Verbatim
Keep tossing a fair coin. Expected number of tosses to get THH?

s0 = 1 + ½s0 + ½s1; s1 = 1 + ½s1 + ½s2; s2 = 1 + ½s1 + ½s3; s3 = 0. From these: s2 = 1 + ½s1; s1 = 3/2 + 3/4 s1 → (1/4)s1 = 3/2 → s1 = 6; s0 = 1 + ½s0 + ½·6 → (1/2)s0 = 4 → s0 = 8.

**Correct Answer: 8**

---

### MC5 — Jumping Toad
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Expected hitting time on a small walk

#### Condensed
**Q:** Table 20 cm wide, toad at 6 cm, jumps ±10 cm w.p. ½. Expected jumps to leave the table?
**A:** States: 6cm (s1), 16cm (s2), off = 0. s1 = 1 + ½s2, s2 = 1 + ½s1 → s1 = 1 + ½(1+½s1) → (3/4)s1 = 3/2 → **s1 = 2**.

#### Verbatim
A 20 cm table, toad at 6 cm from the left, jumps ±10 cm w.p. ½. Expected jumps before it jumps off?

States: s0 = off left (0), s1 = at 6 cm, s2 = at 16 cm, s3 = off right (0). s1 = 1 + ½s0 + ½s2 = 1 + ½s2; s2 = 1 + ½s1. Substitute: s1 = 1 + ½(1 + ½s1) = 3/2 + ¼s1 → (3/4)s1 = 3/2 → s1 = 2.

**Correct Answer: 2**

---

### MC6 — Parking Meter
**Company:** Jane Street, Mako · **Difficulty:** Easy · **Concept:** Expected hitting time with reset

#### Condensed
**Q:** Need 4 coins; after each coin, 50% chance the machine rejects everything (reset). Expected coins to park?
**A:** sᵢ = 1 + ½s₀ + ½s_{i+1}, s4=0. Back-substitute → s0 = **30**. (General: for n coins, 2^{n+1}−2.)

#### Verbatim
A meter needs 4 coins; after each coin there's a 50% chance it rejects all coins so far (start over). Expected coins to successfully park?

s0 = ½s0 + ½s1 + 1; s1 = ½s0 + ½s2 + 1; s2 = ½s0 + ½s3 + 1; s3 = ½s0 + ½s4 + 1; s4 = 0. Back-substitute: s3 = ½s0 + 1, s2 = ¾s0 + 3/2, s1 = 7/8 s0 + 7/4, s0 = 15/16 s0 + 15/8 → (1/16)s0 = 15/8 → s0 = 30.

**Correct Answer: 30**

---

### MC7 — Picking Tiles
**Company:** Mako, SIG, DRW · **Difficulty:** Easy · **Concept:** Expected wait for two-in-a-row, general p

#### Condensed
**Q:** P(black)=3/8; expected tiles to place two black consecutively?
**A:** Two states: E0 = 1 + pE1 + qE0, E1 = 1 + qE0. E0 = 1/p + E1, E1 = 1 + q(1/p+E1) → E1 = 64/9; E0 = 8/3 + 64/9 = **88/9 ≈ 9.78**. (General: (1+p)/p².)

#### Verbatim
Draw tiles; P(black)=3/8, P(white)=5/8. Expected turns to place two black tiles consecutively?

E0 (no preceding black) = 1 + pE1 + qE0; E1 (one black) = 1 + p·0 + qE0. So E0 = 1/p + E1 = 8/3 + E1; E1 = 1 + q·E0 = 1 + (5/8)(8/3 + E1) → (3/8)E1 = 8/3 → E1 = 64/9. E0 = 8/3 + 64/9 = 88/9 ≈ 9.78.

**Correct Answer: 9.78**

---

### MC8 — Random Ant
**Company:** Akuna Capital, Citadel Securities, Jane Street, Mako, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Expected hitting time on a cube (symmetry classes)

#### Condensed
**Q:** Ant at a cube corner, walks to a random neighbor (1/3 each), 1 sec/step. Expected seconds to reach the opposite corner?
**A:** By symmetry track distance (0,1,2,3). s1 = 1+s2, s2 = 1 + ⅔s3 + ⅓s1, s3 = 1 + ⅔s2 (sₐ=0). Solve → **s1 = 10**.

#### Verbatim
An ant at a cube corner walks to neighbouring corners w.p. 1/3, reaching the opposite corner. 1 sec per move. Expected seconds?

Group corners by distance from start: s1 (start), s2 (adjacent, ×3), s3 (distance 2, ×3), sₐ (opposite, =0). s1 = 1 + s2; s2 = 1 + ⅔s3 + ⅓s1; s3 = 1 + ⅔s2 + ⅓·0. Substitute s3 into s2: s2 = 5/3 + 4/9 s2 + ⅓s1 → (5/9)s2 = 5/3 + ⅓s1 → s2 = 3 + 3/5 s1. Then s1 = 1 + 3 + 3/5 s1 → (2/5)s1 = 4 → s1 = 10.

**Correct Answer: 10**

---

### MC9 — Region Spinner
**Company:** Jane Street, Mako, SIG, DRW · **Difficulty:** Easy · **Concept:** Expected spins to two distinct regions

#### Condensed
**Q:** Spinner P = 1/3, 1/4, 5/12. Expected spins to land on two distinct regions?
**A:** After first spin in region r, wait geometric 1/(1−P(r)). E = 1 + ⅓·(3/2) + ¼·(4/3) + 5/12·(12/7) = **2.55**.

#### Verbatim
Spinner: Region 1 = 1/3, Region 2 = 1/4, Region 3 = 5/12. Expected spins to land on two distinct regions?

After the first spin lands in region r, you wait for anything different: geometric mean 1/(1−P(r)), i.e. E[N|r] = 1 + 1/(1−P(r)). For r=1: 1+1/(2/3)=... conditional values 3/2, 4/3, 12/7 for the "extra" wait. E = 1 + ⅓·(3/2) + ¼·(4/3) + (5/12)·(12/7) = 2.55.

**Correct Answer: 2.55**

---

### MC10 — Stop Sign Stroll
**Company:** Citadel Securities, Mako · **Difficulty:** Medium · **Concept:** Expected hitting time on an octagon (symmetry by distance)

#### Condensed
**Q:** Beetle on an octagon; each minute CW (2/5), CCW (2/5), stay (1/5). Expected minutes to reach the opposite corner (distance 4)?
**A:** Track distance d∈{0,..,4}, E4=0. Clear the stay term (÷4/5); solve E2=15, E1=18.75, E0 = **20**.

#### Verbatim
A beetle on a regular octagon; each minute clockwise (2/5), anticlockwise (2/5), stay (1/5). Expected minutes to reach the diametrically opposite corner?

By CW/CCW symmetry, track distance d from start (goal d=4). E4=0. E0 = 1 + ⅕E0 + ⅘E1; Ed = 1 + ⅕Ed + ⅖E_{d+1} + ⅖E_{d-1} for d=1,2,3. Clearing the stay term: E0 = 5/4 + E1, E1 = 5/4 + ½E2 + ½E0, E2 = 5/4 + ½E3 + ½E1, E3 = 5/4 + ½E2. Solving: E2 = 15, E1 = 18.75, E0 = 20.

**Correct Answer: 20**

---

### MC11 — Escape the Square
**Company:** Citadel Securities, Jane Street, Mako · **Difficulty:** Hard · **Concept:** Expected hitting time on a 2D lattice; symmetry reduction + linear solve

#### Condensed
**Q:** Particle at center (5,5) of an 11×11 grid; each step N/S/E/W w.p. ¼; stop on the boundary. Expected steps?
**A:** E(x,y) = 1 + ¼·(4 neighbors), E=0 on boundary. 81 interior points reduce to 15 by the square's symmetry; solving gives E(5,5) = 534525/18281 ≈ **29.24**.

#### Verbatim
A particle at the center (5,5) of an 11×11 grid of integer points [0,10]². Each step is N/S/E/W w.p. ¼ (via two fair coins). Stop on any boundary point. Expected steps to reach the boundary?

Interior: E(x,y) = 1 + ¼[E(x+1,y)+E(x−1,y)+E(x,y+1)+E(x,y−1)], with E=0 on the boundary — 81 interior equations. The square's symmetry group collapses these to 15 distinct unknowns; solving the 15×15 system gives the center value E(5,5) = 534525/18281 ≈ 29.24 (values decrease monotonically toward the edge, from ≈29.24 at center to ≈5.13 at the inner corner).

**Correct Answer: 29.24**

---

### MC16 — Top 2000 Songs
**Company:** Mako · **Difficulty:** Medium · **Concept:** Expected number until first repeat (birthday-style absorbing chain)

#### Condensed
**Q:** 2000 songs on shuffle (each independent uniform). Expected songs until the first repeat? Is "100 without a repeat" a safe bet?
**A:** E[k] = 1 + ((N−k)/N)·E[k+1], back-recursion from k=N. Numerically ≈ **56.72** songs. So betting on 100 without a repeat is NOT safe.

#### Verbatim
2000 songs shuffled (each next song uniform over 2000). Emilie bets she can hear 100 songs without a repeat. Safe bet? Expected songs until a repeat?

Absorbing chain: with k distinct songs already heard, next is new w.p. (2000−k)/2000. E[k] = 1 + ((2000−k)/2000)·E[k+1], back-recursion from E[2000]=0. Computed E[0] ≈ 56.72. So she expects a repeat after ~57 songs — the "100 songs" bet is not safe.

```python
import numpy as np
def expected_songs_markov(num_songs=2000):
    p_new = [(num_songs-k)/num_songs for k in range(num_songs)]
    E = np.zeros(num_songs)
    for k in range(num_songs-2, -1, -1):
        E[k] = 1 + p_new[k]*E[k+1]
    return E[0]   # 56.7189...
```

**Correct Answer: 56.72**

---

## Family: Gambler's ruin / reaching a target

*Method: absorbing chain on wealth; P(reach N from k) solved via the ruin recurrence uₖ = p·u_{k+1} + q·u_{k−1} with u_0=0, u_N=1.*

### MC12 — Bankrupt
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Gambler's ruin (small)

#### Condensed
**Q:** A has $1, B has $2; A wins each game w.p. 2/3; play till someone's broke. P(A wins)?
**A:** s0=0, s3=1; s1 = ⅔s2, s2 = ⅓s1 + ⅔. Solve → s1 = **4/7 ≈ 0.57**.

#### Verbatim
A has $1, B has $2; winner takes $1; A wins each game w.p. 2/3. Play until someone is bankrupt. P(A wins)?

States 0..3 (A's money), s0=0, s3=1. s1 = ⅓·0 + ⅔·s2; s2 = ⅓·s1 + ⅔·1. Substitute: s1 = ⅔(⅓s1 + ⅔) = 2/9 s1 + 4/9 → (7/9)s1 = 4/9 → s1 = 4/7 ≈ 0.57.

**Correct Answer: 0.57**

---

### MC13 — Bold Betting Strategy
**Company:** Citadel Securities, Jane Street, Mako, SIG, DRW · **Difficulty:** Medium · **Concept:** Gambler's ruin with bold play (variable stake)

#### Condensed
**Q:** Start 3 tokens, goal 5; each turn bet min(w, 5−w); win w.p. 1/3. P(reach 5)?
**A:** Stakes: from 3 bet 2, from 2 bet 2, from 1 bet 1, from 4 bet 1. P3 = ⅓ + ⅔·P1, chain of equations → P3 = 29/77 ≈ **0.377**.

#### Verbatim
Start with 3 tokens, reach 5 before 0; each turn stake min(w, 5−w); win w.p. p=1/3. P(reach 5)?

Stakes: s(1)=1, s(2)=2, s(3)=2, s(4)=1. P0=0, P5=1. P1 = p·P2; P2 = p·P4; P3 = p·1 + (1−p)P1; P4 = p·1 + (1−p)P3. With p=1/3: P1 = (1/9)P4, P4 = 1/3 + ⅔P3, P3 = 1/3 + ⅔P1. Solving gives P4 = 45/77, P3 = 29/77 ≈ 0.377.

**Correct Answer: 0.377**

---

### MC14 — Dominant Game
**Company:** Mako · **Difficulty:** Hard · **Concept:** Gambler's ruin with a strong edge

#### Condensed
**Q:** You $10, opponent $10; you win each game w.p. 2/3; play to bankruptcy. P(opponent goes bankrupt)?
**A:** Ruin with r = q/p = 1/2: uₖ = (1 − rᵏ)/(1 − r²⁰). u₁₀ = (1−0.5¹⁰)/(1−0.5²⁰) ≈ **0.999**.

#### Verbatim
You $10, opponent $10; you win each game w.p. 2/3. Play to bankruptcy. P(opponent bankrupt)?

Gambler's ruin, states 0..20 (your money), u0=0, u20=1, recurrence uₖ = ⅔u_{k+1} + ⅓u_{k−1}. With r = q/p = (1/3)/(2/3) = 1/2, the closed form is uₖ = (1 − rᵏ)/(1 − r²⁰). u10 = (1 − 0.5¹⁰)/(1 − 0.5²⁰) ≈ 0.999. (Quick intuition: a 2/3 edge over a symmetric-length game makes opponent ruin nearly certain.)

**Correct Answer: ≈0.999**

---

### MC15 — The Drunkard's Walk
**Company:** Mako · **Difficulty:** Hard · **Concept:** Gambler's ruin on a semi-infinite line

#### Condensed
**Q:** Drunk 1 step from a cliff; steps away w.p. 2/3, toward w.p. 1/3. P(eventually falls off)?
**A:** P1 satisfies X = (1−p) + pX²; roots X=1 and X=(1−p)/p. For p=2/3 (>½): P(fall) = (1−p)/p = **1/2**. (If p≤½, fall is certain.)

#### Verbatim
Standing 1 step from a cliff (position 1; 0 = fall). Step away w.p. 2/3, toward w.p. 1/3. Chance of falling off?

Let X = P(fall from position 1). X = (1−p) + p·X² (step to 0 directly, or step to 2 then fall, which requires falling twice = X²). Solving p·X² − X + (1−p) = 0 gives X = 1 or X = (1−p)/p. For p > ½ use the second root: with p = 2/3, X = (1/3)/(2/3) = 1/2. So even favoring escape 2:1, he falls w.p. 0.5. (For p ≤ ½, X = 1 — certain to fall.)

**Correct Answer: 0.5**

---

## Family: Pattern race

### MC4 — Coin Series #3 (HHH before THH)
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Which pattern appears first

#### Condensed
**Q:** Fair coin; P(HHH appears before THH)?
**A:** HHH can only win if the first three tosses are HHH — any earlier tail makes THH reachable first. P = (½)³ = **1/8**. (Markov absorbing-state setup confirms it.)

#### Verbatim
Fair coin; probability of getting HHH before THH? (Solve via Markov chains.)

The quick insight: HHH beats THH only if the very first three tosses are HHH; as soon as a tail appears, a following HH completes THH first. So P = (1/2)³ = 1/8. Markov confirmation: with absorbing states, sₜₕₕ = sₜₕ = sₜ = 0 (once a T appears, THH will win first) and s_HHH = 1. Then sHH = ½·0 + ½·1 = 1/2, sH = ½·0 + ½·(1/2) = 1/4, s_start = ½·0 + ½·(1/4) = 1/8.

**Correct Answer: 1/8**

---

*Last updated: 2026-07-21.*
