# QBank Handoff — Probability & Statistics: Combinatorial Analysis (51 questions)

## How to read this file (for the training pipeline + its AI)

Standalone extract of the **Combinatorial Analysis** subcategory from the master Trading Interview question bank. This is the counting-heavy subcategory: binomial/multinomial coefficients, hypergeometric draws, stars-and-bars, inclusion-exclusion, and lattice-path counting. Almost every answer is exact.

### Entry format
```
### CA{n} — {Title}
**Company:** {firms, or "—" if no firm data} · **Difficulty:** {Easy|Medium|Hard} · **Concept:** {technique}
#### Condensed   <- one-line Q + compact worked A
#### Verbatim    <- question + full worked solution as sourced (OCR math cleaned; site's generic tutorial preambles compressed, all problem-specific steps kept)
**Correct Answer: {value}**
```

### Company tags — how they were produced (READ THIS)
The 11 firm lists were **inverted by a title-keyed script**, not hand-copied. Verification: 51/51 rewritten, 0 title typos, per-firm counts exactly equal the source-list lengths (Akuna 10, CitSec 28, Da Vinci 15, Flow 4, IMC 12, Jane Street 23, Mako 5, Maven 16, SIG 19, Virtu 13, DRW 25).

**⚠ Partial firm data this subcategory.** Unlike earlier subcategories, Jane Street's list here is NOT a superset — it covers only 23 of 51. So **10 questions appear on no firm list and are tagged "—"** (absence of data, not "no firm asks this"):
CA6 Binary Bookends, CA7 Button Tin #1, CA8 Button Tin #2, CA25 Overbooked Flight, CA30 Poker - Full House, CA31 Poker - Two Pair, CA33 Rooftop Drone, CA34 Round Table Jesters, CA38 Starred Watchlist, CA49 Two Tickets.
Treat a "—" tag as unknown, not as a negative signal.

### Answer routing — CRITICAL for training
Most answers are exact numbers in [0,1] → **verifier-checked RL** (rounding tolerance per question). Watch these:

**Integer counts, NOT probabilities** (route to an integer-count verifier; a [0,1] probability checker will wrongly reject them):
| CA | Question | Answer |
|---|---|---|
| CA4 | Air Hockey Deadlock | 504 |
| CA6 | Binary Bookends | 448 |
| CA33 | Rooftop Drone | 13860 |
| CA35 | Running Rabbit | 25 |
| CA38 | Starred Watchlist | 243 |
| CA50 | Unit Steps | 792 |

**Two-part / non-scalar** (SFT or split verification):
| CA | Question | Answer |
|---|---|---|
| CA11 | Democratic Safe | 462 locks **and** 252 keys/person — two integers, grade both |

**Percent-form answers** (source gives a percentage, not a decimal — normalize before scoring): CA29 Poker Four-of-a-Kind (0.024%), CA30 Full House (0.144%), CA31 Two Pair (4.754% — note the master lists the decimal 0.048 as the canonical answer).

**Computed answer (no source solution):** CA2 90 Cents Please was pasted question-only. Its answer 9/14≈0.643 is my computation (any 3-coin grab with the €2 or €1 coin clears 90¢; the six small coins max out at 80¢). Flagged `(computed)` in-line. If you can verify against the source, do — I'm confident but it wasn't source-checked.

### High-value reasoning targets (hard, multi-technique)
CA42 Sum Seventeen and CA46 Three Cards Difference (stars-and-bars + inclusion-exclusion + shift), CA40 Subset Makes Six (complement + double inclusion-exclusion), CA17 How Many Pairs (linearity of expectation with indicators), CA13 Five Deck Straight (multi-deck straight minus straight-flush). These exercise setup, not plug-in — best long-CoT material here.

### Near-duplicate clusters (good for consistency training)
Lights On #1/#2/#3 (line + 0/1/2 free lights), Picking Balls #1/#2/#3 (same urn, escalating), Poker hands #1/#2/#3, Button Tin #1/#2 (specific order vs color-agreement), Specific Card #2/#3 (multi-suit vs single card), Heavier Side / Old Scale (identical balance-scale mechanic, both 0.8), Flipping a Coin #1/#2, Coin Race #2 (pairs with Coin Race #1 in the General subcategory).

### Source-fidelity note
Verbatim blocks keep the source's problem-specific derivation verbatim (OCR math cleaned to readable notation) but compress the site's boilerplate "let's first understand tool X with a tiny example" tutorial preambles that prefaced many solutions. Every equation that does actual work, and every final answer, is preserved. If the coworker wants the full untrimmed tutorial prose for a given question, it's recoverable from the source.

---

# Probability and Statistics — Combinatorial Analysis

> **Note.** 51 questions. Company tags filled by the authoritative title-keyed inversion script from your 11 firm lists. **Important:** these firm lists are *partial* — Jane Street's list here covers only 23 of the 51, so some questions appear on no list at all and are tagged "—" (no firm data provided). Verbatim blocks preserve the source wording with OCR-mangled math cleaned to readable notation and the site's generic "let's first understand tool X" tutorial preambles compressed; every problem-specific derivation step and the final answer are kept intact.
>
> **90 Cents Please (CA2)** was pasted with no solution — its answer is computed and flagged `(computed)`.
>
> Non-probability answers (counts, not in [0,1]): CA4 Air Hockey Deadlock (504), CA6 Binary Bookends (448), CA11 Democratic Safe (462 locks / 252 keys — two-part), CA33 Rooftop Drone (13860), CA35 Running Rabbit (25), CA38 Starred Watchlist (243), CA50 Unit Steps (792). Route these to a separate "integer count" verifier bucket, not the [0,1] probability checker.

## Combinatorial Analysis — index

| ID | Question | Difficulty | Answer |
|---|---|---|---|
| CA1 | 3 Unique Marbles | Easy | 0.2463 |
| CA2 | 90 Cents Please | Medium | 9/14 ≈ 0.643 (computed) |
| CA3 | Aces for All | Easy | 0.105 |
| CA4 | Air Hockey Deadlock | Easy | 504 |
| CA5 | Airplane Food | Easy | 1/35 ≈ 0.029 |
| CA6 | Binary Bookends | Easy | 448 |
| CA7 | Button Tin #1 | Easy | 0.0659 |
| CA8 | Button Tin #2 | Easy | 0.3670 |
| CA9 | Coin Race #2 | Medium | 0.254 |
| CA10 | Dead Batteries | Easy | 0.27 |
| CA11 | Democratic Safe | Medium | 462 locks, 252 keys/person |
| CA12 | Dice Order | Medium | 5/54 ≈ 0.093 |
| CA13 | Five Deck Straight | Medium | 0.0311 |
| CA14 | Flipping a Coin #1 | Easy | 5/16 = 0.3125 |
| CA15 | Flipping a Coin #2 | Medium | 3/5 = 0.6 |
| CA16 | Heavier Side | Medium | 0.8 |
| CA17 | How Many Pairs | Hard | 6/7 ≈ 0.857 |
| CA18 | Lights On #1 | Easy | 1/182 ≈ 0.0055 |
| CA19 | Lights On #2 | Medium | 5/182 ≈ 0.0275 |
| CA20 | Lights On #3 | Hard | 15/182 ≈ 0.0824 |
| CA21 | Max Three Tails | Easy | 21/32 ≈ 0.656 |
| CA22 | Meeting Your Friend | Medium | 70/256 ≈ 0.27 |
| CA23 | More Tails | Easy | 22/64 ≈ 0.344 |
| CA24 | Old Scale | Easy | 0.8 |
| CA25 | Overbooked Flight | Medium | 0.051 |
| CA26 | Picking Balls #1 | Easy | 5/84 ≈ 0.060 |
| CA27 | Picking Balls #2 | Medium | 55/84 ≈ 0.65 |
| CA28 | Picking Balls #3 | Medium | 2/7 ≈ 0.286 |
| CA29 | Poker - Four of a Kind | Easy | 0.024% |
| CA30 | Poker - Full House | Medium | 0.144% |
| CA31 | Poker - Two Pair | Easy | 4.754% ≈ 0.048 |
| CA32 | Rising Chips | Medium | 22/91 ≈ 0.242 |
| CA33 | Rooftop Drone | Easy | 13860 |
| CA34 | Round Table Jesters | Easy | 1/7 ≈ 0.143 |
| CA35 | Running Rabbit | Medium | 25 |
| CA36 | Specific Card #2 | Medium | 0.035 |
| CA37 | Specific Card #3 | Medium | 0.0224 |
| CA38 | Starred Watchlist | Easy | 243 |
| CA39 | Stock Price Coin Flip | Easy | 0.246 |
| CA40 | Subset Makes Six | Hard | 3/4 = 0.75 |
| CA41 | Sum of Primes | Easy | 3/4 = 0.75 |
| CA42 | Sum Seventeen | Hard | 13/162 ≈ 0.0802 |
| CA43 | Sum to 3 | Medium | 7/432 ≈ 0.016 |
| CA44 | Table of Ages | Medium | 1/12 ≈ 0.083 |
| CA45 | Ten Cards, No King | Easy | 246/595 ≈ 0.4134 |
| CA46 | Three Cards Difference | Hard | 528/1105 ≈ 0.478 |
| CA47 | Top Two Dice | Easy | 19/144 ≈ 0.1319 |
| CA48 | Triple Match | Medium | 701/1296 ≈ 0.5409 |
| CA49 | Two Tickets | Easy | 4/9 ≈ 0.444 |
| CA50 | Unit Steps | Easy | 792 |
| CA51 | Wheel of Eights | Medium | 1/8 = 0.125 |

---

## Family: Choose-k ratios (favorable / total combinations)

### CA1 — 3 Unique Marbles
**Company:** Akuna Capital, Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Ratio of combinations, one of each color

#### Condensed
**Q:** Bag: 10 blue, 10 red, 10 yellow. Draw 3 (no replacement). P(all different colors)?
**A:** C(10,1)³ / C(30,3) = 1000/4060 = **0.2463**.

#### Verbatim
A bag has 10 blue, 10 red, 10 yellow marbles. P(first 3 drawn without replacement are all different colors)?

P = favourable/total. Total ways to choose 3 of 30: C(30,3)=30·29·28/6=4060. Favourable (one of each color): C(10,1)·C(10,1)·C(10,1)=10·10·10=1000. P=1000/4060=0.2463.

**Correct Answer: 0.2463**

---

### CA3 — Aces for All
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Distributing 4 aces into 4 hands of 13

#### Condensed
**Q:** Deck dealt to 4 players (13 each). P(each player has an ace)?
**A:** The 4 aces occupy 4 of 52 positions; favourable = 13⁴ (one ace-slot per player). 13⁴/C(52,4)=**0.105**.

#### Verbatim
A shuffled deck is dealt among 4 players, 13 cards each. P(each player has an ace)?

The four aces can occupy any 4 of the 52 positions: C(52,4) placements. Favourable: choose 1 of the 13 slots for each player → 13⁴. P = 13⁴/C(52,4) = 0.105. (Alternative: 4!·48!/(12!⁴) ÷ 52!/(13!⁴) = (52/52)(39/51)(26/50)(13/49) = 0.105.)

**Correct Answer: 0.105**

---

### CA5 — Airplane Food
**Company:** Citadel Securities, Maven · **Difficulty:** Easy · **Concept:** One favorable assignment out of C(7,4)

#### Condensed
**Q:** 4 pasta + 3 curry handed at random to 4 pasta-orderers + 3 curry-orderers. P(everyone gets what they ordered)?
**A:** Choose which 4 of 7 get pasta: C(7,4)=35. Only 1 correct. P=**1/35≈0.029**.

#### Verbatim
Attendant hands out 4 identical pasta and 3 identical curry meals to 7 passengers (4 ordered pasta, 3 curry). P(everyone gets what they ordered)?

Model as choosing which 4 of 7 get pasta: C(7,4)=35 total assignments, exactly 1 favourable. P=1/35≈0.029.

**Correct Answer: 0.029**

---

### CA26 — Picking Balls #1
**Company:** Da Vinci, Maven · **Difficulty:** Easy · **Concept:** P(all same color), disjoint cases

#### Condensed
**Q:** Box: 3 blue, 4 red, 2 white. Draw 3. P(all same color)?
**A:** Only all-blue or all-red possible: (C(3,3)+C(4,3))/C(9,3)=(1+4)/84=**5/84≈0.060**.

#### Verbatim
Box: 3 blue, 4 red, 2 white (9 total). Draw 3 without replacement. P(all three same color)?

Only all-blue or all-red are possible (fewer than 3 whites). P=(C(3,3)+C(4,3))/C(9,3)=(1+4)/84=5/84≈0.060.

**Correct Answer: 0.060**

---

### CA27 — Picking Balls #2
**Company:** Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Exactly two colors via per-pair counts

#### Condensed
**Q:** Box: 3 blue, 4 red, 2 white. Draw 3. P(exactly two colors)?
**A:** Sum over color-pairs, each ≥1 of each: {B,R}:30, {B,W}:9, {R,W}:16 → 55. P=55/C(9,3)=**55/84≈0.65**.

#### Verbatim
Box: 3 blue, 4 red, 2 white. Draw 3. P(sample has exactly two colors)?

Exactly two colors = not all same, not all three. Sum over pairs (at least one of each): {B,R}: C(7,3)−C(3,3)−C(4,3)=35−1−4=30; {B,W}: C(5,3)−C(3,3)=10−1=9; {R,W}: C(6,3)−C(4,3)=20−4=16. Favourable=30+9+16=55. Total C(9,3)=84. P=55/84≈0.655.

**Correct Answer: 0.65**

---

### CA28 — Picking Balls #3
**Company:** Citadel Securities, Da Vinci, Jane Street, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** First all-three-colors seen on draw 4

#### Condensed
**Q:** Urn: 3 blue, 4 red, 2 white. Draw until all 3 colors seen. P(first happens on 4th draw)?
**A:** After 3 draws exactly two colors, 4th is the new color. Sum three missing-color cases: 2/21+4/14+2/54... = **2/7≈0.286**.

#### Verbatim
Urn: 3 blue, 4 red, 2 white. Draw without replacement until all three colors seen. P(first happens on the 4th draw)?

After 3 draws you must have seen exactly two colors, and the 4th is the missing color. Missing blue then blue: [C(6,3)−C(4,3)]/C(9,3)·(3/6)=2/21. Missing red then red: [C(5,3)−C(3,3)]/C(9,3)·(4/6)=1/14. Missing white then white: [C(7,3)−C(3,3)−C(4,3)]/C(9,3)·(2/6)=5/42. (The −C(4,3)/−C(3,3) removes single-color triples.) Sum = 2/21+1/14+5/42 = 12/42 = 2/7 ≈ 0.286.

**Correct Answer: 0.286**

---

### CA41 — Sum of Primes
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Parity: only 2 is even; need to avoid it

#### Condensed
**Q:** Pick 4 of the first 16 primes (no replacement). P(sum even)?
**A:** Only prime 2 is even; sum even ⟺ avoid 2 (four odds). P=C(15,4)/C(16,4)=1365/1820=**3/4**.

#### Verbatim
Randomly select 4 of the first 16 primes without replacement. P(sum even)?

Only one prime (2) is even. Sum of four odds is even; including 2 makes it odd. So sum even ⟺ all four chosen from the 15 odd primes. P=C(15,4)/C(16,4)=1365/1820=3/4.

**Correct Answer: 0.75**

---

### CA45 — Ten Cards, No King
**Company:** Citadel Securities · **Difficulty:** Easy · **Concept:** Hypergeometric, no special card

#### Condensed
**Q:** Deal 10 cards from 52. P(no King)? 4 dp.
**A:** C(48,10)/C(52,10) = (42·41·40·39)/(52·51·50·49) = 246/595 ≈ **0.4134**.

#### Verbatim
Deal 10 cards at random from a 52-card deck. P(hand contains no King)? 4 dp.

C(52,10) total hands; no-King hands built from 48 non-Kings: C(48,10). P=C(48,10)/C(52,10)=42·41·40·39/(52·51·50·49)=246/595≈0.4134. (Equivalently (48/52)(47/51)…(39/43).)

**Correct Answer: 0.4134**

---

### CA49 — Two Tickets
**Company:** — · **Difficulty:** Easy · **Concept:** Count pairs by sum

#### Condensed
**Q:** Ten tickets 1–10; draw two. P(sum ≥ 12)? Exact fraction.
**A:** Total C(10,2)=45. Pairs with sum ≥12 count 20. P=20/45=**4/9**.

#### Verbatim
Bag of tickets 1–10; draw two at once, add them. P(sum ≥ 12)? Exact fraction.

Total C(10,2)=45 equally likely pairs. Count sums ≥12: sum19:1, 18:1, 17:2, 16:2, 15:3, 14:3, 13:4, 12:4 → 1+1+2+2+3+3+4+4=20. P=20/45=4/9≈0.444.

**Correct Answer: 4/9 ≈ 0.444**

---

### CA10 — Dead Batteries
**Company:** Citadel Securities, Da Vinci, Mako, Maven, Virtu, DRW · **Difficulty:** Easy · **Concept:** Hypergeometric, exactly j special

#### Condensed
**Q:** 25 batteries, 5 dead. Grab 6. P(exactly 2 dead)? Nearest hundredth.
**A:** C(5,2)C(20,4)/C(25,6)=10·4845/177100=48450/177100≈**0.27**.

#### Verbatim
Drawer: 25 AA batteries, 5 dead, 20 good. Scoop 6 at random. P(exactly 2 dead)? Nearest hundredth.

Hypergeometric: P(j special)=C(m,j)C(N−m,k−j)/C(N,k). Here N=25, m=5, k=6, j=2: C(5,2)C(20,4)/C(25,6)=10·4845/177100=48450/177100=969/3542≈0.2736 → 0.27.

**Correct Answer: 0.27**

---

## Family: Poker hands (five-card draw)

### CA29 — Poker - Four of a Kind
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Mako, Maven, SIG, Virtu, DRW · **Difficulty:** Easy · **Concept:** Count hands with 4 same + 1

#### Condensed
**Q:** P(four of a kind in a 5-card hand)?
**A:** 13 ranks × 48 remaining cards = 624 hands. 624/C(52,5)=624/2598960=**0.024%**.

#### Verbatim
P(four of a kind in a five-card poker hand)?

Choose the quad rank (13), the 5th card is any of the other 48: 13·48=624 hands. Total C(52,5)=2598960. P=624/2598960=0.024%.

**Correct Answer: 0.024%**

---

### CA30 — Poker - Full House
**Company:** — · **Difficulty:** Medium · **Concept:** Triplet + pair count

#### Condensed
**Q:** P(full house)?
**A:** 13·C(4,3)·12·C(4,2)=13·4·12·6=3744. /2598960=**0.144%**.

#### Verbatim
P(full house in a five-card poker hand)?

Triplet: 13 ranks × C(4,3)=4 suit-combos. Pair: 12 remaining ranks × C(4,2)=6. Count=13·4·12·6=3744. P=3744/2598960=0.144%.

**Correct Answer: 0.144%**

---

### CA31 — Poker - Two Pair
**Company:** — · **Difficulty:** Easy · **Concept:** Two pairs + kicker count

#### Condensed
**Q:** P(two pair)?
**A:** C(13,2)·C(4,2)²·44=78·36·44=123552. /2598960=**4.754%≈0.048**.

#### Verbatim
P(two pair in a five-card draw hand)?

Choose 2 pair-ranks C(13,2), each with C(4,2)=6 suit combos, plus a 5th card from the 44 remaining (52−4·2): C(13,2)·C(4,2)·C(4,2)·44=78·6·6·44=123552. P=123552/2598960=4.754%.

**Correct Answer: 0.048**

---
## Family: Coin/dice sequence counting (binomial)

### CA9 — Coin Race #2
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Binomial tail after conditioning on first flip

#### Condensed
**Q:** 10 flips, first is Tails. P(Heads wins the race)?
**A:** Heads wins unless total tails ≤4, i.e. ≤3 more tails in remaining 9. P(tails lose)=Σ_{k=0}³C(9,k)0.5⁹≈**0.254**.

#### Verbatim
Race of 10 flips, first flip is Tails. P(Heads winning at the end)?

Heads loses only if final tails count is 1–4, i.e. 0,1,2,3 tails among the remaining 9 flips. P(tails lose)=[C(9,0)+C(9,1)+C(9,2)+C(9,3)]·0.5⁹≈0.254. (Under time pressure the last two terms dominate.)

**Correct Answer: 0.254**

---

### CA14 — Flipping a Coin #1
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Longest series = 7; count 3-3 middle

#### Condensed
**Q:** First to 4 points (H→A, T→B). Max flips, and P(it takes that long)?
**A:** Max 7 (ends 4-3). P(X=7)=(1/2)⁶·1·C(6,3)=20/64=**5/16=0.3125**.

#### Verbatim
Two players flip a coin; first to 4 points wins. Max number of flips, and P(it takes this long)?

Longest is 7 flips (a 4-3 finish). The 7th flip decides the winner (2 ways implicit), the first 6 are any arrangement of 3 H and 3 T. P(X=7)=(1/2)⁶·C(6,3)=20/64=5/16=0.3125.

**Correct Answer: 0.3125**

---

### CA15 — Flipping a Coin #2
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Conditioning on fixed first/last flips

#### Condensed
**Q:** First to 4; given first flip H and game ends on 6th flip, P(A won)?
**A:** A: last=H, middle 4 = 2H2T → C(4,2)=6. B: last=T, middle=1H3T → C(4,3)=4. P(A)=6/(6+4)=**3/5=0.6**.

#### Verbatim
First to 4 points. Given the first throw is Heads and the 6th throw ended the game, P(A won)?

If A won: first=H, last=H, middle four = 2H+2T → C(4,2)=6 ways. If B won: first=H, last=T, middle four=1H+3T → C(4,3)=4 ways. P(A)=6/(6+4)=3/5.

**Correct Answer: 0.6**

---

### CA21 — Max Three Tails
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Mako, Virtu · **Difficulty:** Easy · **Concept:** Binomial CDF, symmetry

#### Condensed
**Q:** Flip 6 coins. P(at most 3 Tails)? 3 dp.
**A:** (C(6,0)+C(6,1)+C(6,2)+C(6,3))/64=(1+6+15+20)/64=42/64=**21/32≈0.656**.

#### Verbatim
Flip 6 coins. P(at most 3 Tails)? 3 dp.

X~Bin(6,½), 64 outcomes. P(X≤3)=(1+6+15+20)/64=42/64=21/32≈0.656. (Symmetric around 3, so >½.)

**Correct Answer: 0.656**

---

### CA23 — More Tails
**Company:** Citadel Securities, Da Vinci, Jane Street, Mako, Maven, Virtu, DRW · **Difficulty:** Easy · **Concept:** Binomial upper tail

#### Condensed
**Q:** Flip 6 coins. P(more Tails than Heads)?
**A:** P(T=4,5,6)=(15+6+1)/64=**22/64≈0.344**.

#### Verbatim
Flip 6 coins. P(more Tails than Heads)?

Need 4, 5, or 6 tails. P=(C(6,4)+C(6,5)+C(6,6))/64=(15+6+1)/64=22/64≈0.34375.

**Correct Answer: 0.34375**

---

### CA39 — Stock Price Coin Flip
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Easy · **Concept:** Return to origin, equal H/T

#### Condensed
**Q:** Start $50, ±$1 per coin, 10 days. P(back at $50)?
**A:** Need 5 up 5 down: C(10,5)/2¹⁰=252/1024=**0.246**.

#### Verbatim
Stock at $50; each day ±$1 by coin. P(worth exactly $50 after 10 days)?

Need equal heads and tails (5 each): C(10,5)/2¹⁰=252/1024=0.246.

**Correct Answer: 0.246**

---

### CA50 — Unit Steps
**Company:** DRW · **Difficulty:** Easy · **Concept:** Fixed step counts → binomial coefficient

#### Condensed
**Q:** 12 ±1 steps from 0, ending at +2. How many sequences?
**A:** r+l=12, r−l=2 → r=7, l=5. C(12,7)=**792**.

#### Verbatim
Token at 0 makes 12 ±1 steps, ends at x₁₂=2. How many move sequences?

Let r=#right, l=#left: r+l=12, r−l=2 → r=7, l=5. Count arrangements C(12,7)=792.

**Correct Answer: 792**

---

### CA22 — Meeting Your Friend
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Lattice-path meeting probability

#### Condensed
**Q:** You and friend take shortest opposite-corner routes on a 4×4 grid, ±1 by coin. P(meet)?
**A:** Meet at 5 points, both must reach same point: Σ P(point)² = 2(1/256)+2(16/256)+36/256=**70/256≈0.27**. General: (1/2)^{2n}Σ C(n,i)².

#### Verbatim
You and your friend walk shortest routes toward each other on a 4×4 grid (you: up=H/right=T; friend: down=H/left=T). P(you meet)?

Five possible meeting points on the anti-diagonal. P(reach a point) is binomial: P(A)=P(E)=(1/2)⁴=1/16; P(B)=P(D)=C(4,1)(1/2)⁴=4/16; P(C)=6/16 (from 1=ΣP). You meet at a point iff both reach it: P(meet)=Σ P(pt)²=(1/16)²+(4/16)²+(6/16)²+(4/16)²+(1/16)²=(1+16+36+16+1)/256=70/256≈0.27. General n×n: (1/2)^{2n}·Σ_{i=0}^{n}C(n,i)².

**Correct Answer: 0.27**

---

## Family: Dice sum / order counting

### CA12 — Dice Order
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Strictly increasing = C(6,3)/6³

#### Condensed
**Q:** Roll 3 dice in order. P(strictly increasing)?
**A:** C(6,3)/6³=20/216=**5/54≈0.093**.

#### Verbatim
Three dice rolled one by one. P(strictly increasing values)?

Each set of 3 distinct values has exactly one increasing order: C(6,3)=20 favourable, 6³=216 total. P=20/216=5/54≈0.093. (Or (1·5/6·4/6)·1/3!.)

**Correct Answer: 0.093**

---

### CA43 — Sum to 3
**Company:** Akuna Capital, Citadel Securities, Da Vinci, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Lowest-three sum via ≥3 ones

#### Condensed
**Q:** Roll 4 dice, sum the three lowest. P(sum=3)?
**A:** Need ≥3 ones. C(4,3)(1/6)³(5/6)+C(4,4)(1/6)⁴=7/432≈**0.016**.

#### Verbatim
Roll four dice, take the sum of the three lowest values. P(=3)?

Need at least three 1's. Exactly three 1's (4th anything 2-6): C(4,3)(1/6)³(5/6). Four 1's: (1/6)⁴. Sum=7/432≈0.0162.

**Correct Answer: 0.016**

---

### CA47 — Top Two Dice
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Top-two sum = 12 ⟺ ≥2 sixes

#### Condensed
**Q:** Roll 4 dice, add two highest. P(total=12)? 4 dp.
**A:** =12 ⟺ at least two 6s. P(X≥2), X~Bin(4,1/6)=(150+20+1)/1296=171/1296=**19/144≈0.1319**.

#### Verbatim
Roll 4 dice, take the two highest and add. P(total=12)? 4 dp.

Top two sum to 12 only if both are 6, i.e. at least two 6's. X=#sixes~Bin(4,1/6). P(X≥2)=(C(4,2)5²+C(4,3)5+1)/6⁴=(150+20+1)/1296=171/1296=19/144≈0.1319.

**Correct Answer: 0.1319**

---

### CA48 — Triple Match
**Company:** Citadel Securities · **Difficulty:** Medium · **Concept:** Complement via "at most twice" partitions

#### Condensed
**Q:** Roll 7 dice. P(at least three show the same number)? 4 dp.
**A:** Complement (every value ≤ twice): patterns (2,1⁵)=15120, (2²,1³)=75600, (2³,1)=37800 → 128520. P=1−128520/6⁷=**701/1296≈0.5409**.

#### Verbatim
Roll seven dice. P(at least three of a kind)? 4 dp.

6⁷=279936 outcomes. Complement = every value appears at most twice. Patterns: one pair+5 singles C(6,1)C(5,5)·7!/2!=6·2520=15120; two pairs+3 singles C(6,2)C(4,3)·7!/(2!2!)=15·4·1260=75600; three pairs+1 single C(6,3)C(3,1)·7!/(2!2!2!)=20·3·630=37800. Sum=128520. P(≥3 of a kind)=1−128520/279936=151416/279936=701/1296≈0.5409.

**Correct Answer: 0.5409**

---

### CA42 — Sum Seventeen
**Company:** Akuna Capital, Mako · **Difficulty:** Hard · **Concept:** Stars & bars + inclusion-exclusion (capped)

#### Condensed
**Q:** Roll 4 dice. P(sum=17)? 4 dp.
**A:** Shift yᵢ=xᵢ−1, Σy=13, 0≤y≤5. Count: C(16,3)−4C(10,3)+6C(4,3)=560−480+24=104. P=104/1296=**13/162≈0.0802**.

#### Verbatim
Roll four dice. P(sum of upfaces = 17)? 4 dp.

6⁴=1296. Shift yᵢ=xᵢ−1: y₁+…+y₄=13, 0≤yᵢ≤5. Stars & bars with inclusion-exclusion on the cap 5 (subtract yᵢ≥6): C(16,3)−C(4,1)C(10,3)+C(4,2)C(4,3)=560−480+24=104. P=104/1296=13/162≈0.0802.

**Correct Answer: 0.0802**

---

### CA40 — Subset Makes Six
**Company:** Citadel Securities · **Difficulty:** Hard · **Concept:** Complement + inclusion-exclusion (some subset sums to 6)

#### Condensed
**Q:** Roll 3 dice. P(some non-empty subset sums to exactly 6)?
**A:** Complement (no subset = 6): 54 rolls. P=1−54/216=162/216=**3/4=0.75**.

#### Verbatim
Three dice rolled. P(some non-empty selection of dice sums to exactly 6)?

216 outcomes. Count complement (no die=6, no pair=6, triple≠6). No 6: 5³=125. Remove pairs summing to 6 ({1,5},{2,4},{3,3}) via inclusion-exclusion: |A|=|B|=24, |C|=13, disjoint → 61, leaving 64. Remove triples summing to 6 within survivors ({1,1,4}:3, {1,2,3}:6, {2,2,2}:1)=10 → 54. Favourable=216−54=162. P=162/216=3/4=0.75.

**Correct Answer: 0.75**

---

### CA51 — Wheel of Eights
**Company:** Citadel Securities, IMC, Jane Street · **Difficulty:** Medium · **Concept:** Divisibility-by-8 depends only on last 3 digits

#### Condensed
**Q:** Spin a d6 wheel 21×, concatenate into a 21-digit number. P(divisible by 8)? 3 dp.
**A:** Only last 3 spins matter. 4d₁+2d₂+d₃≡0 mod 8, dᵢ∈{1..6}: 27 valid triples of 216. P=27/216=**1/8=0.125**.

#### Verbatim
Spin a 6-sector wheel (1–6) 21 times, glue into a 21-digit number. P(divisible by 8)? 3 dp.

Divisibility by 8 depends only on the last three digits: 100d₁+10d₂+d₃ ≡ 4d₁+2d₂+d₃ (mod 8). All 6³=216 triples equally likely. Need d₃ even, and count by parity of d₁: even d₁ gives 5 valid (d₂,d₃) pairs, odd d₁ gives 4; 3 even + 3 odd faces → 3·5+3·4=27. P=27/216=1/8=0.125.

**Correct Answer: 0.125**

---

### CA25 — Overbooked Flight
**Company:** — · **Difficulty:** Medium · **Concept:** Binomial tail (no-shows)

#### Condensed
**Q:** 310 tickets, 300 seats, P(no-show)=5%. P(≥1 denied boarding)?
**A:** Denied iff ≤9 no-shows. X~Bin(310,0.05). P=Σ_{k=0}⁹C(310,k)0.95^{310−k}0.05^k≈**0.051**.

#### Verbatim
310 tickets sold, 300 seats, P(no-show)≈5%. P(at least one passenger denied boarding)?

Someone is refused iff fewer than 10 no-show, i.e. X (no-shows) ≤ 9, X~Bin(310,0.05). P(ref)=Σ_{k=0}^{9}C(310,k)0.95^{310−k}0.05^k ≈ 5.1%.

**Correct Answer: 0.051**

---
## Family: Without-replacement sequences / chain rule

### CA7 — Button Tin #1
**Company:** — · **Difficulty:** Easy · **Concept:** Chain rule, specific ordered draw

#### Condensed
**Q:** 6 brass, 9 pearl; draw 4. P(first two brass, last two pearl)? 4 dp.
**A:** (6/15)(5/14)(9/13)(8/12)=16/182≈**0.0659**.

#### Verbatim
Tin: 6 brass, 9 pearl. Draw 4 without replacement. P(first two brass, last two pearl)? 4 dp.

Chain rule: (6/15)(5/14)(9/13)(8/12). Simplify: =16/182≈0.0659.

**Correct Answer: 0.0659**

---

### CA8 — Button Tin #2
**Company:** — · **Difficulty:** Easy · **Concept:** Exchangeability; first pair and last pair agree in color

#### Condensed
**Q:** 6 brass, 9 pearl; draw 4. P(first two and last two agree in colors, any order)? 4 dp.
**A:** All-brass 1/91 + all-pearl 6/65 + 4×mixed(16/182)=125/455+42/455=167/455≈**0.3670**.

#### Verbatim
Tin: 6 brass, 9 pearl. Draw 4 without replacement. P(first pair and last pair carry the same colors, order within pairs irrelevant)? 4 dp.

By exchangeability, prob depends only on color counts. Qualifying: both pairs BB → BBBB: 6·5·4·3/32760=1/91; both PP → PPPP: 9·8·7·6/32760=6/65; both mixed → 4 sequences each with 2B2P, prob 6·5·9·8/32760=16/182 each, total 24/91. Sum=1/91+24/91+6/65=25/91+6/65=125/455+42/455=167/455≈0.3670.

**Correct Answer: 0.3670**

---

### CA32 — Rising Chips
**Company:** Citadel Securities · **Difficulty:** Medium · **Concept:** Non-decreasing draw, split by tie-pattern

#### Condensed
**Q:** 15 chips (three each of 1–5). Draw 3. P(non-decreasing)? 3 dp.
**A:** By handful type: all-diff 270×(1/6), one-pair 180×(1/3), triple 5×1 → (45+60+5)/455=110/455=**22/91≈0.242**.

#### Verbatim
Jar: three chips each of 1,2,3,4,5 (15 total). Draw 3 one at a time. P(values come out non-decreasing)? 3 dp.

The naive 1/3!=1/6 undercounts because ties allow extra orders. Split by handful: all three values different — 270 handfuls, fraction non-decreasing 1/6; exactly two equal — 180 handfuls, fraction 1/3; all three equal — 5 handfuls, fraction 1. P=(270·1/6+180·1/3+5·1)/455=(45+60+5)/455=110/455=22/91≈0.242.

**Correct Answer: 0.242**

---

### CA36 — Specific Card #2
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Reduce to relevant ranks; ordered arrangement

#### Condensed
**Q:** Deal until a 7 appears. P(exactly one K, one Q, one J before it)?
**A:** Consider only {K,Q,J,7}=16 cards. Favourable 3!·4⁴, total 16·15·14·13. ≈**0.035**.

#### Verbatim
Deal cards one by one until a 7. P(exactly one King, one Queen, one Jack appear before the 7)?

Ignore all other cards. Among {K,Q,J,7} there are 16 cards (4 each). First three = one each of K,Q,J in any order (3!), 4th = a 7; each rank has 4 suits → 3!·4⁴ favourable orderings; total 16·15·14·13. P=3!·4⁴/(16·15·14·13)≈0.035.

**Correct Answer: 0.035**

---

### CA37 — Specific Card #3
**Company:** Citadel Securities, Jane Street, SIG, DRW · **Difficulty:** Medium · **Concept:** Same as #2 but single target card

#### Condensed
**Q:** Deal until the 7♥ appears. P(exactly one K, one Q, one J before it)?
**A:** {K,Q,J,7♥}=13 cards. 3!·4³ / (13·12·11·10) ≈ **0.0224**.

#### Verbatim
Deal until the seven of Hearts appears. P(exactly one K, one Q, one J before it)?

Consider {K,Q,J,7♥}: 13 cards (4 each K/Q/J + single 7♥). Favourable 3!·4³ (K,Q,J each 4 suits, 7♥ fixed); total 13·12·11·10. P=3!·4³/(13·12·11·10)≈0.0224.

**Correct Answer: 0.0224**

---

### CA13 — Five Deck Straight
**Company:** Jane Street, DRW · **Difficulty:** Medium · **Concept:** Count straights minus straight flushes, multi-deck

#### Condensed
**Q:** 5 decks (260 cards) shuffled; draw 3. P(three-card straight, not all same suit)? 4 dp.
**A:** 12 rank-runs; each rank has 20 copies → 20³=8000, minus 4·5³=500 flushes = 7500. ×12=90000. /C(260,3)=90000/2895620≈**0.0311**.

#### Verbatim
Five 52-card decks combined (260 cards). Draw 3 without replacement. P(three consecutive ranks, Ace low or high, not a straight flush)? 4 dp.

Total C(260,3)=2895620. 12 valid rank sequences (A-2-3 up to Q-K-A). Each rank has 4·5=20 copies: 20³=8000 hands per sequence; subtract straight flushes 4·5³=500 → 7500. ×12=90000. P=90000/2895620≈0.0311.

**Correct Answer: 0.0311**

---

## Family: Balance-scale symmetry

### CA16 — Heavier Side
**Company:** IMC, Maven, SIG, DRW · **Difficulty:** Medium · **Concept:** Symmetry + pair-sum threshold

#### Condensed
**Q:** Weights 101–106, 3 per pan. P(106 on the heavier side)?
**A:** Fix 106 on a side with 2 of {101..105}: need sum of the two > 204.5. 8 of 10 pairs. P=**4/5=0.8**.

#### Verbatim
Six distinct weights 101–106, three per pan. P(the 106-block's pan is heavier)?

Fix 106 with 2 of the other 5: C(5,2)=10 splits. 106's side heavier iff 106+ΣX > 515−ΣX ⟺ ΣX > 204.5. Of the 10 pairs, 8 exceed 204.5. P=8/10=4/5=0.8.

**Correct Answer: 0.8**

---

### CA24 — Old Scale
**Company:** IMC · **Difficulty:** Easy · **Concept:** Same as Heavier Side (duplicate mechanic)

#### Condensed
**Q:** Blocks 101–106, 3 per pan. P(106's pan heavier)?
**A:** 106 lighter only for pairs (101,102),(101,103); 8 of 10 make it heavier. P=**4/5=0.8**.

#### Verbatim
Six distinct blocks 101–106 placed 3 per pan. P(the pan with 106 is heavier)?

C(5,2)=10 ways to pick 106's two companions. 106's side lighter iff x+y < 204.5, only (101,102) and (101,103). So 8/10 make it heavier: P=4/5=0.8.

**Correct Answer: 0.8**

---

### CA17 — How Many Pairs
**Company:** Citadel Securities, IMC, Jane Street, SIG, DRW · **Difficulty:** Hard · **Concept:** Linearity of expectation with indicators

#### Condensed
**Q:** 8-card deck (two each of 10,J,Q,K); deal 4. Expected number of pairs?
**A:** Per rank P(both in hand)=C(2,2)C(6,2)/C(8,4)=15/70=3/14. E[X]=4·3/14=**6/7≈0.857**.

#### Verbatim
Deck: two 10s, two Js, two Qs, two Ks. Deal 4. Expected number of pairs?

Indicator I_r=both copies of rank r in hand. P(I_r=1)=C(2,2)C(6,2)/C(8,4)=15/70=3/14. E[X]=Σ_r E[I_r]=4·3/14=12/14=6/7≈0.857.

**Correct Answer: 0.857**

---

## Family: Grid / lattice-line counting

### CA18 — Lights On #1
**Company:** Da Vinci · **Difficulty:** Easy · **Concept:** Count lines / C(16,4)

#### Condensed
**Q:** 4×4 grid, turn on 4 random lights. P(they form a full row/col/diagonal)?
**A:** 4+4+2=10 lines. 10/C(16,4)=10/1820=**1/182≈0.0055**.

#### Verbatim
4×4 array; turn on 4 random lights. P(they form a straight line — row, column, or diagonal)?

Lines: 4 rows + 4 cols + 2 diagonals = 10. Total C(16,4)=1820. P=10/1820=1/182≈0.0055.

**Correct Answer: 0.0055**

---

### CA19 — Lights On #2
**Company:** Da Vinci · **Difficulty:** Medium · **Concept:** Line + 1 free light

#### Condensed
**Q:** 4×4 grid, 5 random lights. P(some 4 form a line)?
**A:** 10 lines × 12 remaining positions = 120. /C(16,5)=120/4368=**5/182≈0.0275**.

#### Verbatim
4×4 array; turn on 5 lights. P(4 of them form a line)?

10 lines, 5th light in any of 16−4=12 spots → 10·12=120. Total C(16,5)=4368. P=120/4368=5/182≈0.0275.

**Correct Answer: 0.0275**

---

### CA20 — Lights On #3
**Company:** Da Vinci · **Difficulty:** Hard · **Concept:** Line + 2 free lights

#### Condensed
**Q:** 4×4 grid, 6 random lights. P(some 4 form a line)?
**A:** 10 × C(12,2)=10·66=660. /C(16,6)=660/8008=**15/182≈0.0824**.

#### Verbatim
4×4 array; turn on 6 lights. P(4 of them form a line)?

10 lines, remaining 2 lights among 12 spots → 10·C(12,2)=660. Total C(16,6)=8008. P=660/8008=15/182≈0.0824.

**Correct Answer: 0.0824**

---

### CA33 — Rooftop Drone
**Company:** — · **Difficulty:** Easy · **Concept:** Multinomial (lattice paths in 3D)

#### Condensed
**Q:** Monotone moves from (0,0,0) to (6,4,2), one unit per step. How many routes?
**A:** 12!/(6!4!2!)=**13860**.

#### Verbatim
Drone moves +1 in E/N/U only, from (0,0,0) to (6,4,2). How many routes?

Route = string of 6 E, 4 N, 2 U (12 moves). Count = 12!/(6!4!2!)=13860.

**Correct Answer: 13860**

---

### CA35 — Running Rabbit
**Company:** Akuna Capital, Citadel Securities, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Alternating step sizes, case split

#### Condensed
**Q:** A(0,0)→B(13,4), up/right only, alternating steps 1,3,1,3,… How many ways?
**A:** Must start with a 1-move (five 1s, four 3s = 17). Up=four 1s: C(5,4)=5; or one 1 + one 3: C(5,1)C(4,1)=20. Total **25**.

#### Verbatim
Rabbit A(0,0)→B(13,4), moves up/right, alternating 1-unit and 3-unit steps. How many ways?

Sum of magnitudes=17, so the sequence is 1+3+1+3+1+3+1+3+1 (starts with a 1). Up-moves total 4: either four 1-unit ups → C(5,4)=5; or one 1-unit + one 3-unit up → C(5,1)C(4,1)=20. Total 5+20=25.

**Correct Answer: 25**

---

## Family: Circular / arrangement counting

### CA44 — Table of Ages
**Company:** Flow Traders, Virtu, DRW · **Difficulty:** Medium · **Concept:** Circular arrangements, ascending both directions

#### Condensed
**Q:** 5 people, distinct ages, round table. P(ages ascending clockwise or counterclockwise)?
**A:** 10 favourable of 5!=120 → 1/12. (Or circular: 2/(5!/5)=2/24.) **1/12≈0.083**.

#### Verbatim
Five people, all different ages, at a round table. P(seated in ascending age order clockwise or counterclockwise)?

5!=120 seatings. 10 are ascending (5 rotations clockwise + 5 counterclockwise). P=10/120=1/12. (Or: circular arrangements 5!/5=24, times 2 directions → 2/24=1/12.)

**Correct Answer: 0.083**

---

### CA34 — Round Table Jesters
**Company:** — · **Difficulty:** Easy · **Concept:** Gap method; choose occupied gaps

#### Condensed
**Q:** 15 knights in a circle, 9 jesters join gaps (≤1 per gap). P(Lancelot keeps both knight-neighbors)?
**A:** His 2 flanking gaps must stay empty: C(13,9)/C(15,9)=715/5005=**1/7≈0.143**.

#### Verbatim
15 knights in a circle (15 gaps), 9 jesters fill distinct gaps. P(Sir Lancelot still between two knights)? 3 dp.

Arrangement ≡ choosing 9 of 15 gaps: C(15,9)=5005. Lancelot keeps both knight-neighbors iff both his flanking gaps stay empty → choose 9 from the other 13: C(13,9)=715. P=715/5005=1/7≈0.143.

**Correct Answer: 0.143**

---

### CA46 — Three Cards Difference
**Company:** Citadel Securities, Jane Street · **Difficulty:** Hard · **Concept:** Stars & bars with gap constraints, then suits

#### Condensed
**Q:** Draw 3 cards (A=1..K=13). P(all three values differ by ≥2)? 3 dp.
**A:** Gap model: a′+s′+t′≤8 → C(11,3)=165 value-triples. ×4³ suits=10560. /C(52,3)=10560/22100=**528/1105≈0.478**.

#### Verbatim
Three cards from a deck (A=1,…,K=13). P(the three values pairwise differ by at least 2)? 3 dp.

Sorted values a<b<c with b−a≥2, c−b≥2. Shift to a′,s′,t′≥0: a′+s′+t′≤8 → with slack, C(11,3)=165 value-triples. Each value has 4 suit choices: ×4³=64. Favourable hands=165·64=10560. Total C(52,3)=22100. P=10560/22100=528/1105≈0.4778.

**Correct Answer: 0.478**

---

## Family: Multiplication principle (independent choices)

### CA38 — Starred Watchlist
**Company:** — · **Difficulty:** Easy · **Concept:** 3 options per element → 3ⁿ

#### Condensed
**Q:** 5 tickers, each off / plain / starred. How many watchlists?
**A:** 3 choices per ticker: 3⁵=**243**.

#### Verbatim
Maya builds a watchlist from 5 tickers; each ticker is left off, added plain, or added starred. How many possible watchlists?

Each of the 5 tickers has 3 independent options. Total = 3⁵ = 243.

**Correct Answer: 243**

---

### CA6 — Binary Bookends
**Company:** — · **Difficulty:** Easy · **Concept:** Inclusion–exclusion on fixed-bit strings

#### Condensed
**Q:** 10-bit strings starting with "11" OR ending with "00". How many?
**A:** |A|=2⁸, |B|=2⁸, |A∩B|=2⁶. 256+256−64=**448**.

#### Verbatim
How many 10-bit binary strings begin with "11" or end with "00" (or both)?

A=starts 11 (8 free bits)=256; B=ends 00 (8 free)=256; A∩B (first two + last two fixed, 6 free)=64. |A∪B|=256+256−64=448. (Check: complement 1024·(3/4)(3/4)=576, and 1024−576=448.)

**Correct Answer: 448**

---

### CA4 — Air Hockey Deadlock
**Company:** Maven · **Difficulty:** Easy · **Concept:** Must pass 5-5, then two-stage count

#### Condensed
**Q:** First to 6 unless 5-5 (then win by 2). How many goal sequences reach 6-6?
**A:** Must hit 5-5: C(10,5)=252 ways. From 5-5 to 6-6: the trailer must score next → 2 ways. 252·2=**504**.

#### Verbatim
First to 6 goals wins, unless 5-5 is reached (then need a 2-goal lead). How many goal-by-goal sequences reach 6-6?

Any 6-6 path must pass through 5-5. Stage 1 (0-0 to 5-5): strings of 5 F and 5 L, C(10,5)=252 (none end early). Stage 2 (5-5 to 6-6): only 2 orders (whoever falls behind must score next). Total=252·2=504.

**Correct Answer: 504**

---

### CA11 — Democratic Safe
**Company:** Flow Traders, Virtu, DRW · **Difficulty:** Medium · **Concept:** Threshold secret-sharing via combinations

#### Condensed
**Q:** 11 friends, majority (6) must open. Min locks? Keys per person?
**A:** Every 5-subset must miss a lock the other 6 hold: C(11,6)=462 locks. Each lock's 6 keys spread over 462·6/11=**252 keys/person**.

#### Verbatim
11 friends; only a majority (≥6) together can open the safe. Minimum number of locks, and keys per person?

Any group of 5 must be blocked by some lock none of them holds, which the other 6 must all hold. So one lock per 6-subset: C(11,6)=462 locks. Each lock has 6 keys (given to its 6-member group); total 462·6 keys spread over 11 people = 462·6/11 = 252 keys each.

**Correct Answer: 462 locks; 252 keys per person**

---

## Family: Coin-grab value threshold

### CA2 — 90 Cents Please
**Company:** Akuna Capital, Citadel Securities, Da Vinci, Flow Traders, IMC, Jane Street, Maven, SIG, Virtu, DRW · **Difficulty:** Medium · **Concept:** Count 3-coin grabs meeting a value threshold

#### Condensed
**Q:** Coins {200,100,50,20,10,5,2,1}¢, one each. Grab 3. P(total ≥ 90¢)? *(no source solution — computed)*
**A:** Any grab with the 200¢ or 100¢ coin clears 90¢; none from the six small coins can (max 50+20+10=80). Grabs containing €2 or €1: C(8,3)−C(6,3)=56−20=36. P=36/56=**9/14≈0.643**.

#### Verbatim
Viktor needs 90 cents. Pocket has one each of: 200, 100, 50, 20, 10, 5, 2, 1 (cents). He grabs 3 random coins. P(total ≥ 90 cents)?

*(Source pasted no solution. Computed:)* Total grabs C(8,3)=56. The three largest small coins sum to 50+20+10=80 < 90, so a grab clears 90¢ iff it contains the 200¢ or the 100¢ coin. Grabs with neither big coin: C(6,3)=20. Favourable=56−20=36. P=36/56=9/14≈0.643.

**Correct Answer: 9/14 ≈ 0.643 (computed — no source answer)**

---

*Last updated: 2026-07-22.*
