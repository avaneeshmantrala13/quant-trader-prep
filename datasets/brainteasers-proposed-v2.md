# Proposed Original Brainteasers — v2 (for approval, NOT yet added to the app)

These are **re-do** proposals after v1 was rejected for being famous textbook classics
reskinned. Every problem below is a **fresh setup with a real "aha" and an exact,
checkable answer**, verified by a throwaway Monte-Carlo/brute-force script (since deleted).
None reproduces a named classic; each carries an honest novelty audit naming the closest
known puzzle and why this one is materially different.

Format for each: **Title · difficulty · Prompt · Exact Answer · Worked Solution ·
Novelty audit · Verification.**

---

## 1. The Backup Dealer
**Difficulty:** Easy

**Prompt.** You need to buy exactly one share and you ask two independent dealers for a
price. Each dealer's quote is an independent random number drawn uniformly from the
interval between \$0 and \$1 (every value in that range equally likely). You naturally
intend to trade at the *cheaper* of the two quotes. However, the cheaper dealer is only
reachable half the time: when you try to hit the better quote, with probability exactly
1/2 that dealer's line is busy and you are forced to trade at the *other* (more expensive)
quote instead; with probability 1/2 you get the cheaper quote as intended. What is the
expected price you end up paying?

**Exact Answer.** \$0.50 — exactly the same as if you had ignored both quotes and traded
with a single dealer at random.

**Worked Solution.** "Expected value" (the long-run average) of a quantity is the sum of
each possible value weighted by its probability. Call the two quotes \(X\) and \(Y\); each
is uniform on \([0,1]\), so each on its own has expected value \(\tfrac12\). Write
\(m=\min(X,Y)\) for the cheaper quote and \(M=\max(X,Y)\) for the dearer one. With
probability \(1/2\) you pay \(m\) and with probability \(1/2\) you pay \(M\), so your
expected cost is
\[
\tfrac12\,\mathbb{E}[m] + \tfrac12\,\mathbb{E}[M]
= \tfrac12\big(\mathbb{E}[m] + \mathbb{E}[M]\big).
\]
Here is the key identity: for *any* two numbers, the smaller plus the larger equals the
two originals added together, i.e. \(m+M = X+Y\) **always**. Taking expectations,
\(\mathbb{E}[m]+\mathbb{E}[M]=\mathbb{E}[X]+\mathbb{E}[Y]=\tfrac12+\tfrac12=1\). Therefore
your expected cost is \(\tfrac12\cdot 1 = \tfrac12\). The "aha" is that the 50/50 backup
*exactly cancels* the advantage of shopping for the minimum: averaging the min and the max
with equal weight is the same as averaging the two original quotes. (You never even need to
know that \(\mathbb{E}[\min]=\tfrac13\) and \(\mathbb{E}[\max]=\tfrac23\) for two uniforms —
though those values are consistent: \(\tfrac13+\tfrac23=1\).) Note the general rule: if you
got the cheaper quote with probability \(p\), your expected cost would be
\(p\cdot\tfrac13+(1-p)\cdot\tfrac23=\tfrac23-\tfrac{p}{3}\), which only beats \(\tfrac12\)
when \(p>\tfrac12\).

**Novelty audit.** Closest known object: "expected value of the minimum of two uniforms"
(a standard order-statistics exercise) and the algebraic identity \(\min+\max=a+b\). This
is *not* a named puzzle. The novelty is the framing that produces a **surprising exact
cancellation to 1/2** via a fill-probability mechanic — the interesting content is that the
answer is invariant to the min/max split, not the routine computation of \(\mathbb{E}[\min]\).

**Verification.** Monte-Carlo, 5,000,000 trials: simulated expected cost **0.49966** vs
closed-form **0.5**. ✓

---

## 2. The Adjacent Cross
**Difficulty:** Medium

**Prompt.** A trading queue contains 8 buy orders and 8 sell orders — 16 orders in total —
lined up in a single row in a completely random order (every one of the possible orderings
of the 16 tickets is equally likely). Scanning the row from left to right, you count a
"cross" every time a **buy order is immediately followed by a sell order** in adjacent
positions. What is the expected number of such buy-then-sell crosses in the row?

**Exact Answer.** Exactly **4** (in general, for \(n\) buys and \(n\) sells, the expected
count is \(n/2\)).

**Worked Solution.** The powerful tool here is **linearity of expectation**: the expected
value of a sum of random quantities equals the sum of their individual expected values —
*even when those quantities are not independent*. There are \(16-1 = 15\) adjacent slots
(positions \(1\text{–}2, 2\text{–}3, \dots, 15\text{–}16\)). For slot \(i\), define an
indicator \(I_i\) that equals \(1\) if that pair is "buy then sell" and \(0\) otherwise. The
number of crosses is \(I_1+\cdots+I_{15}\), so its expectation is
\(\sum_i \mathbb{E}[I_i]=\sum_i \Pr(\text{slot }i\text{ is B then S})\).
For a single fixed adjacent slot, the chance the left card is a buy is \(8/16\); given
that, the chance the right card is a sell is \(8/15\) (8 sells remain among the 15 other
cards). So each slot is a cross with probability
\[
\frac{8}{16}\cdot\frac{8}{15}=\frac{8}{30}=\frac{4}{15}.
\]
Multiplying by the 15 slots: \(15\cdot\frac{4}{15}=4\). The "aha" is that even though
neighboring slots overlap (they share a card) and are therefore *dependent*, linearity lets
you ignore that entirely and just add per-slot probabilities. In general the per-slot
probability is \(\frac{n}{2n}\cdot\frac{n}{2n-1}=\frac{n}{2(2n-1)}\), and multiplying by the
\(2n-1\) slots gives exactly \(n/2\), independent of the messy dependence structure.

**Novelty audit.** Closest known technique: textbook "expected number of adjacent
matching pairs / descents in a random arrangement" — linearity-of-expectation drills are
common, but there is no *named* puzzle here. Novelty is moderate and honest: the value of
this card is the clean \(n/2\) result and the lesson that dependence washes out under
linearity, in a fresh order-book framing. It is the least "exotic" of the six.

**Verification.** Monte-Carlo, 2,000,000 shuffles of 8 B's + 8 S's: simulated mean crosses
**4.00080** vs closed-form **4**. ✓

---

## 3. Walking the Offer Down
**Difficulty:** Medium

**Prompt.** You are selling one unit to a single buyer whose private maximum willingness to
pay, \(V\), is a random number uniform on \([0,1]\) (you do not observe it). You may quote a
take-it-or-leave-it ask. If your ask is at most \(V\), the buyer accepts and you earn your
ask; if your ask exceeds \(V\), the buyer declines and — crucially — you are then allowed to
make **exactly one more, strictly lower** ask, which the buyer accepts if it is at most
\(V\) (otherwise the buyer walks and you earn \(0\)). The buyer is myopic: at each ask they
simply accept whenever the price does not exceed their value \(V\). Choosing both asks
optimally in advance, (a) what two prices should you quote, and (b) what is your maximum
expected revenue? For contrast, what would a single-ask seller earn?

**Exact Answer.** Quote **\$2/3 first, then \$1/3**. Maximum expected revenue = **\$1/3**.
A single-ask seller's best is to quote **\$1/2** for expected revenue **\$1/4**. The second
chance lifts revenue from \(1/4\) to \(1/3\), a **33% improvement**.

**Worked Solution.** With a *single* ask \(p\), the buyer accepts with probability
\(\Pr(V\ge p)=1-p\) (since \(V\) is uniform on \([0,1]\), the chance it lands above \(p\) is
the length \(1-p\)), so expected revenue is \(p(1-p)\). This parabola peaks at \(p=\tfrac12\),
giving \(\tfrac12\cdot\tfrac12=\tfrac14\).

Now allow a fallback. Let the first ask be \(p_1\) and the lower fallback be \(p_2<p_1\).
Two disjoint ways to earn money:
- The buyer accepts the first ask: this needs \(V\ge p_1\), probability \(1-p_1\), earning
  \(p_1\). Contribution \(p_1(1-p_1)\).
- The buyer declines the first but accepts the fallback: this needs
  \(p_2\le V< p_1\), probability \(p_1-p_2\), earning \(p_2\). Contribution
  \(p_2(p_1-p_2)\).

So expected revenue is \(R(p_1,p_2)=p_1(1-p_1)+p_2(p_1-p_2)\). Optimize the fallback first:
for fixed \(p_1\), \(p_2(p_1-p_2)\) is a parabola in \(p_2\) maximized at
\(p_2=p_1/2\), where it equals \(p_1^2/4\). Substitute:
\[
R = p_1(1-p_1)+\frac{p_1^2}{4}=p_1-\frac34 p_1^2.
\]
Differentiate and set to zero: \(1-\tfrac32 p_1=0\Rightarrow p_1=\tfrac23\), hence
\(p_2=\tfrac13\). The revenue is \(\tfrac23-\tfrac34\cdot\tfrac49=\tfrac23-\tfrac13=\tfrac13\).
The "aha": a second, lower quote lets you **price-discriminate over time** — capture the
high-value buyers at \(2/3\), then recover a sale from the medium-value buyers at \(1/3\) —
which strictly beats any single price. Note the fallback \(1/3\) is *not* the single-ask
optimum \(1/2\); the whole schedule shifts because the first ask has already "creamed off"
the top of the distribution.

**Novelty audit.** Closest known idea: sequential / declining-price monopoly pricing (a
mechanism-design staple). It is a *standard technique* but **not a named brainteaser** on
the banned list, and the specific two-round, uniform-value setup with the clean
\(1/4 \to 1/3\) jump is a bespoke construction. Honesty flag: a candidate who has seen
durable-goods/optimal-pricing theory may find the method familiar; the value here is the
crisp exact numbers and the "walk the offer down" trading framing rather than deep novelty
of method.

**Verification.** Monte-Carlo, 2,000,000 draws: revenue at \((2/3,1/3)\) = **0.33369** vs
\(1/3\). Single-price grid search: best \(p^\*=0.50\), revenue **0.2500**. Two-round grid
search over \((p_1,p_2)\): best at \((0.66,0.33)\), revenue **0.3333**. ✓

---

## 4. The Fading Buyer
**Difficulty:** Hard

**Prompt.** You are trying to sell one block of stock. Interested buyers arrive one at a
time, and each independently offers a price that is a uniform random number on \([0,1]\)
(every value equally likely). When an offer arrives you must immediately either **accept**
it (the sale is done at that price and the game ends) or **reject** it (that offer is gone
forever, no recall). Here is the catch: each time you reject an offer, there is a
probability of exactly **1/2** that the entire deal collapses — the block gets sold
elsewhere and you walk away with **0** — and a probability 1/2 that another buyer arrives.
There is no limit on the number of buyers as long as the deal has not collapsed. Playing
optimally to maximize your expected sale price, (a) what acceptance rule should you use, and
(b) what is your expected payoff?

**Exact Answer.** Accept the first offer that is at least the threshold
\(t^\* = 2-\sqrt{3}\approx 0.2679\); reject anything below it. Expected payoff
\(W = 4-2\sqrt{3}\approx 0.5359\).

**Worked Solution.** Because every future decision faces exactly the same situation
(offers are i.i.d. and the collapse probability is memoryless), the optimal policy is a
single fixed **threshold**: accept an offer iff it is at least some cutoff \(t\), reject
otherwise. Let \(W\) be your expected payoff at the start (before seeing an offer). When you
reject, with probability \(1/2\) you get \(0\) and with probability \(1/2\) you face the same
problem again worth \(W\); so the value of rejecting is \(\tfrac12\cdot 0+\tfrac12 W=\tfrac12 W\).
A rational player accepts the current offer \(x\) exactly when it beats the reject value, i.e.
when \(x\ge \tfrac12 W\). Thus the optimal threshold is \(t=\tfrac12 W\).

Now compute \(W\) self-consistently. Upon seeing an offer \(x\sim\text{Uniform}[0,1]\) you
receive \(\max(x,\;t)\) in expectation-terms — you take \(x\) if it clears the bar, else you
fall back to the continuation value \(t=\tfrac12W\):
\[
W=\mathbb{E}\big[\max(x,t)\big]
=\underbrace{\int_0^{t} t\,dx}_{x<t,\ \text{reject}}+\underbrace{\int_t^1 x\,dx}_{x\ge t,\ \text{accept}}
= t^2+\frac{1-t^2}{2}=\frac12+\frac{t^2}{2}.
\]
Substitute \(t=\tfrac12W\) (so \(W=2t\)) into \(W=\tfrac12+\tfrac{t^2}{2}\):
\[
2t=\frac12+\frac{t^2}{2}\ \Longrightarrow\ 4t=1+t^2\ \Longrightarrow\ t^2-4t+1=0.
\]
The root in \([0,1]\) is \(t=\dfrac{4-\sqrt{12}}{2}=2-\sqrt3\approx0.2679\), giving
\(W=2t=4-2\sqrt3\approx0.5359\). The "aha": the **risk that the opportunity vanishes**
forces you to be *far less picky* than in the classic no-risk version. If offers never
disappeared you could wait indefinitely for a near-1 offer, so no finite threshold would be
optimal; the collapse probability is exactly what makes the problem well-posed and pins the
cutoff down at \(2-\sqrt3\). ("Variance" is not needed here; the whole solution rests on
setting the continuation value equal to the threshold — a fixed-point.)

**Novelty audit.** Closest known object: the "house-selling" / job-search optimal-stopping
model with a per-period continuation (discount) probability — a member of the optimal-
stopping family. It is deliberately **NOT the standard secretary problem** (which pays off
only for picking the single best and uses relative ranks, not values). Honesty flag: the
*method* (threshold = continuation value, fixed-point) is standard stochastic-control fare,
so an OR/finance-trained candidate may recognize the shape; but the specific "reject ⇒ 1/2
chance the deal dies" construction and the clean irrational answer \(2-\sqrt3\) are a
bespoke instance, not a named puzzle sitting online.

**Verification.** Monte-Carlo, 2,000,000 trials at \(t^\*=2-\sqrt3\): simulated EV
**0.53594** vs closed-form **0.53590**. Threshold scan over \(t\in[0,0.6]\) peaked near
\(t\approx0.28\) with EV **0.53597**, confirming \(2-\sqrt3\) is optimal. ✓

---

## 5. The Round-Trip
**Difficulty:** Hard

**Prompt.** A stock's closing price on each of the next three days is an independent
uniform random number on \([0,1]\) (each day's price is revealed only at the end of that
day, and past prices cannot be re-traded). You want to do exactly one round trip: **buy one
share on some day and sell it on a strictly later day**, deciding in real time as prices are
revealed (you cannot see future prices when you act). Concretely: on day 1 you may buy or
wait; on day 2, if you already hold you may sell or keep holding, and if you are flat you
may buy or wait; on day 3, if you hold you sell at that day's price (final chance), and if
you are flat it is too late to complete a round trip (profit \(0\)). Your profit is the
selling price minus the buying price. Playing optimally, what is your maximum expected
profit, and what is the optimal strategy?

**Exact Answer.** Maximum expected profit = **\$1/4 = \$0.25**. Optimal policy: **buy on day
1 iff its price is \(\le 1/2\)**; if you bought on day 1, **sell on day 2 iff day-2 price
\(\ge 1/2\)**, otherwise sell on day 3. If you did *not* buy on day 1, then **buy on day 2
iff its price is \(< 1/2\)** and sell on day 3; otherwise do not trade.

**Worked Solution.** Solve by **backward induction** — work out the value of each situation
starting from the last day and moving earlier. Throughout, the expected value of a fresh
uniform price is \(1/2\).

*Selling side.* If you are holding with only day 3 left, you must sell at day 3, worth
\(1/2\) on average. If you are holding entering day 2 (you bought on day 1), you compare
selling now at \(x_2\) versus holding for the day-3 average \(1/2\): sell iff \(x_2\ge 1/2\).
The expected sale price is
\(\mathbb{E}[\max(x_2,\tfrac12)]=\int_0^{1/2}\tfrac12\,dx+\int_{1/2}^1 x\,dx
=\tfrac14+\tfrac38=\tfrac58.\)
So a share bought on day 1 fetches an expected \(5/8\); a share bought on day 2 fetches an
expected \(1/2\).

*Buying side.* If you are still flat entering day 2 with price \(x_2\), buying yields
expected profit \(\tfrac12-x_2\) (buy at \(x_2\), sell day 3 at expected \(\tfrac12\)); you
buy iff that is positive, i.e. \(x_2<\tfrac12\). The value of being flat entering day 2 is
therefore
\(\mathbb{E}[\max(\tfrac12-x_2,0)]=\int_0^{1/2}(\tfrac12-x)\,dx=\tfrac18.\)

*Day 1.* Seeing \(x_1\), buying yields expected profit \(\tfrac58-x_1\) (you will realize the
\(5/8\) selling value), while waiting is worth \(1/8\). Buy iff \(\tfrac58-x_1\ge\tfrac18\),
i.e. \(x_1\le\tfrac12\). The overall value is
\[
\mathbb{E}\big[\max(\tfrac58-x_1,\ \tfrac18)\big]
=\int_0^{1/2}\!\big(\tfrac58-x\big)dx+\int_{1/2}^1 \tfrac18\,dx
=\Big(\tfrac{5}{16}-\tfrac18\Big)+\tfrac{1}{16}
=\tfrac{3}{16}+\tfrac{1}{16}=\tfrac14.
\]
So the maximum expected profit is exactly \(1/4\). The "aha" is that this is a **two-sided**
optimal-stopping problem — you optimize *both* the entry and the exit, and the two
thresholds happen to both sit at the symmetric value \(1/2\), yet the entry cutoff on day 1
is driven by the *sell-side* continuation value \(5/8\), not by \(1/2\) directly.

**Novelty audit.** Closest known objects: single-transaction "best time to buy and sell"
problems (usually posed on a *known* price array, a deterministic DP) and one-sided value-
maximizing optimal stopping (the "sell to maximize value" problem). This composes **entry
stopping and exit stopping into one online problem over random prices**, which changes the
analysis from either piece and is not, to my knowledge, a named online puzzle. Honesty
flag: each half uses standard stopping logic, so the *techniques* are familiar; the
composition and the clean \(1/4\) answer are the original part.

**Verification.** Monte-Carlo of the stated policy, 3,000,000 trials: **0.24990** vs
\(1/4\). A grid search over all three thresholds (buy-day-1 cutoff, sell-day-2 cutoff,
buy-day-2 cutoff) found the optimum at \((0.50,0.50,0.50)\) with EV **0.2506**, confirming
the policy and value are optimal. ✓

---

## 6. The Inventory Cap
**Difficulty:** Medium–Hard

**Prompt.** A market maker keeps an inventory that starts at 0 and must always stay within
the range \(\{-1, 0, +1\}\) (a strict one-lot risk limit). Customers arrive one after
another; each customer independently wants to trade one lot in a random direction — with
probability 1/2 they buy from the maker (which would move inventory down by 1) and with
probability 1/2 they sell to the maker (inventory up by 1). If the requested trade would
push inventory outside \([-1,+1]\) (e.g. a customer wants to sell to the maker who is
already at \(+1\)), the maker **rejects** that customer and inventory stays where it is; the
rejected customer simply leaves. In the long run (steady state), what fraction of arriving
customers are rejected?

**Exact Answer.** Exactly **1/3** of arriving customers are rejected.

**Worked Solution.** Model the inventory as a **Markov chain** — a system that hops between
states where the next state depends only on the current one. The states are \(-1,0,+1\).
From state \(0\), either trade is allowed, so the chain goes to \(+1\) or \(-1\), each with
probability \(1/2\) (never a rejection at \(0\)). From state \(+1\): a customer buying from
the maker (prob \(1/2\)) moves inventory to \(0\) — accepted; a customer selling to the
maker (prob \(1/2\)) would go to \(+2\) — **rejected**, so the chain stays at \(+1\). State
\(-1\) is the mirror image.

We need the **stationary distribution** \((\pi_{-1},\pi_0,\pi_{+1})\): the long-run fraction
of *time steps* the chain spends in each state, characterized by the balance equations
"probability flowing into a state = probability of being there." By the left–right symmetry
\(\pi_{+1}=\pi_{-1}\). Balance at \(+1\): you arrive at \(+1\) either from \(0\) (with prob
\(\tfrac12\pi_0\)) or by staying at \(+1\) after a rejection (with prob \(\tfrac12\pi_{+1}\)):
\[
\pi_{+1}=\tfrac12\pi_0+\tfrac12\pi_{+1}\ \Longrightarrow\ \tfrac12\pi_{+1}=\tfrac12\pi_0\ \Longrightarrow\ \pi_{+1}=\pi_0.
\]
So all three states are equally likely: \(\pi_{-1}=\pi_0=\pi_{+1}=\tfrac13\).

Finally, a rejection happens only when the chain is at \(+1\) and the customer wants to push
it to \(+2\) (prob \(\tfrac12\)), or at \(-1\) and the customer wants \(-2\) (prob
\(\tfrac12\)); at \(0\) rejection is impossible. So the long-run rejection rate is
\[
\pi_{+1}\cdot\tfrac12+\pi_{-1}\cdot\tfrac12+\pi_0\cdot 0
=\tfrac13\cdot\tfrac12+\tfrac13\cdot\tfrac12=\tfrac13.
\]
The "aha": because the reflecting cap makes the maker *linger* at the boundary states (a
rejection leaves inventory unchanged, so \(+1\) and \(-1\) are "sticky"), all three
inventory levels turn out equally likely, and exactly one-third of order flow is turned away.

**Novelty audit.** Closest known object: a symmetric random walk on \(\{-1,0,1\}\) with
"reflecting"/holding boundaries and its stationary distribution (standard Markov-chain
material). There is **no named puzzle** here. Novelty is in the bespoke market-making /
inventory-limit framing and the clean 1/3 rejection result; the method (stationary
distribution + balance equations) is standard, so this is honest "fresh setup, standard
tool" territory rather than a deep new mechanic.

**Verification.** Monte-Carlo, 20,000,000 steps: rejection fraction **0.33335** vs
closed-form **1/3**. Stationary distribution confirmed \(\approx(1/3,1/3,1/3)\). ✓

---

## Honesty summary — how confident I am that each is genuinely NOT a named online classic

Rated on a 1–5 scale ("5 = confident this exact problem is not sitting online as a named
puzzle"; the *techniques* are standard by design — the bar is not-a-named-reskin):

| # | Title | Difficulty | Confidence it's not a named classic | Note |
|---|-------|-----------|--------------------------------------|------|
| 1 | The Backup Dealer | Easy | **4/5** | Uses the \(\min+\max=a+b\) identity; the surprising-cancellation framing is original, though order-statistics of two uniforms is common. |
| 2 | The Adjacent Cross | Medium | **3/5** | Pure linearity-of-expectation drill in a fresh framing; least exotic — closest to a generic textbook exercise, but not a *named* puzzle. |
| 3 | Walking the Offer Down | Medium | **3.5/5** | Sequential/declining-price pricing is a known *method*; this specific two-round uniform instance (1/4→1/3) is bespoke, not a named puzzle. |
| 4 | The Fading Buyer | Hard | **4/5** | House-selling-style optimal stopping with a per-reject collapse prob; deliberately not the standard secretary problem; clean \(2-\sqrt3\) answer is a bespoke instance. |
| 5 | The Round-Trip | Hard | **4.5/5** | Two-sided (entry+exit) online stopping over random prices; I'm not aware of this exact composition as a named puzzle. |
| 6 | The Inventory Cap | Medium–Hard | **4.5/5** | Standard 3-state Markov tool, but the market-making inventory-cap framing and 1/3 rejection result are bespoke; no named puzzle. |

**Overall honest read:** none of these is a reskin of the banned classics or, to my
knowledge, a specific named puzzle sitting online. #2 and #3 lean on very standard
techniques (linearity; sequential pricing) — real but modest novelty — while #4, #5, and
#6 are the strongest "fresh setup with a real aha and an exact answer." Every numeric answer
was confirmed by Monte-Carlo/brute-force (simulated vs. closed-form shown above); the temp
scripts were deleted. If you want more *mechanical* novelty on #2/#3, I can swap them for
additional composed problems.

**Which of these 1–6 would you like me to add to the app** (and to which level —
Warm-Ups / Classics / Hard — noting the app's `Flashcard` shape: `id, prompt, answer,
explanation, difficulty, concept, source`)? I have **not** modified any app file.
