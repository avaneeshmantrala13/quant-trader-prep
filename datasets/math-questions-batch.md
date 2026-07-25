# Math Questions batch (NEW top-level category, distinct from Probability & Statistics)

This file holds two source datasets to be integrated following the standard pipeline
(understand placement → understand the logic + distractors → generate NEW questions with
high-quality distractors → NEVER reuse the originals verbatim → verify arithmetic & distractors
with the exact verifier → add to the site). These are DETERMINISTIC math problems (rate/work
word problems, algebra systems, geometry, counting, number theory, doubling/growth) — nearly
every answer is a single exact value (count/measurement/time), NOT a probability in [0,1].

===============================================================================
## DATASET 1 — Math Questions: General (43 questions)
===============================================================================

Answers are counts/measurements/times, NOT [0,1] probabilities (a [0,1] checker would wrongly
reject most). Only Triangle on Circle (0.25) is a genuine probability. Non-scalar/special:
- MQ34 Sharing a Glass: A=2/3, B=1/3 (two values, grade both)
- MQ43 Upstream or Downstream: 1200 (a clock time HHMM, not a quantity)
- MQ37 Spread Set: 129 (computed, no source solution)
- MQ1 Analog Clock Angle: 7.5 (degrees); MQ12 Fly vs Ant 22.5 (%); MQ35 Sheep 9.67 (s)

High-value reasoning targets: MQ7 Cold Storage (floor-then-multiply packing: 343 not 421),
MQ4 Boats on a River & MQ35 Sheep Runs Home (multi-equation/calculus optimization), MQ15 How
Many Dogs (truth-teller logic + integer constraint), MQ22 Magic 37 (1000≡1 mod 37), MQ33 Set of
Distinct Integers (pigeonhole on odd-part chains), MQ41 Triangle on Circle (diameter/coin-flip).

Near-duplicate clusters: River Length #1/#2; How Many Spiders / Number of Pigs (animal-legs
system); Rectangles/Squares on Chessboard; Biking With Wind / Upstream / River Length (current
adjusts speed).

### Index
| ID | Question | Difficulty | Answer |
|---|---|---|---|
| MQ1 | Analog Clock Angle | Easy | 7.5° |
| MQ2 | Biking With Wind | Easy | 32 min |
| MQ3 | Birthday Candles | Easy | 36 |
| MQ4 | Boats on a River | Hard | 2000 m |
| MQ5 | Chessboard Crossing | Easy | 35 |
| MQ6 | Choosing Blocks | Easy | 155 |
| MQ7 | Cold Storage | Easy | 343 |
| MQ8 | Cookie Sorting | Easy | 127 |
| MQ9 | Counting Steps | Easy | 686 |
| MQ10 | Escalator Steps | Medium | 30 |
| MQ11 | Filling a Bathtub | Easy | 52 min |
| MQ12 | Fly vs Ant | Medium | 22.5% |
| MQ13 | Games Played | Easy | 380 |
| MQ14 | Going to the Beach #1 | Medium | 24 mi |
| MQ15 | How Many Dogs | Medium | 23 |
| MQ16 | How Many Participants | Easy | 14th |
| MQ17 | How Many Spiders | Easy | 52 |
| MQ18 | How Many Tennis Matches | Easy | 127 |
| MQ19 | Inflate Rate | Hard | 100 min |
| MQ20 | Interview Permutations | Easy | 90720 |
| MQ21 | Jumping Frog | Medium | 45 |
| MQ22 | Magic 37 | Hard | 28 |
| MQ23 | Maximum Intersections | Medium | 39 |
| MQ24 | Number of Pigs | Easy | 80 |
| MQ25 | Odd Numbers | Medium | 7500 |
| MQ26 | Painting Walls | Easy | 4 pots |
| MQ27 | Patch of Lily Pads | Easy | 38 days |
| MQ28 | Radius of a Circle | Hard | 2 |
| MQ29 | Rectangles On Chessboard | Easy | 1296 |
| MQ30 | River Length #1 | Medium | 36 m |
| MQ31 | River Length #2 | Medium | 72 m |
| MQ32 | Sequences | Easy | 120 |
| MQ33 | Set of Distinct Integers | Easy | 26 |
| MQ34 | Sharing a Glass | Easy | A=2/3, B=1/3 |
| MQ35 | Sheep Runs Home | Hard | 9.67 s |
| MQ36 | Smaller Cubes | Medium | 9 |
| MQ37 | Spread Set | Hard | 129 (computed) |
| MQ38 | Squares On Chessboard | Medium | 204 |
| MQ39 | Summing 11 to 20 | Easy | 155 |
| MQ40 | Tic Tac Toe | Easy | 47 |
| MQ41 | Triangle on Circle | Medium | 0.25 |
| MQ42 | Unfolded Box | Hard | 140 |
| MQ43 | Upstream or Downstream | Medium | 1200 |

### Families & worked solutions (logic to learn — do NOT reuse verbatim)

RATE / SPEED / WORK:
- MQ2 Biking With Wind: no-wind 30min@20 ⟹ 5km each way; headwind 15, tailwind 25 → 5/15+5/25=8/15h=32 min.
- MQ14 Going to the Beach: walk@4, taxi@12, total 8h → x/4+x/12=8 → x=24 mi.
- MQ30 River Length #1: L=6V, L=4(V+3) → V=6, L=36 m.
- MQ31 River Length #2: L=6V, L=8(V-3) → V=12, L=72 m.
- MQ43 Upstream or Downstream: 3=X/(C-2), 4=(X+20)/(C+2) → C=6, X=12; 20mi upstream@4 → 5h; 17:00-5:00=12:00 (1200).
- MQ10 Escalator Steps: 20=T/(S+1), 60=T/(1-S) → S=0.5, T=30.
- MQ11 Filling a Bathtub: net 14+9-12=11 L/min; 572/11=52 min.
- MQ19 Inflate Rate: G=1/120,S=1/150; 45min → 27/40 done; remaining 13/40 in 13min → 1/40 combined; 1/120+1/150+1/x=1/40 → x=100 min.
- MQ4 Boats on a River: speed ratio 750/X=(1000+X)/(2X+1250) → X²-500X-937500=0 → X=1250; width=750+1250=2000 m.
- MQ35 Sheep Runs Home: f(x)=(54-x)/10+√(32²+x²)/6; f'=0 → x=24; f(24)=29/3≈9.67 s.

ALGEBRA / SYSTEMS:
- MQ3 Birthday Candles: n(n+1)/2=666 → n=36.
- MQ9 Counting Steps: 343=½total → total=686.
- MQ15 How Many Dogs: order A>C>B; A=1.3B, C=1.15B; B mult of 20; stmt4 forces B=20 → A=26,C=23.
- MQ16 How Many Participants: (27-1)/2=13 each side → 14th.
- MQ17 How Many Spiders: cows c: 4c+2(2c)+8(4c)=40c=520 → c=13; spiders=52.
- MQ24 Number of Pigs: 6P=480 → P=80.
- MQ40 Tic Tac Toe: 19 wins=+€38; net -€18 → losses €56 → 28; total 47.

COUNTING / COMBINATORICS:
- MQ5 Chessboard Crossing: C(7,4)=35.
- MQ6 Choosing Blocks: C(11,3)-C(5,3)=165-10=155.
- MQ8 Cookie Sorting: 2⁷-1=127 (all-coconut needs 7, have 6).
- MQ13 Games Played: 20 teams twice: 38·20/2=380.
- MQ18 Tennis Matches: 128-player knockout: 127 (=n-1).
- MQ20 Interview Permutations: 9!/(2!2!)=90720 (INTERVIEW, I×2,E×2).
- MQ21 Jumping Frog: no run of 3, (0,0)→(5,4): sum=45.
- MQ32 Sequences: X₀=0,X₁₀=4,±1: 7 up,3 down → C(10,3)=120.
- MQ23 Maximum Intersections: 2C(4,2)+C(3,2)+2·3·4=39.
- MQ29 Rectangles On Chessboard: C(9,2)²=1296.
- MQ38 Squares On Chessboard: Σ(9-k)²=204.
- MQ7 Cold Storage: ⌊30/4⌋=7 → 7³=343 (NOT 27000/64≈421; floor first then multiply).
- MQ36 Smaller Cubes: 64=4³ → 3 cuts/dim → 9.
- MQ37 Spread Set: subsets of {1..12} pairwise gap≥3, incl empty+singletons: Σ C(12-2(k-1),k)=1+12+45+56+15=129 (computed).

SUMMATION / NUMBER THEORY:
- MQ25 Odd Numbers: sum odds 100-200: 100²-50²=10000-2500=7500.
- MQ39 Summing 11 to 20: 210-55=155.
- MQ22 Magic 37: rotations of last 3 digits preserve mod 37 (1000≡1) → count multiples of 37 in [37000,37999]=28.
- MQ33 Set of Distinct Integers: 25 odd-part chains; {26..50} divisor-free → k=26.

GEOMETRY:
- MQ1 Analog Clock Angle at 3:15: |97.5-90|=7.5°.
- MQ12 Fly vs Ant: fly √150, ant (unfold) √250; fly 22.5% faster.
- MQ26 Painting Walls: 40+32-3=69 m²; 69/22=3.14 → 4 pots.
- MQ28 Radius of a Circle: x²+y²-8x-6y+21=0 → r=2.
- MQ42 Unfolded Box: w+h=9, l+h=17, 2w+2l=24 → h=7,w=2,l=10 → V=140.
- MQ41 Triangle on Circle: 3 random points, P(center inside)=1/4 (diameter/coin-flip).

DOUBLING / GROWTH:
- MQ27 Patch of Lily Pads: doubles every 3 days; ¼ at day 32 → full at 38.
- MQ34 Sharing a Glass: A=2/3, B=1/3 (alternating geometric, 2:1 invariant).

===============================================================================
## DATASET 2 — Math Questions: Solving Unknowns (7 questions)
===============================================================================

Deterministic algebra/logic. Answer shapes:
- SU1–SU4 (Linear Diophantine): NO scalar — the answer is the full tuple (A,B,C,D,E), each a
  unique integer 1–5. Grade as full-tuple match (permutation), NOT a single number.
- SU5 Long Fish (64), SU6 Product of Unknowns #1 (42), SU7 System of Weights (12): single integers.
SU7 references a balance-mobile diagram; the equation system is the ground truth.

### Index
| ID | Question | Difficulty | Answer |
|---|---|---|---|
| SU1 | Linear Diophantine Equation #1 | Medium | A5 B1 C4 D2 E3 |
| SU2 | Linear Diophantine Equation #2 | Medium | A1 B2 C5 D4 E3 |
| SU3 | Linear Diophantine Equation #3 | Medium | A1 B4 C3 D5 E2 |
| SU4 | Linear Diophantine Equation #4 | Medium | A3 B2 C5 D1 E4 |
| SU5 | Long Fish | Medium | 64 |
| SU6 | Product of Unknowns #1 | Hard | 42 |
| SU7 | System of Weights | Medium | 12 |

### Logic to learn (do NOT reuse verbatim)
Shared constraint SU1–SU4: A–E distinct integers in {1..5}; solve by substitution / subtracting
equations / summing all + trial / uniqueness elimination.
- SU1: (2)→(3): 2C=8→C=4; B+A=6, E+B=4 → A-E=2 → A5,E3,B1; D=2. (A5 B1 C4 D2 E3)
- SU2: (1)&(4)→A=1; (3)-(4)→E-1=B; E∈{3,4} → A1 B2 C5 D4 E3.
- SU3: (1)+(2): E=2; A+2=C, C+2=D → A1 C3 D5; B=4. (A1 B4 C3 D5 E2)
- SU4: sum all → 2C=3E-2; only C=5,E=4; D=B-1,A=B+1 → A3 B2 C5 D1 E4.
- SU5 Long Fish: head=8; tail=8+½body; body=8+tail → tail=24, body=32, total=64.
- SU6 Product of Unknowns: WX=35,WY=15,XY=21 → Y²=(15·21)/35=9→Y=3; W=5,X=7,Z=6; A=XZ=42.
- SU7 System of Weights: from figure P=2O, G+C=4O=24, R+C=48; solve → O=6, P=12 (G16 P12 L10 B20 R40 C8 O6).
