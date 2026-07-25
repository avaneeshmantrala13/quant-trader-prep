# Brain Teasers batch — datasets 3–8 (integrate into the Brainteasers flashcard tab)

Pipeline: understand the technique/logic of each puzzle → generate NEW flashcards that exercise
the SAME technique (do NOT reuse the originals verbatim) → each flashcard has a clear prompt,
exact answer, and a strong explanation that names the principle → verify all arithmetic (and, for
parametric families, wire an exact solver + generator so they can be produced infinitely) → add
to the site as flashcards (the Brainteasers tab is integrity-based flashcards, NO multiple choice).

Answer routing note from source: MANY of these are strategy/reasoning answers (not scalars) — they
map perfectly to the integrity-based flashcard format (reveal answer + explanation; user self-marks).

===============================================================================
## DATASET 3 — Brain Teasers: Modular (2)  [parity / mod-k checksum broadcast]
===============================================================================
Both are prisoners-in-a-line hat puzzles; the back prisoner broadcasts a parity/modular checksum.
Answers are STRATEGY + survival guarantee (not scalars).
- BM1 Prisoner Problem #1 (2 colors, mod 2): back prisoner says color encoding parity of red hats
  he sees; each forward prisoner updates running parity to deduce own hat. → 99 saved for certain;
  back prisoner survives w.p. 1/2.
- BM2 Prisoner Problem #2 (10 colors, mod 10): assign colors 0–9; back prisoner announces (Σ of 99
  visible values) mod 10 as a color; each forward prisoner subtracts visible + already-spoken values.
  → 99 saved for certain; back prisoner dies 9/10.
Generalization pair mod2→mod10; the key idea: one shared checksum bit carries info for everyone ahead.

===============================================================================
## DATASET 4 — Brain Teasers: Simplification (3)  [reduce to base case + induction]
===============================================================================
- BS1 How Many Twos (writing 1..10000, count 2s) = 4000. 1–10:1, 1–100:20, 1–1000:300, 1–10000:4000
  (each order of magnitude ×10 and the "2xx.."/"2xxx.." block adds a full extra set). INTEGER.
- BS2 Pirates Dividing a Treasure (5 ranked pirates, 100 coins, ≥50% to pass) = 98. Backward
  induction: 2p→{100}; 3p→{99,0,1}; 4p→{99,0,1,0}; 5p→{98,0,1,0,1} (bribe those who get 0 next game).
  Senior keeps 98. INTEGER.
- BS3 Tigers vs. Sheep (100 tigers,1 sheep; a tiger that eats becomes the sheep) → sheep SURVIVES.
  Parity induction: even #tigers ⟹ survives, odd ⟹ dies; 100 even → survives. REASONING answer.

===============================================================================
## DATASET 5 — Brain Teasers: Summation (4)  [triangular number Σi=N(N+1)/2]
===============================================================================
- BU1 Clock Parts: break clock into 3 pieces, equal number-sums. Σ1..12=78 → each 26:
  {11,12,1,2},{9,10,3,4},{5,6,7,8}. PARTITION answer.
- BU2 Coin Imbalance: 10 bags, 9 have 10g coins, 1 off (9g or 11g); ONE weighing. Take i coins from
  bag i (Σ=55, expect 550g); deviation magnitude = bag #; sign tells 9g vs 11g. STRATEGY answer.
- BU3 House of Cards (100-story) = 15050. Rows 100..1 → Σ=5050 houses; 3 cards each minus 100 shared
  floor cards: 3·5050-100=15050. INTEGER.
- BU4 Two Glass Balls (2 balls, 100 floors, worst-case min drops) = 14. Decreasing step size:
  N(N+1)/2 ≥ 100 → N=14. INTEGER.

===============================================================================
## DATASET 6 — Brain Teasers: Pigeonhole Principle (8)
===============================================================================
Two shapes: guaranteed-collision (yes + argument) and smallest-k worst-case threshold
(k = (largest selection avoiding property)+1; or "≥m per box": k=boxes·(m-1)+1).
- BP1 Catching Ants: 51 ants on 1×1 table, 1/5×1/5 card → 25 cells, ⌈51/25⌉=3 → YES cover ≥3.
- BP2 Coins in Boxes: 61 coins, 15 boxes, win if a box >4 → 15·4=60<61 → guaranteed, P=1.
  (NOTE: distinct from a same-titled ProbStat/Combinatorial question with 76 coins/>5.)
- BP3 Handshakes: 11 people, handshake counts 1–10 (0 impossible) → 10 values, 11 people → YES a tie.
- BP4 Locker Quota: keys 1–30, guarantee a multiple of 3 → 20 non-multiples +1 = 21.
- BP5 Pair of Socks: 100 black+100 white, guarantee a same-color pair → 3.
- BP6 Shared Birthday: guarantee a month with ≥7 → 6·12+1 = 73.
- BP7 Sharing a Sign: 12 zodiac signs, guarantee two share → 12+1 = 13.
- BP8 Wristband Pairs: 1–60, match = sum 61 → 30 complementary pairs; 30+1 = 31 (general N/2+1).

===============================================================================
## DATASET 7 — Brain Teasers: Logical (44)  [canonical lateral quant puzzles]
===============================================================================
Truth-tellers, measuring/timing, river-crossing, parity/invariants, combinatorial games,
number/word puzzles, clock/calendar, motion. Many are non-scalar (strategy / two-part / word/day);
these fit the flashcard format. Clean integers noted.

| ID | Title | Diff | Answer |
|---|---|---|---|
| LG1 | Back to Starting Point | Med | Infinitely many points (South Pole + sub-mile-circle latitudes) |
| LG2 | Bag with Shapes | Easy | 40 |
| LG3 | Birthday Puzzle #1 | Med | July 14 (Cheryl's-birthday deduction) |
| LG4 | Birthday Puzzle #2 | Hard | 20 (truth-to-older/lie-to-younger + integer) |
| LG5 | Bricks in a Box | Easy | No — max 52 (1×1×4 in 6×6×6; 2×2×2 dead corner) |
| LG6 | Burning Cords | Easy | Rope1 both ends + rope2 one end; at 30min light rope2 2nd end → 15 |
| LG7 | Cheesy Choice | Easy | 3-3-2 weighing strategy (heavier of 8 in 2 weighings) |
| LG8 | Clocks and Hands | Med | ≈1:05:27 (65 5/11 min); 22×/day |
| LG9 | Coded Message | Easy | DHBN (alternating +1/-1 Caesar) |
| LG10 | Connected Cogs | Easy | Clockwise (odd cog #) |
| LG11 | Covering a Chessboard | Easy | No (mutilated board color parity 32 vs 30) |
| LG12 | Crossing the River | Easy | 17 min (torch-and-bridge; send two fastest back) |
| LG13 | Crossing The Tunnel | Easy | 26 min (times 4,5,6,7) |
| LG14 | Digital Clock Palindrome | Easy | 28 min (23:32→00:00) / 4h11m (05:50→10:01) |
| LG15 | Drunk Passenger | Med | 0.5 (symmetry: last seat is #1 or #100) |
| LG16 | Farmers' Land | Med | Split scheme (0.35/0.35/0.3 + four 0.25s), min piece 0.25 |
| LG17 | First Person to Say 50 | Med | Start, say 5, then hold 16,27,38,49 (mod 11) |
| LG18 | Fishermen | Hard | 25 (nested throw-1/take-⅓ recurrence a=27l+25) |
| LG19 | Fox vs. Duck | Med | Yes duck escapes (spiral to r/4 then dash; 3r<πr) |
| LG20 | Horse Race | Med | 7 (top-3 of 25 in 5 lanes) |
| LG21 | Impossible Sudoku | Med | 6 (four 1s + one 2 forcing contradiction) |
| LG22 | Knights and Knaves | Easy | A knave, B knight |
| LG23 | Kobolds | Med | Insert each at the color boundary (invariant) |
| LG24 | Multiplier | Easy | 268 (smallest number with digit product 96) |
| LG25 | Picnic with Colleagues | Easy | Tina (constraint seating) |
| LG26 | Rabbit Climbing the Stairs | Easy | Fibonacci |
| LG27 | Random Turns | Easy | 50% after 10 turns / 0% after 57 (parity N/S vs E/W) |
| LG28 | Salary Voting | Med | 63 (iterated majority-halving) |
| LG29 | Sandglass | Med | 9 min via 4&7 flips |
| LG30 | Sharing the Woods | Easy | Jasper $7, Lars $4 (contribution 7:4) |
| LG31 | Smallest Number to 10,000 | Med | 255558 (digit product 10000=2⁴·5⁴) |
| LG32 | Subset of Numbers | Hard | {11,13,17,19,23,25,27,28,29} (max-sum pairwise coprime 1–30) |
| LG33 | Tennis Match Mystery | Hard | Catelyn (winner-stays parity; 17 matches; Luuk plays evens & loses) |
| LG34 | The Last Ball | Med | Blue (even reds) / Red (odd, 21) — red-parity invariant |
| LG35 | The Last Chocolate Game | Hard | First player wins (Wythoff safe pairs; (25,35)→(16,26)) |
| LG36 | Trailing Zeros | Med | 24 (factors of 5 in 100!: 20+4) |
| LG37 | Trains and a Bee | Easy | 125 mi (closing 20mph → 5h; bee 25·5) |
| LG38 | Transfer 3000 Apples | Hard | 833 (jeep/exploration; 3 trips→2 trips→1 trip) |
| LG39 | Waiting for the Train | Med | Offset timetables (Anne ~1 min before → 9:1) |
| LG40 | Water and Wine | Easy | Equal (volume-conservation invariant) |
| LG41 | Water Jugs | Med | 4 L via 3&5 fill/pour sequence |
| LG42 | Watermelon | Easy | 50 lb (fixed dry mass; 99%→98%) |
| LG43 | Weighing Blocks | Easy | 6 (powers of two 1,2,4,8,16,32 → 1–63⊇1–35) |
| LG44 | Which Day | Hard | Wednesday (nested day-offset parsing) |

High-value long-CoT targets: Drunk Passenger (symmetry→½), Fox vs Duck (r/4 pursuit), Horse Race
(7), Wythoff (Last Chocolate), Fishermen (25), Transfer 3000 Apples (833), Birthday #1/#2, Tennis
Match Mystery, Salary Voting (63), Watermelon (50, classic trap).

===============================================================================
## DATASET 8 — Brain Teasers: Symmetry (5)  [invariant / pairing / mirror]
===============================================================================
- SY1 100 Light Bulbs (person k toggles multiples of k) = 10. Only perfect squares have an odd
  divisor count → stay ON. Squares ≤100: 1,4,9,...,100 = 10. INTEGER.
- SY2 Blind Sorting: 120 coins, 20 tails, in the dark → make two piles with equal tails. Split off
  any 20; if it has X tails, other 100 has 20-X; flip the 20-pile → it shows 20-X → equal. STRATEGY.
- SY3 Casino's Offer: draw pairs (BB→you, RR→dealer, mixed→discard); more cards wins $100. 26R=26B,
  discard has equal R&B → your blacks always equal dealer's reds → always tie → dealer wins → worth $0.
  EV/invariant reasoning answer.
- SY4 Last Penny: round table, alternate placing non-overlapping pennies, can't move = lose, you
  first → play the CENTER, then MIRROR opponent through center → first player wins. STRATEGY.
- SY5 Unfair Coin (P(tails)=3/5) → fair 50-50 via von Neumann: flip twice, HT=you, TH=friend,
  HH/TT=redo (HT and TH each have prob p·q). NAMED technique.

===============================================================================
## Parametrizable families (wire exact solver + flashcardGenerator for infinite verified variety)
===============================================================================
- Summation triangular (BU3 House of Cards; BU4 Two Glass Balls N s.t. N(N+1)/2≥floors; BU1 clock-parts
  partition for any clock/set with divisible sum).
- Pigeonhole thresholds (BP4/BP5/BP6/BP7/BP8: k = boxes·(m-1)+1, or "avoid-then-+1", or N/2+1 for
  complementary pairs) — all cleanly parametric.
- Modular checksum (BM1/BM2: n prisoners, k colors → n-1 saved, back prisoner 1/k).
- Number theory (LG36 trailing zeros of n! = Σ⌊n/5^i⌋; LG24/LG31 smallest number with a given digit
  product; LG43 binary weights to cover 1..N; LG10 cog direction by parity; LG27 turn parity).
- Motion/rate (LG37 trains-and-a-bee; LG12/LG13 torch-and-bridge for 4 given times).
Non-parametric one-offs (new static flashcards inspired by the technique, exact answer + explanation):
the lateral/word/strategy puzzles (Drunk Passenger, Fox vs Duck, Wythoff, Watermelon, Water & Wine,
Knights & Knaves, Birthday deductions, etc.).
