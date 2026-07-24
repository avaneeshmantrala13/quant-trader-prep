# Quant Question Bank — Probability & Statistics → Conditional Probability

> **Handoff note for [coworker] + the SLM training pipeline.** Fifth completed subcategory (**Conditional Probability**) of the **Probability and Statistics** category. 45 questions, company-tagged. Same format as the earlier handoffs; subcategory-specific notes below.

## How to read this document

**What this is.** 45 conditional-probability questions in the *Conditional Probability* subcategory. Distinct methods, NOT one repeating template. Grouped by **family** = solution method: reduced sample space / equally-likely counting, Bayes' theorem, law of total probability, continuous conditioning, competing-events / race conditioning, the Russian Roulette series, two-child framing paradoxes, and counterintuitive classics.

**Each question carries** Company tag(s), a Difficulty, a Concept, and two forms:
- **Condensed** — one-line question + compact worked answer.
- **Verbatim** — exact question text + full worked solution.
There is a per-question index table at the top listing family, difficulty, and answer for all 45.

**Company tags — lists; several firms overlap heavily.** The Company field is a comma-separated LIST (many questions are shared). Firms present: Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW. Jane Street and DRW use the largest sets here. Do not collapse a multi-firm question to one firm.

**Answers — mostly exact scalars, with a few non-numeric by design (route these as reasoning/SFT, not scalar-reward RL):**
- **Russian Roulette #3 / #4** answer with a *decision*: "should spin" / "should not spin" (the numeric justification is in the solution, but the graded answer is the choice).
- **Child's Gender** is a *two-part* answer (1/3 and 1/2) — the whole point is that two similar-sounding setups differ; treat as two sub-answers.
- **Monty Hall** answers "2/3 (switch)" — a decision plus a probability.
Everything else has a single exact numeric answer suitable for verifier-checked RL. Condensed = short-CoT target; Verbatim = long-CoT / full-derivation target.

**Two watch-outs the solutions call out explicitly (good hard-negative material):**
- **Pine Property**: the trap answer 4/4 = 1 computes P(above|Pine), the reverse of the asked P(Pine|above).
- **Six Before Eleven**: using unordered dice pairs gives the wrong 0.75; ordered pairs give the correct 5/7.
These "common wrong answer" notes are useful if you're building preference/rejection data.

---

# Probability and Statistics — Conditional Probability

> **Note.** 45 questions, company-tagged. Grouped by solution method (family). Most have exact numeric answers (verifier-checkable). A few are non-numeric by design and flagged inline: **Russian Roulette #3/#4** answer with a *decision* (spin / don't spin), **Child's Gender** and **Monty Hall** are two-part / explanation answers, and **Unfair Heads #2** answers 4/9 ≈ 0.444. SIG-style breadth again: many questions are shared across firms, so the Company field is a list.

## Conditional Probability — index of questions

| Question | Family | Difficulty | Answer |
|---|---|---|---|
| Airport Cafe | Reduced sample space | Easy | 0.25 |
| Pine Property | Reduced sample space | Easy | 0.40 |
| West Region | Reduced sample space | Easy | 0.375 |
| Games Store | Reduced sample space | Easy | 0.33 |
| Favorite Sports | Reduced sample space | Easy | 0.19 |
| Exactly One Tail | Reduced sample space | Easy | 0.267 |
| Given a Seven | Reduced sample space | Easy | 0.333 |
| Rolling Six | Reduced sample space | Easy | 0.09 |
| All Bulbs Lit | Conditional counting | Easy | 0.067 |
| Painted Discs | Conditional counting | Easy | 0.667 |
| Chip Eleven | Conditional / chain rule | Easy | 0.167 |
| Dart Game | Conditional counting | Medium | 0.67 |
| Algorithms | Bayes' theorem | Medium | 0.5 |
| Athletic Cats | Bayes' theorem | Medium | 0.125 |
| Calf Kicks | Bayes' theorem | Easy | 0.04 |
| Engine or Wheels | Bayes' theorem | Easy | 0.43 |
| Fair or Unfair Coin | Bayes' theorem | Easy | 0.3636 |
| Fake News | Bayes' theorem | Easy | 0.8 |
| Liver Disease | Bayes' theorem | Easy | 0.07 |
| Racing Cars | Bayes' theorem | Medium | 0.45 |
| Surprise Headliner | Bayes' theorem | Medium | 0.45 |
| The Intern Did It | Bayes' theorem | Easy | 0.6 |
| Twice as Likely | Bayes' theorem | Medium | 0.333 |
| Two Blue Gumballs | Bayes' theorem | Medium | 0.2 |
| Which Die Was It | Bayes' theorem | Medium | 0.6 |
| Which Pouch | Bayes' theorem | Easy | 0.824 |
| Painted Cube | Bayes' theorem | Hard | 0.5 |
| Second Heads | Bayes' / conditional | Medium | 0.44 |
| Unfair Heads #1 | Bayes' / conditional | Medium | 0.571 |
| Unfair Heads #2 | Bayes' theorem | Medium | 4/9 ≈ 0.444 |
| Chocolate Transfer | Law of total probability | Easy | 0.64 |
| One Fair Die | Law of total probability | Easy | 0.5 |
| Car Wash Countdown | Continuous conditioning | Easy | 0.25 |
| Six Before Eleven | Race conditioning | Easy | 0.714 |
| Tie to Win | Race conditioning | Easy | 0.2222 |
| First to Heads | Race conditioning | Medium | 0.75 |
| Coin Toss #1 | Race / recursion | Medium | 0.444 |
| Parity Race | First-step recursion | Easy | 0.667 |
| Russian Roulette #1 | Russian Roulette | Easy | 0.5 |
| Russian Roulette #2 | Russian Roulette | Medium | 0.55 |
| Russian Roulette #3 | Russian Roulette | Medium | should spin |
| Russian Roulette #4 | Russian Roulette | Medium | should not spin |
| Child's Gender | Two-child paradox | Medium | 1/3; 1/2 |
| Vacant Room | Conditional (multi-stage) | Hard | 0.8 |
| Monty Hall Problem | Counterintuitive classic | Easy | 2/3 (switch) |

---

## Family: Reduced sample space / equally-likely counting

*Method: given equally-likely outcomes and a conditioning fact, discard outcomes inconsistent with the fact and take the target's share of the survivors: P(A|B) = #(A∩B)/#B.*

### CP1 — Airport Cafe
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space

#### Condensed
**Q:** 16 quarterly profit figures (4 cafes × 4 quarters); a random one is > $40,000. P(it's the Airport cafe)?
**A:** 8 cells exceed 40k; Airport appears in 2 of them → 2/8 = **0.25**.

#### Verbatim
The table shows quarterly profit of four cafes across the four quarters of 2024:

| | Downtown | Harbor | Airport | Campus |
|---|---|---|---|---|
| Q1 | 38,200 | 41,500 | 36,900 | 44,300 |
| Q2 | 45,100 | 39,800 | 42,600 | 37,400 |
| Q3 | 36,500 | 43,900 | 38,100 | 41,200 |
| Q4 | 42,800 | 35,600 | 44,700 | 39,300 |

We pull one of these sixteen figures at random, and we are told it is more than 40,000 dollars. What is the probability that the figure belongs to the Airport cafe?

For equally-likely cells, conditioning shrinks the pool: P(A|B) = #(A and B)/#B. Cells above 40,000: Q1 Harbor 41,500 & Campus 44,300; Q2 Downtown 45,100 & Airport 42,600; Q3 Harbor 43,900 & Campus 41,200; Q4 Downtown 42,800 & Airport 44,700 — that's 8 cells. Airport appears twice (Q2, Q4). So P(Airport | above 40,000) = 2/8 = 1/4 = 0.25.

**Correct Answer: 0.25**

---

### CP2 — Pine Property
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space

#### Condensed
**Q:** 16 rental figures (4 properties × 4 years); a random one is > $80,000. P(it's Pine)?
**A:** 10 cells exceed 80k; Pine is in 4 of them → 4/10 = **0.40**. (Trap: 4/4=1 is P(above|Pine), the reverse.)

#### Verbatim
Annual rental income over four years:

| | Maple | Oak | Pine | Cedar |
|---|---|---|---|---|
| 2020 | 82,300 | 78,500 | 85,100 | 79,200 |
| 2021 | 77,800 | 83,600 | 81,400 | 84,900 |
| 2022 | 86,200 | 79,100 | 88,700 | 76,300 |
| 2023 | 75,400 | 81,900 | 83,500 | 87,600 |

We pull one of these sixteen figures at random, told it is more than 80,000 dollars. Probability it belongs to Pine?

Cells above 80,000: 2020 Maple & Pine; 2021 Oak, Pine, Cedar; 2022 Maple & Pine; 2023 Oak, Pine, Cedar — 10 cells. Pine appears 4 times (every year). P(Pine | above 80,000) = 4/10 = 2/5 = 0.40. (Trap: answering 4/4 = 1 computes P(above | Pine), the reverse of what's asked.)

**Correct Answer: 0.40**

---

### CP3 — West Region
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space

#### Condensed
**Q:** 16 revenue figures (4 regions × 4 years); a random one is > $60,000. P(it's West)?
**A:** 8 cells exceed 60k; West is in 3 → 3/8 = **0.375**.

#### Verbatim
Annual subscriber revenue over four years:

| | North | South | East | West |
|---|---|---|---|---|
| 2021 | 58,400 | 62,100 | 55,900 | 63,700 |
| 2022 | 64,500 | 57,200 | 61,800 | 59,300 |
| 2023 | 56,700 | 63,400 | 58,100 | 65,200 |
| 2024 | 61,500 | 54,800 | 57,600 | 66,900 |

We pick one of these sixteen figures at random, told it is more than 60,000 dollars. Probability it belongs to West?

Cells above 60,000: 2021 South & West; 2022 North & East; 2023 South & West; 2024 North & West — 8 cells. West appears 3 times (2021, 2023, 2024). P(West | above 60,000) = 3/8 = 0.375.

**Correct Answer: 0.375**

---

### CP4 — Games Store
**Company:** Jane Street, Mako, SIG, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space

#### Condensed
**Q:** 16 profit figures (4 companies × 4 years); a random one is > $70,000. P(it's the games store)?
**A:** 9 cells exceed 70k; games store is in 3 → 3/9 = 1/3 ≈ **0.33**.

#### Verbatim
| | Restaurant | Games | Electronics | Bikes |
|---|---|---|---|---|
| 2020 | 52,555 | 78,958 | 68,911 | 63,981 |
| 2021 | 72,565 | 68,432 | 88,031 | 73,010 |
| 2022 | 91,365 | 83,349 | 74,092 | 62,472 |
| 2023 | 62,424 | 79,495 | 65,839 | 83,789 |

We pull a company's profit at random and find it made more than 70,000 dollars. Probability it was the games store?

Nine cells exceed 70,000; three belong to the games store (78,958; 83,349; 79,495). P = 3/9 = 1/3 ≈ 0.33.

**Correct Answer: 0.33**

---

### CP5 — Favorite Sports
**Company:** Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space (single column)

#### Condensed
**Q:** Survey of 1000 by age; you meet a 27-year-old. P(prefers football)?
**A:** 27 → the 24–29 column (240 people); football = 46. P = 46/240 = 23/120 ≈ **0.19**.

#### Verbatim
1000 people asked their preferred sport, grouped by age:

| | 18-23 | 24-29 | 30-35 | 36-41 | Total |
|---|---|---|---|---|---|
| Football | 44 | 46 | 57 | 49 | 196 |
| Cycling | 70 | 73 | 60 | 87 | 290 |
| Swimming | 38 | 39 | 61 | 75 | 213 |
| Other | 86 | 82 | 60 | 73 | 301 |
| Total | 238 | 240 | 238 | 284 | 1000 |

You meet a 27-year-old respondent. Probability this person prefers football?

Condition on the 24–29 column (240 people): P(Football | age 24-29) = 46/240 = 23/120 ≈ 0.19.

**Correct Answer: 0.19**

---

### CP6 — Exactly One Tail
**Company:** Akuna Capital, Jane Street, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space, complement

#### Condensed
**Q:** 4 fair coins, told at least one is tails. P(exactly one tail)?
**A:** 16 outcomes; B (≥1 tail) = 15; exactly-one-tail = 4. P = 4/15 ≈ **0.267**.

#### Verbatim
Four fair coins are flipped, and you are told at least one showed tails. Probability that exactly one coin showed tails? (3 d.p.)

16 equally-likely sequences. B = "at least one tail" excludes only HHHH, so |B| = 15. A = "exactly one tail" = {THHH, HTHH, HHTH, HHHT}, |A∩B| = 4. P(A|B) = 4/15 ≈ 0.267.

**Correct Answer: 0.267**

---

### CP7 — Given a Seven
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space (ordered pairs)

#### Condensed
**Q:** Two dice, told sum = 7. P(at least one shows a 2)?
**A:** 6 ordered pairs sum to 7; two contain a 2 ((2,5),(5,2)) → 2/6 = **1/3**.

#### Verbatim
You roll two fair dice and are told the sum is 7. Probability at least one die shows a 2?

The sum-7 ordered pairs: (1,6),(2,5),(3,4),(4,3),(5,2),(6,1) — 6 survivors. Those containing a 2: (2,5),(5,2). P = 2/6 = 1/3.

**Correct Answer: 0.333**

---

### CP8 — Rolling Six
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Reduced sample space (Boy-or-Girl style)

#### Condensed
**Q:** Two dice, told at least one is a six. P(both sixes)?
**A:** 11 ordered pairs contain a six; only (6,6) has both → **1/11 ≈ 0.09**.

#### Verbatim
Bob rolls two fair dice and tells you at least one is a six. How likely both are a six?

Ordered pairs with a six: (6,1..6) and (1..6,6), which is 11 distinct pairs (6,6 counted once). Only (6,6) has both sixes. P = 1/11 ≈ 0.09.

**Correct Answer: 0.09**

---

### CP9 — All Bulbs Lit
**Company:** Jane Street, Mako, DRW · **Difficulty:** Easy · **Concept:** Conditional probability, complement

#### Condensed
**Q:** 4 bulbs each on w.p. ½; told at least one is on. P(all four on)?
**A:** P(all on)/P(≥1 on) = (1/16)/(15/16) = **1/15 ≈ 0.067**. (General: (½)ⁿ/(1−(½)ⁿ) = 1/(2ⁿ−1).)

#### Verbatim
A row of 4 bulbs each independently turns on with probability ½. You notice at least one is on. Probability all four are on? (3 d.p.)

A = all on, B = at least one on. A⊆B so A∩B=A, P(A)=(½)⁴=1/16. P(B)=1−P(all off)=1−1/16=15/16. P(A|B)=(1/16)/(15/16)=1/15≈0.067. (General n bulbs: 1/(2ⁿ−1).)

**Correct Answer: 0.067**

---

### CP10 — Painted Discs
**Company:** Jane Street, Mako, DRW · **Difficulty:** Easy · **Concept:** Condition on faces, not objects (Bertrand's box)

#### Condensed
**Q:** 3 discs: green/green, yellow/yellow, green/yellow. Draw one, up-face is green. P(hidden face also green)?
**A:** Count faces: 3 green up-faces (G1,G2,G3); 2 have a green back → **2/3** (not the naive ½).

#### Verbatim
Three discs: one green/green, one yellow/yellow, one green/yellow. You drop one at random; the up-face is green. Probability the hidden face is also green?

Count the 6 faces, not the 3 discs: green up-faces are G1, G2 (both from the green/green disc) and G3 (from the mixed disc). Of these 3, the backs of G1 and G2 are green, G3's is yellow. P = 2/3. (The all-green disc shows green twice as often as the mixed one, so seeing green is evidence for it — the naive ½ is wrong.)

**Correct Answer: 0.667**

---

### CP11 — Chip Eleven
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Chain rule + symmetry over draws

#### Condensed
**Q:** 18 chips (1–18) dealt 6/6/6 to A,B,C. Given A drew only odds, P(B drew chip 11)?
**A:** 11 is odd, in A's all-odd hand w.p. 6/9=2/3, so survives w.p. 1/3. Then B takes 6 of remaining 12 → 6/12=1/2. Product = 1/3·1/2 = **1/6 ≈ 0.167**.

#### Verbatim
Players A, B, C draw 6 chips each from 18 numbered 1–18, in order, without replacement. Given A drew only odd-numbered chips, P(B drew chip 11)? (3 d.p.)

9 odd chips. Given A's hand is a uniform 6-of-9 odd subset, chip 11 (odd) is in it w.p. 6/9 = 2/3, so it survives to the bag w.p. 1/3. Given it survived, 12 chips remain and B draws 6, so B takes it w.p. 6/12 = 1/2. Chain rule: (1/3)(1/2) = 1/6 ≈ 0.167.

**Correct Answer: 0.167**

---

### CP12 — Dart Game
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Conditional probability over orderings

#### Condensed
**Q:** 3 i.i.d. dart distances. Given dart 2 is farther than dart 1, P(dart 3 also farther than dart 1)?
**A:** 6 equally-likely rankings; B (2>1) has 3; A∩B (3>1 and 2>1) has 2. P = (2/6)/(3/6) = **2/3**.

#### Verbatim
Tim throws three darts, i.i.d. distances from center. Given the second dart lands farther than the first, probability the third also lands farther than the first?

List the 6 rankings (closest→farthest as positions 1,2,3): 123,132,213,231,312,321. B = "2nd farther than 1st" holds for 123,132,312 → P(B)=3/6. A∩B ("3rd farther than 1st" AND B) = 123,132 → 2/6. P(A|B) = (1/3)/(1/2) = 2/3.

**Correct Answer: 0.67**

---

## Family: Bayes' theorem

*Method: flip the conditional with P(H|E) = P(E|H)P(H) / Σ P(E|Hⱼ)P(Hⱼ). Prior × likelihood, normalized.*

### CP13 — Algorithms
**Company:** Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Bayes over equally-likely sources

#### Condensed
**Q:** Algos A/B/C equally likely; P(2%|A)=4/6, P(2%|B)=4/6, P(2%|C)=0. Given a 2% profit, P(B)?
**A:** P(B|2%) = (4/6)/(4/6+4/6+0) = **1/2**.

#### Verbatim
Three algorithms, each equally likely to be chosen. P(2% profit | A) = 4/6, | B = 4/6, | C = 0. Given the trade returned 2%, probability it was Algorithm B?

P(2%) = (1/3)(4/6 + 4/6 + 0) = 8/18. Bayes: P(B|2%) = [(4/6)(1/3)] / (8/18) = 4/8 = 1/2.

**Correct Answer: 0.5**

---

### CP13b — Athletic Cats
**Company:** Citadel Securities, Jane Street, Mako, SIG, DRW · **Difficulty:** Medium · **Concept:** Bayes (cheer-for-a-loser)

#### Condensed
**Q:** Cats win w.p. 3/4, 3/16, 1/16; you pick one at random and it loses. P(you picked Whiskers, the 3/4 winner)?
**A:** P(pick & lose Whiskers)=(1/3)(1/4)=1/12. P(lose)=(1/3)(1/4+13/16+15/16)=2/3. P = (1/12)/(2/3) = **1/8**.

#### Verbatim
Three cats win with probabilities: Whiskers 3/4, Mittens 3/16, Socks 1/16. You pick one at random to cheer for; it loses. Probability you picked Whiskers?

P(pick Whiskers)=1/3; P(Whiskers loses)=1/4, so joint = 1/12. P(chosen cat loses) = (1/3)(1−3/4) + (1/3)(1−3/16) + (1/3)(1−1/16) = 1/12 + 13/48 + 15/48 = 32/48 = 2/3. P(Whiskers | lost) = (1/12)/(2/3) = 1/8.

**Correct Answer: 0.125**

---

### CP14 — Calf Kicks
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Bayes' theorem

#### Condensed
**Q:** P(lose debut)=0.2, P(calf kicks)=0.3, P(calf kicks | lose)=0.06. P(lose | calf kicks)?
**A:** Bayes: P(A|B) = P(B|A)P(A)/P(B) = 0.06·0.2/0.3 = **0.04**.

#### Verbatim
20% of fighters lose their debut; 30% use calf kicks; among those defeated in debut, 6% use calf kicks. Probability a randomly selected fighter is defeated in debut while using calf kicks?

A=loses debut (0.2), B=uses calf kicks (0.3), P(B|A)=0.06. P(A|B) = P(B|A)P(A)/P(B) = (0.06·0.2)/0.3 = 0.04.

**Correct Answer: 0.04**

---

### CP15 — Engine or Wheels
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Bayes with independent causes; inclusion-exclusion

#### Condensed
**Q:** Break down if engine (15%) or wheels (10%), independent. Given it broke down, P(wheels problem)? (9,000 km is a red herring.)
**A:** P(break)=0.15+0.10−0.015=0.235; P(B|W)=1. P(W|B)=0.10/0.235 ≈ **0.43**.

#### Verbatim
A car is faulty if it breaks down before 15,000 km, due to engine (15%) or wheels (10%), independent. Don's car breaks down after 9,000 km. Probability the wheels are at fault? (2 d.p.)

The 9,000 km just confirms breakdown (event B). P(B|W)=1. P(B)=P(E∪W)=0.15+0.10−0.15·0.10=0.235. Bayes: P(W|B)=1·0.10/0.235 = 20/47 ≈ 0.43.

**Correct Answer: 0.43**

---

### CP16 — Fair or Unfair Coin
**Company:** Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** Bayes' theorem

#### Condensed
**Q:** 2 fair coins (½), 1 biased (4/7). Pick one at random, flip heads. P(biased)?
**A:** P(U|H) = (4/7·1/3)/(4/7·1/3 + 1/2·2/3) = **4/11 ≈ 0.3636**.

#### Verbatim
Two fair coins (P(H)=1/2) and one biased (P(H)=4/7). Pick a coin at random, flip once, get heads. Probability you chose the biased coin?

P(U)=1/3, P(F)=2/3. P(U|H) = (4/7·1/3) / (4/7·1/3 + 1/2·2/3) = 4/11.

**Correct Answer: 0.3636**

---

### CP17 — Fake News
**Company:** Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Easy · **Concept:** Bayes' theorem

#### Condensed
**Q:** 60% fake; fake→80% get ≥500 likes, real→30%. Given ≥500 likes, P(fake)?
**A:** (0.8·0.6)/(0.8·0.6 + 0.3·0.4) = 0.48/0.60 = **0.8**.

#### Verbatim
60% of stories are fake; fake stories get ≥500 likes 80% of the time, real stories 30%. A story has ≥500 likes — probability it's fake?

P(F|L) = (0.8·0.6)/(0.8·0.6 + 0.3·0.4) = 0.48/0.60 = 0.8.

**Correct Answer: 0.8**

---

### CP18 — Liver Disease
**Company:** Da Vinci, Jane Street, DRW · **Difficulty:** Easy · **Concept:** Bayes' theorem

#### Condensed
**Q:** P(liver disease)=0.11, P(alcoholic)=0.23, P(alcoholic | liver)=0.15. P(liver | alcoholic)?
**A:** 0.15·0.11/0.23 ≈ **0.07**.

#### Verbatim
11% of patients have liver disease; 23% are alcoholics; among those with liver disease, 15% are alcoholics. Pick an alcoholic — probability they have liver disease? (2 d.p.)

P(A|B) = P(B|A)P(A)/P(B) = 0.15·0.11/0.23 ≈ 0.07.

**Correct Answer: 0.07**

---

### CP19 — Racing Cars
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Bayes (cheer-for-a-loser)

#### Condensed
**Q:** Cars win w.p. 7/10, 1/5, 1/10; you pick one at random and it loses. P(you picked the slowest, 1/10)?
**A:** P(B|A)=9/10, P(A)=1/3. P(B)=(1/3)(3/10+8/10+9/10)=2/3. P = (9/10·1/3)/(2/3) = **9/20 = 0.45**.

#### Verbatim
Three cars win with probabilities 7/10 (fastest), 1/5, 1/10 (slowest). You pick one at random; it doesn't win. Probability you picked the slowest?

A = picked slowest (P=1/3); B = your car lost. P(B|A) = 9/10. P(B) = (1/3)(3/10 + 8/10 + 9/10) = 2/3. P(A|B) = (9/10·1/3)/(2/3) = 9/20 = 0.45.

**Correct Answer: 0.45**

---

### CP20 — Surprise Headliner
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Bayes' theorem

#### Condensed
**Q:** 90% Lisbon (perform 5%), 10% Porto (perform 55%). Given she performed, P(from Lisbon)?
**A:** P(perform)=0.05·0.9+0.55·0.1=0.1. P(Lisbon|perform)=0.045/0.1 = **0.45**.

#### Verbatim
Nova is in Lisbon w.p. 0.9 (performs w.p. 0.05) or Porto w.p. 0.1 (performs w.p. 0.55). She performs. Probability she came from Lisbon? (2 d.p.)

P(S) = 0.05·0.9 + 0.55·0.1 = 0.045 + 0.055 = 0.1. P(L|S) = 0.045/0.1 = 0.45. (Performing is evidence against Lisbon: 9× more likely a priori but 11× less likely to perform.)

**Correct Answer: 0.45**

---

### CP21 — The Intern Did It
**Company:** Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Bayes with a noisy witness

#### Condensed
**Q:** 1/3 interns, 2/3 full-time; witness 75% accurate names "intern." P(culprit is an intern)?
**A:** P(W)=3/4·1/3 + 1/4·2/3 = 5/12. P(I|W)=(3/4·1/3)/(5/12) = (1/4)/(5/12) = **3/5 = 0.6**.

#### Verbatim
A witness (right 3/4 of the time) says an intern did it. 1/3 of the office are interns, 2/3 full-time; every person was equally likely the culprit a priori. Probability an intern did it?

P(I)=1/3. P(W|I)=3/4, P(W|Iᶜ)=1/4. P(W)=3/4·1/3 + 1/4·2/3 = 3/12 + 2/12 = 5/12. P(I|W) = (3/4·1/3)/(5/12) = (1/4)/(5/12) = 3/5 = 0.6.

**Correct Answer: 0.6**

---

### CP22 — Twice as Likely
**Company:** Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Bayes with ratio-only likelihoods

#### Condensed
**Q:** 50% no plan, 35% light, 15% intensive; qualify rates in ratio 1:2:4. Given qualified, P(intensive)?
**A:** Let no-plan rate p; qualifiers ∝ 0.5p + 0.35·2p + 0.15·4p = 1.8p. P(intensive)=0.6p/1.8p = **1/3** (p cancels).

#### Verbatim
Runners: 50% no plan, 35% light, 15% intensive. Intensive qualify twice as often as light; light twice as often as no plan. Given a member qualified, probability they did the intensive plan? (3 d.p.)

Let P(Q|none)=p, P(Q|light)=2p, P(Q|intensive)=4p. P(Q)=0.5p+0.35·2p+0.15·4p=1.8p. P(I|Q)=0.15·4p/1.8p=0.6/1.8=1/3. The unknown p cancels — only ratios matter.

**Correct Answer: 0.333**

---

### CP23 — Two Blue Gumballs
**Company:** Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Bayes with conditionally-independent draws

#### Condensed
**Q:** Left machine P(blue)=0.3, right P(blue)=0.6; pick one by fair coin, draw 2, both blue. P(left)?
**A:** P(BB|L)=0.09, P(BB|R)=0.36. P(BB)=½·0.09+½·0.36=0.225. P(L|BB)=0.045/0.225 = **0.2**.

#### Verbatim
Left machine draws blue w.p. 0.3, right w.p. 0.6. Flip a fair coin to pick a machine, draw 2 (with replacement effectively — huge machine); both blue. Probability it was the left machine?

Conditionally independent draws: P(BB|L)=0.3²=0.09, P(BB|R)=0.6²=0.36. P(BB)=½·0.09+½·0.36=0.225. P(L|BB)=0.045/0.225=1/5=0.2.

**Correct Answer: 0.2**

---

### CP24 — Which Die Was It
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Bayes' theorem

#### Condensed
**Q:** Fair d4 and fair d6, pick one at random, roll a 2. P(it was the d4)?
**A:** P(2|d4)=1/4, P(2|d6)=1/6. P(d4|2)=(1/4·1/2)/(1/4·1/2+1/6·1/2)=(1/8)/(5/24) = **3/5 = 0.6**.

#### Verbatim
A fair 4-sided die and a fair 6-sided die; pick one at random and roll a 2. Probability the die was the 4-sided one?

P(2|D4)=1/4, P(2|D6)=1/6, priors ½ each. P(2)=1/4·1/2 + 1/6·1/2 = 3/24+2/24 = 5/24. P(D4|2) = (1/8)/(5/24) = 3/5 = 0.6.

**Correct Answer: 0.6**

---

### CP25 — Which Pouch
**Company:** Jane Street, Mako, DRW · **Difficulty:** Easy · **Concept:** Bayes with without-replacement likelihoods

#### Condensed
**Q:** A=8 emeralds, B=8 quartz, C=4 emeralds+4 quartz. Pick one, draw 2 (no replacement), both emeralds. P(A)?
**A:** P(EE|A)=1, P(EE|B)=0, P(EE|C)=(4/8)(3/7)=3/14. P(A|EE)=1/(1+0+3/14)=14/17 ≈ **0.824**.

#### Verbatim
Three pouches: A (8 emeralds), B (8 quartz), C (4 emeralds + 4 quartz). Pick one uniformly, draw 2 without replacement — both emeralds. Probability you picked A? (3 d.p.)

Priors ⅓. P(EE|A)=1, P(EE|B)=0, P(EE|C)=(4/8)(3/7)=3/14. Equal priors → P(A|EE)= 1/(1+0+3/14) = 1/(17/14) = 14/17 ≈ 0.824.

**Correct Answer: 0.824**

---

### CP26 — Painted Cube
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Bayes over cube-piece types

#### Condensed
**Q:** 3×3×3 cube painted outside, split into 27; pick one blindly, see 5 white sides. P(6th also white)?
**A:** Only center cube (6 white) and 6 face-centers (5 white) can show 5 whites. P = [1·1/27]/[1·1/27 + 6·(1/6)·(6/27)] = **1/2**.

#### Verbatim
27 white cubes form a 3×3×3 cube, painted blue outside, then separated. Pick one at random, place blindly; you see 5 white sides. Probability the 6th side is also white?

Only two piece types can show ≥5 white: the 1 center cube (6 white) and the 6 face-center cubes (5 white, 1 blue). P(see 5 | center)=1, P(see 5 | face-center)=1/6 (blue must be hidden). Bayes: P(center | 5 white) = (1·1/27) / (1·1/27 + (1/6)·6/27) = (1/27)/(2/27) = 1/2.

**Correct Answer: 0.5**

---

### CP27 — Second Heads
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Posterior-weighted prediction

#### Condensed
**Q:** 3 coins P(H)=0.2, 0.2, 0.6; draw one, flip heads. P(next flip also heads)?
**A:** P(B|A)=P(A∩B)/P(A). P(A)=10/30, P(A∩B)=(0.04+0.04+0.36)/3=44/300. Ratio = **11/25 = 0.44**.

#### Verbatim
Three coins with P(H) = 0.2, 0.2, 0.6. Draw one at random, flip heads. Probability the next flip (same coin) is also heads?

A = first flip heads, B = second heads. P(A) = (0.2+0.2+0.6)/3 = 10/30. P(A∩B) = (0.2²+0.2²+0.6²)/3 = 0.44/3 = 44/300. P(B|A) = (44/300)/(10/30) = 11/25 = 0.44.

**Correct Answer: 0.44**

---

### CP28 — Unfair Heads #1
**Company:** Citadel Securities, Jane Street, DRW · **Difficulty:** Medium · **Concept:** Bayes over coin pairs

#### Condensed
**Q:** 5 coins, 4 fair + 1 two-headed. Pick 2, flip both, both heads. P(one is the two-headed coin)?
**A:** P(A)=2/5, P(HH|A)=1/2, P(HH|Aᶜ)=1/4. P(A|HH)=(2/5·1/2)/(2/5·1/2+3/5·1/4)=(1/5)/(7/20) = **4/7 ≈ 0.571**.

#### Verbatim
5 coins: four fair, one two-headed. Pick 2 at random, toss both, both heads. Probability one of them is the two-headed coin?

A = one chosen coin is two-headed, P(A) = 1 − (4/5·3/4) = 2/5. P(HH|A) = 1/2 (only the fair coin matters), P(HH|Aᶜ) = 1/4. P(HH) = 2/5·1/2 + 3/5·1/4 = 1/5 + 3/20 = 7/20. P(A|HH) = (1/5)/(7/20) = 4/7 ≈ 0.571.

**Correct Answer: 0.571**

---

### CP29 — Unfair Heads #2
**Company:** Citadel Securities, Jane Street, DRW · **Difficulty:** Medium · **Concept:** Bayes with three-flip evidence

#### Condensed
**Q:** 11 coins, 10 fair + 1 two-headed. Pick one, flip HHH. P(two-headed)?
**A:** P(HHH|fair)=1/8. P(2H|HHH)=(1/11·1)/(1/11·1 + 10/11·1/8)=(1/11)/(9/44) = **4/9 ≈ 0.444**.

#### Verbatim
11 coins: ten fair, one two-headed. Pick one at random, toss three times, get HHH. Probability it's the two-headed coin?

P(A)=1/11, P(HHH|A)=1, P(HHH|fair)=1/8. P(HHH) = 1·1/11 + 1/8·10/11 = 1/11 + 10/88 = 9/44. P(A|HHH) = (1/11)/(9/44) = 4/9 ≈ 0.444.

**Correct Answer: 4/9 ≈ 0.444**

---

## Family: Law of total probability

*Method: condition on an intermediate scenario, P(A) = Σ P(A|Bᵢ)P(Bᵢ).*

### CP30 — Chocolate Transfer
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Law of total probability

#### Condensed
**Q:** Box1: 2 dark, 3 milk. Move one to Box2 (6 dark, 3 milk), then eat one from Box2. P(eats dark)?
**A:** Dark moved (2/5): P(dark)=7/10; milk moved (3/5): P=6/10. Total = 2/5·7/10 + 3/5·6/10 = 32/50 = **0.64**.

#### Verbatim
Box 1: 2 dark, 3 milk. Box 2: 6 dark, 3 milk. Move a random chocolate from Box 1 to Box 2, then eat a random one from Box 2. Probability she eats dark?

Condition on the transferred chocolate. Dark moved (prob 2/5): Box 2 = 7 dark/10 → P=7/10. Milk moved (prob 3/5): 6 dark/10 → P=6/10. Total: 2/5·7/10 + 3/5·6/10 = 14/50 + 18/50 = 32/50 = 0.64.

**Correct Answer: 0.64**

---

### CP31 — One Fair Die
**Company:** Jane Street, Virtu, DRW · **Difficulty:** Easy · **Concept:** Law of total probability; fair die kills the bias

#### Condensed
**Q:** One fair d8, one rigged d8 (P(face k) ∝ k). Roll both. P(sum even)?
**A:** Fair die matches the rigged die's parity w.p. ½ regardless → P(sum even) = **1/2**. (One fair die suffices.)

#### Verbatim
A fair 8-sided die and a rigged 8-sided die (P(face k) ∝ k). Roll both. Probability the sum is even?

Rigged die: P(odd) = (1+3+5+7)/36 = 16/36 = 4/9, P(even) = 5/9. Sum is even iff both dice share parity. Given the rigged die's parity, the fair die matches it w.p. ½ either way. So P(sum even) = ½·(4/9) + ½·(5/9) = ½. The fair die alone balances the parity — bias irrelevant.

**Correct Answer: 0.5**

---

## Family: Continuous conditioning

*Method: for a uniform variable, condition by chopping the interval and rescaling; uniform stays uniform on the survivor.*

### CP32 — Car Wash Countdown
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Conditional probability, continuous uniform (not memoryless)

#### Condensed
**Q:** Wash duration ~ Uniform(2,10) min; still running at 6 min. P(finishes within the next minute)?
**A:** Given T>6, T ~ Uniform(6,10) (4-min window); finishing in the next minute = 1/4 = **0.25**.

#### Verbatim
Wash duration is uniform between 2 and 10 minutes. The car has been inside 6 minutes and is still running. Probability it finishes within the next minute?

P(A|B) = P(6<T≤7)/P(T>6) = (1/8)/(4/8) = 1/4. Equivalently, given T>6 the distribution is uniform on (6,10), a 4-minute window, and finishing in the next minute occupies 1 of those 4 → 0.25. (Uniform is NOT memoryless — as time passes, the 10-min cap makes finishing soon more likely.)

**Correct Answer: 0.25**

---

## Family: Competing events / race conditioning

*Method: ignore trials where neither target occurs; the winner's probability is its share of the deciding trials, a/(a+b). Or set up a first-step recursion.*

### CP33 — Six Before Eleven
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Race between two sums

#### Condensed
**Q:** Roll two dice repeatedly. P(sum 6 before sum 11)?
**A:** Sum-6 has 5 ordered ways, sum-11 has 2. P = 5/(5+2) = **5/7 ≈ 0.714**. (Trap: using unordered pairs gives 0.75.)

#### Verbatim
Mia rolls two dice repeatedly. Probability she rolls a sum of 6 before a sum of 11? (3 d.p.)

Deciding outcomes only: sum 6 = 5 ordered pairs, sum 11 = 2 ordered pairs. P(6 before 11) = 5/(5+2) = 5/7 ≈ 0.714. (Counting unordered pairs — treating {1,5},{2,4},{3,3},{5,6} as equally likely — wrongly gives 3/4.)

**Correct Answer: 0.714**

---

### CP34 — Tie to Win
**Company:** Akuna Capital, IMC, Jane Street, Mako, SIG, DRW · **Difficulty:** Easy · **Concept:** Race with re-roll conditioning

#### Condensed
**Q:** Both roll a d8. Tie → Liam wins; Liam higher → Zoe wins; Zoe higher → reroll. P(Liam wins)?
**A:** Tie = 8/64, Liam-higher = 28/64 (decisive against Liam). P(Liam) = 8/(8+28) = 8/36 = **2/9 ≈ 0.2222**.

#### Verbatim
Zoe and Liam each roll a fair d8. Same value → Liam wins; Liam strictly larger → Zoe wins; Zoe strictly larger → both reroll. Probability Liam wins? (4 d.p.)

64 ordered outcomes: 8 ties (Liam wins), 28 with Liam higher (Zoe wins), 28 with Zoe higher (reroll). Among decisive outcomes, P(Liam) = 8/(8+28) = 8/36 = 2/9 ≈ 0.2222.

**Correct Answer: 0.2222**

---

### CP35 — First to Heads
**Company:** IMC, Jane Street, Virtu, DRW · **Difficulty:** Medium · **Concept:** Conditional over a geometric race

#### Condensed
**Q:** Alice then Bob flip a fair coin alternately; first heads wins. Given Bob won, P(he won on his first toss)?
**A:** P(A)=P(TH)=1/4. P(Bob wins)=1/4+1/16+…=1/3. P(A|B)=(1/4)/(1/3) = **3/4**.

#### Verbatim
Alice flips first, then Bob, alternating; first heads wins. Given Bob won, probability he won on his first toss?

A = Bob wins on his first toss = sequence TH, prob 1/4. B = Bob wins = TH + TTTH + … = (1/4)/(1−1/4) = 1/3. P(A|B) = (1/4)/(1/3) = 3/4.

**Correct Answer: 0.75**

---

### CP36 — Coin Toss #1
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** First-step recursion with role reversal

#### Condensed
**Q:** A, B alternate tossing a fair coin (A first); an HT pattern ends it, the tail-tosser wins. P(A wins)?
**A:** Solve P(A|H)=½(1−P(A|H)) → P(A|H)=1/3; P(A|T)=1−P(A); P(A)=½P(A|H)+½(1−P(A)) → P(A) = **4/9 ≈ 0.444**.

#### Verbatim
Players A and B toss a fair coin in turn (A first). If a head is followed by a tail (HT), the game ends and whoever tossed the tail wins. Probability A wins?

Let P(A|H), P(A|T) be A's win-prob after A's own toss was H, T. If A throws T, B becomes effective first mover: P(A|T)=1−P(A). If A throws H, B wins w.p. ½, else (HH) roles reverse: P(A|H)=½·0+½(1−P(A|H)) → P(A|H)=1/3. Then P(A)=½P(A|H)+½P(A|T)=½·1/3+½(1−P(A)) → P(A)=4/9.

**Correct Answer: 0.444**

---

### CP37 — Parity Race
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** First-step recursion on a repeating state

#### Condensed
**Q:** Maya, then Leo roll a die alternately (Maya first); a player wins the moment their own rolls include both an odd and an even. P(Maya wins)?
**A:** Each alive player wins their next roll w.p. ½. State recursion: p = ½·1 + ¼·0 + ¼·p → p = **2/3 ≈ 0.667**.

#### Verbatim
Maya (first) and Leo alternate rolling a die; each keeps their own record; a player wins the instant their record has both an odd and an even. Probability Maya wins?

Neither can win on roll 1. A still-alive player wins their next roll w.p. ½ (opposite parity). From the state "both alive, Maya to roll": Maya wins immediately (½), Leo wins (½·½ = ¼), or both survive and return to the same state (¼). p = ½·1 + ¼·0 + ¼·p → ¾p = ½ → p = 2/3.

**Correct Answer: 0.667**

---

## Family: Russian Roulette series

*Method: fixed vs re-spun cylinder changes whether shots are dependent (position fixed) or independent (memoryless); condition on survival for the two-bullet variants.*

### CP38 — Russian Roulette #1
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Fixed cylinder → symmetry

#### Condensed
**Q:** 1 bullet, 6 chambers, spun once; two players alternate, no re-spin. Who's safer / P(first player survives)?
**A:** Bullet in {1,3,5} vs {2,4,6} — order doesn't matter, each loses w.p. ½ → first player survives w.p. **0.5**.

#### Verbatim
One bullet in a 6-chamber revolver, spun once, no re-spin. Two players alternate. Who has higher survival, and what's the first player's survival probability?

Once spun, the bullet position is fixed. One player loses if it's in chamber {1,3,5}, the other if {2,4,6}. Symmetric — both lose w.p. 1/2. First player survives w.p. 0.5.

**Correct Answer: 0.5**

---

### CP39 — Russian Roulette #2
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Re-spun cylinder → memoryless recursion

#### Condensed
**Q:** 1 bullet, spun before every pull; two players alternate. Higher survival, and the winner's probability?
**A:** P(P1 shot) = 1/6 + (5/6)·(1−P) → P = 6/11. Second player is safer, surviving w.p. **6/11 ≈ 0.55**.

#### Verbatim
One bullet, cylinder re-spun before every pull. Two players alternate. Who is safer, and with what probability?

Each pull is independent 1/6. P(first player is eventually shot) = 1·1/6 + (1−P)·5/6 → P = 6/11. So player 2 survives w.p. 6/11 ≈ 0.55, higher than player 1.

**Correct Answer: 0.55**

---

### CP40 — Russian Roulette #3
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Compare spin vs no-spin (2 random bullets)

#### Condensed
**Q:** 2 bullets random in 6 chambers; P1 survived; should P2 spin?
**A:** Spin → lose w.p. 2/6 = 1/3. No spin → 2 bullets among the other 5 chambers → 2/5. Since 1/3 < 2/5, **P2 should spin**.

#### Verbatim
Two bullets randomly placed in a 6-chamber revolver. First player survived. Should the second player spin?

Spin: P(lose) = 2/6 = 1/3. No spin: bullets are among the other 5 chambers, so P(lose) = 2/5. 1/3 < 2/5 → spin (keeps loss probability at 1/3).

**Correct Answer: should spin**

---

### CP41 — Russian Roulette #4
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Compare spin vs no-spin (2 consecutive bullets)

#### Condensed
**Q:** 2 bullets in consecutive chambers; P1 survived; should P2 spin?
**A:** No spin: survived → on 1 of 4 empty chambers; only 1 of those is followed by a bullet → survive 3/4. Spin → survive 4/6 = 2/3. Since 3/4 > 2/3, **P2 should NOT spin**.

#### Verbatim
Two bullets in two consecutive chambers. First player survived. Should the second player spin?

No spin: given survival, the hammer was on one of the 4 empty chambers; only one empty chamber is immediately followed by a bullet, so P(survive) = 3/4. Spin: P(survive) = 4/6 = 2/3. Since 3/4 > 2/3, do not spin.

**Correct Answer: should not spin**

---

## Family: Two-child / framing paradoxes

### CP42 — Child's Gender
**Company:** Jane Street, DRW · **Difficulty:** Medium · **Concept:** Conditioning depends on how the information arose

#### Condensed
**Q:** (1) Father of two, at least one son. P(both boys)? (2) Friend of two walking with a daughter. P(both girls)?
**A:** (1) P = P({bb})/P(≥1 boy) = (1/4)/(3/4) = **1/3**. (2) Seeing one specific child is a girl leaves the other independent → **1/2**. Same-sounding, fundamentally different conditioning.

#### Verbatim
(1) A rugby club invites parents with at least one son; a father of two is invited. P(both boys)? (2) A friend of yours has two children; you see him walking with one, a girl. P(both girls)?

Sample space {gg, gb, bg, bb}. (1) B = at least one boy: P(bb | B) = P({bb})/P({bg,gb,bb}) = (1/4)/(3/4) = 1/3. (2) You observed one specific child is a girl; the other child's sex is independent, so P(both girls) = 1/2. The two scenarios differ because the *way* the information is obtained changes the conditioning.

**Correct Answer: (1) 1/3; (2) 1/2**

---

## Family: Multi-stage conditional

### CP43 — Vacant Room
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Hard · **Concept:** Conditional probability over sign-user types

#### Condensed
**Q:** Users: ½ always flip both ways, ¼ ignore the sign, ¼ flip on entry but forget on exit. Room occupied ½ the time. Sign reads "Vacant" — P(actually vacant)?
**A:** P(vacant & "Vacant") = ½·(½/(½+¼)) = 1/3. P("Vacant") includes ignorer-occupied case: 1/3 + 1/12. P = (1/3)/(1/3+1/12) = **4/5 = 0.8**.

#### Verbatim
Phone-room sign users: ½ always switch correctly (Occupied on enter, Vacant on exit); ¼ ignore the sign; ¼ switch to Occupied on enter but forget to switch back on exit. Room is occupied ½ the time. Given the sign reads "Vacant", probability the room is actually vacant?

"Vacant" arises when the last non-ignoring user was a both-ways switcher, AND either the room is truly vacant, or it's occupied by an ignorer. P(both-ways | non-ignoring) = (½)/(½+¼) = 2/3. Truly-vacant contribution = ½·2/3 = 1/3. Occupied-by-ignorer contribution = (½·¼)·2/3 = 1/12. P(vacant | "Vacant") = (1/3)/(1/3 + 1/12) = 4/5.

**Correct Answer: 0.8**

---

## Family: Counterintuitive classics

### CP44 — Monty Hall Problem
**Company:** Jane Street, DRW · **Difficulty:** Easy · **Concept:** Conditioning on the host's constrained action

#### Condensed
**Q:** 3 doors, 1 car; you pick one, host opens a losing door, offers a switch. Should you switch? P(win if switch)?
**A:** Switching wins iff your first pick was wrong → **2/3**. (Not ½ — the host's action carries information.)

#### Verbatim
Three doors, one car. You pick a door; the host (who knows) opens a different door revealing a chicken, then offers a switch. Should you switch? Probability of winning if you switch?

If you initially picked the car (prob 1/3), switching loses; if you initially picked a chicken (prob 2/3), the host reveals the other chicken and switching wins. So switching wins with probability 2/3.

**Correct Answer: 2/3 (switch)**

---

*Last updated: 2026-07-21.*
