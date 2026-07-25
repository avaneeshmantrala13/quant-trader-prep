# Proposed Original Brainteasers — v3 (for approval, NOT yet added to the app)

These are fresh proposals built from the **techniques** in `datasets/brainteasers-batch.md`
(Datasets 3–8: modular checksum/invariant, simplification/backward-induction, summation/
triangular, pigeonhole, logical/lateral, symmetry/invariant). None reproduces a named classic
or any earlier proposal in v1/v2. Every numeric claim below was verified by a throwaway
brute-force/simulation script (since deleted); the verification result is quoted per item.

Each entry: **Title · technique · difficulty · Prompt · Exact Answer · Worked Solution
(principle named) · Why it's original · Verification.**

Nothing here has been written into app source. These are PROPOSALS pending approval.

---

## A. MODULAR ARITHMETIC (invariant / checksum)

### A1. The Circular Rebalance
**Technique:** modular invariant (weighted sum mod n) · **Difficulty:** Medium–Hard

**Prompt.** Five funds sit around a circle at positions labelled 0, 1, 2, 3, 4 (position 4 is
adjacent to position 0). Right now all **7** lots of inventory are held by fund 0, so the holdings
are (7, 0, 0, 0, 0). The only permitted rebalancing move is this: pick any fund that currently
holds **at least 2 lots**; it ships exactly one lot to each of its two immediate neighbours on the
circle, thereby losing 2 lots itself. You may repeat this move as many times as you like, in any
order. Is it possible, through some sequence of these moves, to end up with **all 7 lots sitting at
one single fund other than fund 0** (for example, all 7 at fund 2)?

**Exact Answer.** **No — it is impossible.** The 7 lots can never be fully consolidated at any fund
except the one they started at (fund 0).

**Worked Solution.** Define the *weighted holding* `W = (0·c₀ + 1·c₁ + 2·c₂ + 3·c₃ + 4·c₄) mod 5`,
where `cᵢ` is the number of lots at fund `i`. Claim: **every legal move leaves `W` unchanged**.
When fund `j` fires, `cⱼ` drops by 2 and each neighbour rises by 1, so `W` changes by
`−2·j + (j−1) + (j+1) = 0` for an interior fund. At the wrap-around it still cancels mod 5:
firing fund 0 (neighbours 4 and 1) changes `W` by `4 + 1 − 0 = 5 ≡ 0`, and firing fund 4
(neighbours 3 and 0) changes it by `3 + 0 − 2·4 = −5 ≡ 0`. So `W mod 5` is an **invariant**.
Initially `W = 0·7 = 0`. To pile all 7 lots at fund `p` you would need `W = p·7 mod 5`. Since
`7 ≡ 2 (mod 5)`, that value is `2p mod 5`, which equals 0 **only when `p = 0`** (the residues for
`p = 0,1,2,3,4` are `0, 2, 4, 1, 3`). Every other single-fund target has the wrong invariant, so no
sequence of moves — however clever — can reach it. The principle is a **conserved quantity mod n**:
find a weighting the operation cannot disturb, and it partitions the configuration space.

**Why it's original.** This is *not* a hat/checksum broadcast (Dataset 3) and *not* a named puzzle;
it is a chip-firing operation on a 5-cycle with a bespoke market framing, and the "aha" is
constructing the *weighted* mod-5 invariant (a plain lot-count or parity argument fails — you must
weight by position). The specific board, lot count (7, chosen so `7 ≢ 0 mod 5`), and consolidation
question are a fresh instance, not a textbook statement.

**Verification.** Brute-force BFS of all reachable configurations from (7,0,0,0,0): 39 states
reachable, **every one** has `W ≡ 0 (mod 5)`, and the **only** single-fund configuration reachable
is the start (7,0,0,0,0). Confirms impossibility. ✓

---

## B. SIMPLIFICATION / BACKWARD INDUCTION (combinatorial game)

### B1. The Two-Ladder Tick War
**Technique:** backward induction + Sprague–Grundy / Nim (composition) · **Difficulty:** Medium–Hard

**Prompt.** Two stocks are each quoted with a bid–ask spread: stock A's spread is **17 ticks** wide and
stock B's is **22 ticks** wide. Two traders take turns tightening the market. On your turn you must
choose **one** of the two stocks and narrow its spread by **either 1 or 2 ticks** (you cannot touch
both stocks in the same turn, and you cannot narrow past 0). A spread that reaches 0 ticks is closed
and can no longer be chosen. The trader who removes the **very last tick** across both stocks (making
both spreads 0) wins. You move first. Can you force a win, and if so, what is your first move?

**Exact Answer.** **Yes, first player wins.** The winning first move is to **narrow stock A from 17
to 16 ticks**. (Thereafter, mirror the opponent to keep the position balanced — see below.)

**Worked Solution.** Analyse each spread by **backward induction**. For a single spread where you may
remove 1 or 2 ticks and taking the last tick wins, the losing ("P") sizes are the multiples of 3:
from a multiple of 3 any move (−1 or −2) hands the opponent a non-multiple, and they can always
restore a multiple of 3 — the classic subtraction-game ladder. In Sprague–Grundy terms, a spread of
size `n` has **Grundy value `n mod 3`**. Two independent spreads combine by the **Nim/XOR rule**: the
position `(a, b)` is a loss for the player to move exactly when `(a mod 3) XOR (b mod 3) = 0`.
Here `17 mod 3 = 2` and `22 mod 3 = 1`, and `2 XOR 1 = 3 ≠ 0`, so the starting position is a **win**
for the mover. To convert, move to a position whose Grundy values match: narrowing A by 1 tick gives
`16 mod 3 = 1`, so both spreads have Grundy 1 and `1 XOR 1 = 0` — a P-position handed to the opponent.
From there, whatever they do to one spread, you make the *equal* move on the other (or restore the
per-spread multiple-of-3), preserving the balance until you take the last tick. The principle is
**Sprague–Grundy: decompose a sum of games into Nim-values and XOR them**.

**Why it's original.** It is *not* Nim, Wythoff, or the plain 21-game: it composes a
subtract-{1,2} ladder on **two** spreads and forces the solver to (a) reduce each to its `mod 3`
Grundy value and (b) combine by XOR. The banned game Wythoff allows removing from both piles at once;
here you may touch only one — a deliberately different rule set — and the market-tightening frame is
fresh. The insight rewarded is the decomposition, not a memorised classic.

**Verification.** Full minimax solver over all `(a,b)` with `a,b ≤ 24`: the prediction
"P-position iff `(a mod 3) XOR (b mod 3) = 0`" matched the true game outcome in **every** cell.
For (17, 22) the solver confirms first-player win and that A: 17→16 lands the opponent in a P-position. ✓

---

## C. SUMMATION / TRIANGULAR (with a parity/mod-4 twist)

### C1. The Balanced Books
**Technique:** triangular sum `N(N+1)/2` + parity/mod-4 feasibility · **Difficulty:** Medium

**Prompt.** Your P&L journal numbers the trading days of a period as 1, 2, 3, …, up to `N`, and day
`k` recorded a profit of exactly `k` dollars. You want to split the days into **two groups whose total
profits are exactly equal** (every day goes into one group or the other). For a period of `N` days,
this is sometimes possible and sometimes not. For which of the following four period lengths is an
equal split possible: **N = 2024, 2025, 2026, or 2027**?

**Exact Answer.** Possible for **N = 2024 and N = 2027**; **impossible** for N = 2025 and N = 2026.

**Worked Solution.** The total profit is the triangular number `1 + 2 + ⋯ + N = N(N+1)/2`. An equal
split requires each group to total `N(N+1)/4`, so a **necessary** condition is that `N(N+1)/2` be
**even**, i.e. that `4 | N(N+1)`. Of the two consecutive integers `N` and `N+1`, exactly one is even;
that even one must itself be divisible by 4. This happens precisely when `N ≡ 0 (mod 4)` (then `N`
is a multiple of 4) or `N ≡ 3 (mod 4)` (then `N+1` is a multiple of 4). So the sum is even **iff
`N ≡ 0 or 3 (mod 4)`**. This condition is also **sufficient**: whenever the sum is even you can build
an equal split constructively (e.g. repeatedly pair the current largest unused day with small days to
hit the half-total — the greedy pairing always closes because the numbers 1…N are "dense" enough).
Now just reduce mod 4: `2024 ≡ 0` ✓, `2025 ≡ 1` ✗, `2026 ≡ 2` ✗, `2027 ≡ 3` ✓. The principle is
**triangular-number summation gated by a divisibility (mod-4) parity check.**

**Why it's original.** The bare "can 1…N be split into two equal halves" fact exists in references,
but this instance forces the composed reasoning — compute the triangular sum, derive the clean
`N ≡ 0,3 (mod 4)` criterion, then apply it across four look-alike years so the solver can't just
recall a single yes/no. The framing (splitting a dated P&L journal) and the four-way comparison are a
bespoke construction, not a stated classic.

**Verification.** Subset-sum DP over `{1,…,N}`: the feasibility of an exact half-split matched the
rule "`N ≡ 0 or 3 (mod 4)`" for **all** `N ≤ 200`, and the four target years return
True / False / False / True respectively. ✓

---

## D. PIGEONHOLE PRINCIPLE

### D1. The Divisible Streak
**Technique:** prefix sums mod n + pigeonhole (composition) · **Difficulty:** Medium

**Prompt.** Over one session a trader executes **30** trades in sequence, and each trade's profit or
loss is a whole number of dollars (it may be positive, negative, or zero). Prove that there must exist
some block of **consecutive** trades (one or more of them, in a row) whose combined P&L is exactly
divisible by 30 — and show that 30 trades is the smallest count for which this is guaranteed.

**Exact Answer.** It is **always guaranteed**: among any 30 consecutively recorded integer P&Ls, some
consecutive block sums to a multiple of 30. And **30 is tight** — with only 29 trades it can fail.

**Worked Solution.** Form the **running totals** `S₀ = 0`, `S₁ = (trade 1)`, `S₂ = (trades 1–2)`, …,
`Sₐₒ = (trades 1–30)` — that is **31** prefix sums, including the empty prefix `S₀ = 0`. Look at each
one's **remainder mod 30**; there are only **30 possible remainders** (0 through 29). By the
**pigeonhole principle**, 31 prefix sums into 30 remainder-buckets forces **two of them to share the
same remainder**, say `Sᵢ ≡ Sⱼ (mod 30)` with `i < j`. Then the block of trades `i+1, i+2, …, j` has
combined P&L `Sⱼ − Sᵢ`, which is divisible by 30. Done — and note you never needed the actual dollar
values, only that there is one more prefix sum than there are remainders. **Tightness:** with 29 trades
each equal to \$1, the prefix sums are `0, 1, 2, …, 29`, all *distinct* mod 30, and every consecutive
block sums to some value in 1…29 — never a multiple of 30. So 29 can dodge it; 30 cannot. The principle
is **pigeonhole on prefix sums mod n.**

**Why it's original.** It fuses two Dataset techniques — modular arithmetic (prefix sums mod n) and
pigeonhole — into one, and it's a *proof-style* card (guarantee + tight extremal witness) rather than a
plug-in count. The specific "30 trades / consecutive block / show 29 fails" packaging with a P&L frame
is fresh, and the crucial trick (counting the empty prefix `S₀` to get 31 pigeons) is the non-obvious
insight, not a named puzzle.

**Verification.** 200,000 random 30-trade sequences (P&Ls uniform in −50…50): **every one** contained
a consecutive block divisible by 30. The 29-trade all-\$1 sequence contained **none**, confirming the
bound is tight. ✓

---

### D2. The Ten-Cent Collision
**Technique:** pigeonhole via extremal / path-cover · **Difficulty:** Medium

**Prompt.** A trader is going to submit several limit quotes today. Each quote's price is a whole
number of cents somewhere from **1 to 100** (no two quotes need be different — but to make the question
concrete, assume she never submits the exact same price twice, so her quotes are distinct integers in
1…100). What is the **smallest number of quotes** she must submit to be *absolutely guaranteed* that
some two of them differ by **exactly 10 cents**?

**Exact Answer.** **51 quotes.**

**Worked Solution.** Build a graph on the prices 1…100, joining two prices with an edge exactly when
they **differ by 10**. Because a price `x` connects only to `x−10` and `x+10`, the graph splits into
**10 disjoint chains**, one per residue class mod 10: e.g. `1–11–21–31–…–91`, `2–12–…–92`, and so on —
each chain a straight path of **10 prices**. To *avoid* any pair differing by exactly 10, she must pick
prices that are never adjacent within a chain (an "independent set"). On a path of 10 vertices the
largest independent set has **5** vertices (take every other one, e.g. 1, 21, 41, 61, 81). Across all
10 chains that's `10 × 5 = 50` prices she can hold with **no** exact-10 gap. So 50 quotes can still
dodge the collision, but the **51st** quote is one pigeon too many for the 50 "safe" slots — by the
**pigeonhole principle** it must fall adjacent to an already-chosen price in some chain, forcing a pair
exactly 10 cents apart. Hence 51 guarantees it and 50 does not. The principle is **pigeonhole against
the largest collision-free ("independent") set.**

**Why it's original.** The Dataset pigeonhole cards use simple box counts (`boxes·(m−1)+1`, or
complementary pairs). This one needs an extra modelling step — recognising the "differ by exactly 10"
constraint as **10 independent paths** and computing a path's maximum independent set — so the threshold
is `10 × 5 + 1 = 51`, not a one-line box count. The specific gap (10) on a 1…100 price grid is a bespoke
instance, not a named puzzle.

**Verification.** Computed the maximum "no two differ by exactly 10" subset of 1…100 directly (10
paths of length 10, max independent set 5 each) = **50**, so the guarantee threshold is **51**. ✓

---

## E. LOGICAL / LATERAL

### E1. The Compliance Form Paradox
**Technique:** self-referential logic (fixed-point deduction) · **Difficulty:** Medium

**Prompt.** A compliance form lists **ten** numbered statements. For each `k` from 1 to 10, statement
number `k` reads, in full: *"Exactly `k` of the ten statements on this form are false."* Assuming the
form is internally consistent (each statement is simply either true or false, and says what it says),
determine **which statements are true and which are false** — or show it's impossible.

**Exact Answer.** Exactly **one** statement is true — **statement 9** ("Exactly 9 of the statements
are false") — and the **other nine statements are false**. This is the unique consistent solution.

**Worked Solution.** The ten statements make **mutually exclusive** claims: at most one of them can be
true, because they assert different counts of falsehoods and the number of false statements is a single
fixed value. So the number of true statements is either 0 or 1. **It can't be 0** (all false): if all
ten were false, then "exactly 10 are false" would be a *true* description — but that is statement 10,
which we just declared false, a contradiction. **So exactly one statement is true**, which means exactly
**9 are false**. The lone true statement must therefore be the one that correctly announces "exactly 9
are false" — that is **statement 9**. Consistency check: statement 9 is true (indeed 9 are false); every
other statement `k ≠ 9` claims "exactly `k` false," but the real count is 9 ≠ `k`, so each is correctly
false. Everything fits, and it's the only assignment that does. The principle is **resolving a
self-referential system by a counting fixed point**: the truth count and the statements' content must
agree simultaneously.

**Why it's original.** It's not a Knights-and-Knaves speaker puzzle or the "gods/random" classic; it's a
self-referential *counting* form where the statements quantify over their own truth values. The clean
elimination (at most one true → not zero → exactly nine false → statement 9) is the "aha," and the
specific ten-statement compliance framing is a fresh construction rather than a stated classic.

**Verification.** Exhaustive check of all `2¹⁰ = 1024` true/false assignments: **exactly one** is
internally consistent — statement 9 true, all others false. ✓

---

## F. SYMMETRY / INVARIANT

### F1. The Four-Lot Floor
**Technique:** coloring invariant (de Bruijn-style parity of a tiling) · **Difficulty:** Medium–Hard

**Prompt.** A trading floor is a perfect **10 × 10** grid of 100 identical desk-squares. Facilities wants
to cover it **completely** with **1 × 4** rectangular benches (each bench occupies four squares in a
straight line, horizontally or vertically), with no overlaps and no bench sticking off the floor. Since
100 is divisible by 4, it seems there ought to be enough benches. **Is a complete tiling actually
possible?**

**Exact Answer.** **No — the 10 × 10 floor cannot be tiled by 1 × 4 benches**, even though 100 is a
multiple of 4.

**Worked Solution.** Divisibility of the area is necessary but not sufficient; use a **coloring
invariant**. Color the squares with four colors by the rule `color(row, col) = (row + col) mod 4`, so
the four colors repeat in diagonals. A key fact: **any** 1 × 4 bench, placed horizontally or vertically,
always covers **exactly one square of each of the four colors** (four consecutive values of `row + col`
run through all residues 0,1,2,3 mod 4). Therefore, if a tiling existed, the four colors would have to
appear in **equal** counts — 25 squares each. But counting the actual color distribution on the 10 × 10
board, the four colors do **not** come out to 25/25/25/25 (the 10 × 10 dimensions, both `≡ 2 mod 4`,
skew the diagonal counts), so the equal-count requirement fails and **no tiling can exist**. More
generally this argument shows an `m × n` board is tileable by 1 × 4 pieces **iff** 4 divides `m` or 4
divides `n`; 10 × 10 satisfies neither, so it's impossible. The principle is a **coloring invariant**:
find a coloring every tile respects, then a counting mismatch rules out any arrangement.

**Why it's original.** This is *not* the mutilated-chessboard/domino classic (that's a 2-coloring with
dominoes). Here the surprise is that the area *is* divisible by the tile size yet tiling is still
impossible, exposed only by a **4-coloring** (mod-4 diagonal) argument. The 10 × 10 / 1 × 4 instance is
chosen precisely to defeat the naïve area check, making it a fresh, counterintuitive card.

**Verification.** Exhaustive backtracking tiler confirmed: 4 × 4 ✓ tileable, 6 × 6 ✗, 8 × 8 ✓,
5 × 8 ✓, and **10 × 10 ✗ (no tiling found)** — matching the "`4 | m` or `4 | n`" theorem. ✓

---

### F2. The Center Trade
**Technique:** symmetry / mirror ("strategy stealing" via reflection) · **Difficulty:** Medium–Hard

**Prompt.** A thin market has **21** price levels in a row, numbered 1 through 21. Two rival algorithms
take turns resting a single buy order on an empty level, with one rule: **no order may be placed on a
level immediately adjacent to a level that already holds an order** (so if level 8 is taken, levels 7 and
9 become unusable). An algorithm that has **no legal level left on its turn loses**. You move first.
Can you guarantee a win, and if so, what is your strategy?

**Exact Answer.** **Yes — the first mover wins.** Strategy: **place your first order on the exact center,
level 11**, then **mirror** every opponent move by reflecting it through the center (if the opponent plays
level `p`, you immediately reply on level `22 − p`).

**Worked Solution.** Use a **symmetry (mirroring) strategy**. Placing on the center level 11 blocks
levels 10 and 12 and, crucially, leaves the board perfectly **symmetric** about the center: levels 1…9
mirror levels 13…21, with the used center as a buffer between them. From now on, whenever the opponent
plays some level `p`, its reflection `22 − p` is (i) a *different* level from `p` (nothing sits exactly on
the center anymore) and (ii) still legal — because the position was symmetric before their move, so if `p`
was a legal, non-adjacent level, its mirror `22 − p` is legal too. You always answer with the mirror,
restoring symmetry. Thus **you can always move immediately after the opponent can**, so the opponent is
the first to run out of legal levels and loses. The principle is **pairing by reflection**: seize the
unique self-symmetric move, then let the opponent's own moves generate your replies. (The same argument
shows the first mover wins on *any* odd number of levels; on an even count there is no center to grab,
and the second mover generally takes over the mirror.)

**Why it's original.** It is not the round-table coins puzzle (Dataset SY4 uses overlap on a disk); the
board is a **line with a no-adjacent constraint**, so occupying a level also sterilizes its neighbours,
and the mirror must be checked to respect that adjacency rule. The specific 21-level order-book framing
and the non-adjacency mechanic make it a distinct construction, while the core lesson — *center + reflect*
— is the transferable insight.

**Verification.** Grundy-value solver for "place a non-adjacent token on a path, last to place wins":
the first player has a winning position for **every odd length up to 59** (and specifically for 21),
consistent with the center-mirror proof. ✓

---

## Summary table

| # | Title | Technique | Difficulty | Exact answer |
|---|-------|-----------|-----------|--------------|
| A1 | The Circular Rebalance | Modular invariant (weighted sum mod 5) | Med–Hard | Impossible |
| B1 | The Two-Ladder Tick War | Backward induction + Sprague–Grundy/XOR | Med–Hard | First wins; play A 17→16 |
| C1 | The Balanced Books | Triangular sum + mod-4 parity | Medium | 2024 ✓, 2025 ✗, 2026 ✗, 2027 ✓ |
| D1 | The Divisible Streak | Prefix sums mod n + pigeonhole | Medium | Always (tight at 30; 29 fails) |
| D2 | The Ten-Cent Collision | Pigeonhole vs. max independent set | Medium | 51 |
| E1 | The Compliance Form Paradox | Self-referential fixed-point logic | Medium | Only statement 9 true |
| F1 | The Four-Lot Floor | Coloring invariant (mod-4) | Med–Hard | No (untileable) |
| F2 | The Center Trade | Symmetry / mirror strategy | Med–Hard | First wins; center then mirror |

**Status:** proposals only — **nothing has been added to the app.** Every numeric/logic claim above
was checked by brute force or simulation (results quoted per item). On approval, tell me which to add
and to which level (Warm-Ups / Classics / Hard) and I'll write them into the app's `Flashcard` shape.
