import type { Flashcard, Level, Track } from "@/types/content";
import {
  adjacentCrossFamily,
  backupDealerFamily,
  fadingBuyerFamily,
  inventoryCapFamily,
  roundTripFamily,
  walkOfferDownFamily,
} from "./generators";

/**
 * Brainteasers — hand-authored from famous, well-established puzzles (fresh
 * wordings, not verbatim from any bank). This track is played as an
 * INTEGRITY-BASED FLASHCARD deck: the learner reads the prompt, reasons on
 * their own, hits "Reveal", and self-assesses. There are deliberately NO
 * multiple-choice options (which are trivially back-solved). Every card has an
 * explicit `answer` to reveal and a strong, self-contained `explanation` of WHY
 * that answer is correct.
 */

const warmups: Flashcard[] = [
  {
    id: "bt-ropes",
    prompt:
      "You have two ropes; each takes exactly 60 minutes to burn end-to-end, but they burn at a non-uniform rate (so half the rope does NOT take half the time). Using only these ropes and a lighter, how do you measure exactly 45 minutes?",
    answer:
      "Light rope A at BOTH ends and rope B at ONE end at the same instant. When A finishes burning (30 minutes), immediately light B's other end. B then finishes 15 minutes later — 30 + 15 = 45 minutes total.",
    explanation:
      "Each rope holds '60 minutes' worth of burn. Lighting a rope at both ends sends two flame fronts toward each other, and together they always consume the entire rope in 60 ÷ 2 = 30 minutes — regardless of the uneven rate, because the two fronts must meet exactly when all the rope is gone. Start A (both ends) and B (one end) together. The moment A is consumed, exactly 30 minutes have elapsed and rope B has 30 minutes of burn remaining. Now light B's second end: those remaining 30 minutes are eaten by two fronts in 15 minutes. 30 + 15 = 45. The key trick is that 'both ends' halves the elapsed TIME even though you can never predict how much LENGTH corresponds to a given time.",
    difficulty: "easy",
    concept: "Rate / simultaneous processes",
    source: "Classic burning-rope fuse puzzle",
  },
  {
    id: "bt-bridge",
    prompt:
      "Four people must cross a bridge at night with a single torch; at most two can cross at a time, and a pair moves at the slower person's pace. Their individual crossing times are 1, 2, 5, and 10 minutes. What is the minimum total time for all four to get across?",
    answer:
      "17 minutes. Send 1 & 2 across (2), 1 returns (1), send 5 & 10 across (10), 2 returns (2), send 1 & 2 across (2): 2 + 1 + 10 + 2 + 2 = 17.",
    explanation:
      "The torch has to be carried back after each crossing, so the whole problem is about minimizing how often the slow people (5 and 10) move and making them move together. The naive strategy — the fastest person (1) escorts everyone one by one — costs 1+10+1+5+1+2 = 20, or 19 if you optimize the last leg. The optimal idea is to burn one round trip getting the two fastest to the far side, then send the two SLOWEST across together so the 10 and 5 overlap into a single 10-minute crossing (you only 'pay' for the 10 once), then use the fast person already waiting to shuttle the torch back. Concretely: 1&2 cross (2), 1 returns (1), 5&10 cross (10), 2 returns (2), 1&2 cross (2) = 17 minutes. Pairing the two slowest is what beats the intuitive 'always use the fastest as escort' plan.",
    difficulty: "easy",
    concept: "Optimization / greedy vs optimal",
    source: "Bridge-and-torch puzzle",
  },
  {
    id: "bt-backup-dealer",
    prompt:
      "You need to buy exactly one share and you ask two independent dealers for a price. Each dealer's quote is an independent random number drawn uniformly from the interval between $0 and $1 (every value in that range is equally likely). You naturally intend to trade at the cheaper of the two quotes. However, the cheaper dealer is only reachable half the time: when you try to hit the better quote, with probability exactly 1/2 that dealer's line is busy and you are forced to trade at the other (more expensive) quote instead; with probability 1/2 you get the cheaper quote as intended. What is the expected price you end up paying?",
    answer:
      "$0.50 — exactly the same as if you had ignored both quotes and traded with a single dealer at random.",
    explanation:
      "The 'expected value' of a quantity is the average of its possible values weighted by their probabilities. Call the two quotes X and Y; each is uniform on [0, 1], so on its own each has expected value 1/2. Write m = min(X, Y) for the cheaper quote and M = max(X, Y) for the dearer one. With probability 1/2 you pay m and with probability 1/2 you pay M, so your expected cost is ½·E[m] + ½·E[M] = ½·(E[m] + E[M]).\n\nHere is the key identity: for ANY two numbers, the smaller plus the larger equals the two originals added together — i.e. m + M = X + Y always. Taking expectations, E[m] + E[M] = E[X] + E[Y] = 1/2 + 1/2 = 1. So your expected cost is ½·1 = 1/2.\n\nThe 'aha' is that the 50/50 backup EXACTLY cancels the advantage of shopping for the minimum: averaging the min and the max with equal weight is the same as averaging the two original quotes. (You never even need the fact that E[min] = 1/3 and E[max] = 2/3 for two uniforms — though those are consistent: 1/3 + 2/3 = 1.) In general, if you got the cheaper quote with probability p, your expected cost would be p·(1/3) + (1−p)·(2/3) = 2/3 − p/3, which only beats 1/2 when p > 1/2.",
    difficulty: "easy",
    concept: "Expected value / order statistics (min + max identity)",
    source: "Original house brainteaser",
  },
  {
    id: "bt-lockers",
    prompt:
      "100 lockers all start closed. Person k (for k = 1..100) walks by and toggles every k-th locker (person 1 toggles all, person 2 toggles 2,4,6,…, and so on). After all 100 people have passed, how many lockers are left OPEN?",
    answer:
      "10 lockers are open — exactly the perfect squares: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100.",
    explanation:
      "Locker n gets toggled once by each person whose number divides n, so its final state depends on how many divisors n has: it ends OPEN iff n has an ODD number of divisors. Divisors normally pair up as (d, n/d) — for example 12 gives (1,12), (2,6), (3,4) — producing an even count, which returns the locker to closed. That pairing only breaks when d = n/d, i.e. when n is a perfect square and its square root has no distinct partner. So precisely the perfect squares end up with an odd divisor count and stay open. Between 1 and 100 there are 10 perfect squares (1² through 10²), hence 10 open lockers.",
    difficulty: "medium",
    concept: "Divisor parity / perfect squares",
    source: "100 lockers / factors puzzle",
  },
  {
    id: "bt-switches",
    prompt:
      "Three off/on switches are downstairs; exactly one controls a single light bulb upstairs (the others do nothing). You may flip the switches as much as you like, but you may walk upstairs to look only ONCE. How do you determine which switch controls the bulb?",
    answer:
      "Use heat as a second signal. Turn switch 1 ON for a few minutes, then turn it OFF. Turn switch 2 ON and immediately go upstairs. If the bulb is lit → switch 2. If it's off but warm → switch 1. If it's off and cold → switch 3.",
    explanation:
      "On/off alone gives each bulb only two states, which is not enough to distinguish three switches from a single look. The insight is to manufacture a THIRD observable state — temperature. Leaving switch 1 on long enough heats its bulb; switching it back off before you go up leaves that bulb dark but noticeably warm. Switch 2 you leave on, so its bulb is lit. Switch 3 you never touch, so its bulb is dark and cold. Upstairs you can now read three distinguishable conditions — lit, off-and-warm, off-and-cold — each mapping uniquely to switch 2, switch 1, and switch 3. Creating an extra information channel (here, heat) out of the physical setup is the whole lesson.",
    difficulty: "medium",
    concept: "Adding an information channel",
    source: "Three switches, one bulb",
  },
];

const classics: Flashcard[] = [
  {
    id: "bt-adjacent-cross",
    prompt:
      "A trading queue contains 8 buy orders and 8 sell orders — 16 orders in total — lined up in a single row in a completely random order (every possible ordering of the 16 tickets is equally likely). Scanning the row from left to right, you count a 'cross' every time a buy order is immediately followed by a sell order in adjacent positions. What is the expected number of such buy-then-sell crosses in the row?",
    answer:
      "Exactly 4. (In general, for n buys and n sells, the expected count is n/2.)",
    explanation:
      "The powerful tool here is LINEARITY OF EXPECTATION: the expected value of a sum of random quantities equals the sum of their individual expected values — even when those quantities are not independent. There are 16 − 1 = 15 adjacent slots (positions 1–2, 2–3, …, 15–16). For slot i, define an indicator I_i that equals 1 if that pair is 'buy then sell' and 0 otherwise. The number of crosses is I_1 + … + I_15, so its expectation is the sum over slots of P(slot i is B then S).\n\nFor a single fixed adjacent slot, the chance the left card is a buy is 8/16; given that, the chance the right card is a sell is 8/15 (8 sells remain among the 15 other cards). So each slot is a cross with probability (8/16)·(8/15) = (1/2)·(8/15) = 8/30 = 4/15. Multiplying by the 15 slots: 15·(4/15) = 4.\n\nThe 'aha' is that even though neighboring slots overlap (they share a card) and are therefore DEPENDENT, linearity lets you ignore that entirely and just add per-slot probabilities. In general the per-slot probability is (n/2n)·(n/(2n−1)) = n/(2(2n−1)), and multiplying by the 2n−1 slots gives exactly n/2, independent of the messy dependence structure.",
    difficulty: "medium",
    concept: "Linearity of expectation",
    source: "Original house brainteaser",
  },
  {
    id: "bt-walk-offer-down",
    prompt:
      "You are selling one unit to a single buyer whose private maximum willingness to pay, V, is a random number uniform on [0, 1] (you do not observe it). You may quote a take-it-or-leave-it ask. If your ask is at most V, the buyer accepts and you earn your ask; if your ask exceeds V, the buyer declines and — crucially — you are then allowed to make exactly one more, strictly lower ask, which the buyer accepts if it is at most V (otherwise the buyer walks and you earn 0). The buyer is myopic: at each ask they simply accept whenever the price does not exceed their value V. Choosing both asks optimally in advance, (a) what two prices should you quote, and (b) what is your maximum expected revenue? For contrast, what would a single-ask seller earn?",
    answer:
      "Quote $2/3 first, then $1/3; maximum expected revenue = $1/3. A single-ask seller's best is to quote $1/2 for expected revenue $1/4 — the second chance lifts revenue from 1/4 to 1/3, a 33% improvement.",
    explanation:
      "With a SINGLE ask p, the buyer accepts with probability P(V ≥ p) = 1 − p (since V is uniform on [0, 1], the chance it lands above p is the length 1 − p), so expected revenue is p·(1 − p). This parabola peaks at p = 1/2, giving (1/2)·(1/2) = 1/4.\n\nNow allow a fallback. Let the first ask be p₁ and the lower fallback be p₂ < p₁. There are two disjoint ways to earn money:\n • The buyer accepts the first ask: needs V ≥ p₁, probability 1 − p₁, earning p₁ → contribution p₁·(1 − p₁).\n • The buyer declines the first but accepts the fallback: needs p₂ ≤ V < p₁, probability p₁ − p₂, earning p₂ → contribution p₂·(p₁ − p₂).\n\nSo expected revenue is R = p₁·(1 − p₁) + p₂·(p₁ − p₂). Optimize the fallback first: for fixed p₁, the term p₂·(p₁ − p₂) is a parabola in p₂ maximized at p₂ = p₁/2, where it equals p₁²/4. Substitute: R = p₁·(1 − p₁) + p₁²/4 = p₁ − (3/4)·p₁². Setting the derivative to zero: 1 − (3/2)·p₁ = 0, so p₁ = 2/3, hence p₂ = 1/3. The revenue is 2/3 − (3/4)·(4/9) = 2/3 − 1/3 = 1/3.\n\nThe 'aha': a second, lower quote lets you price-discriminate OVER TIME — capture the high-value buyers at 2/3, then recover a sale from the medium-value buyers at 1/3 — which strictly beats any single price. Note the fallback 1/3 is NOT the single-ask optimum 1/2; the whole schedule shifts because the first ask has already 'creamed off' the top of the distribution.",
    difficulty: "medium",
    concept: "Sequential pricing / price discrimination",
    source: "Original house brainteaser",
  },
  {
    id: "bt-8balls",
    prompt:
      "You have 8 identical-looking balls; exactly one is slightly heavier than the rest. Using only a two-pan balance scale (no weights), what is the minimum number of weighings that GUARANTEES you find the heavy ball, and how?",
    answer:
      "2 weighings. Split the balls 3-3-2 and weigh the two groups of 3. If one side sinks, weigh two of those 3 against each other. If the 3-vs-3 balances, weigh the leftover 2 against each other.",
    explanation:
      "A balance scale returns one of three outcomes — left heavier, right heavier, or balanced — so each weighing yields a base-3 'digit' of information, and k weighings can distinguish up to 3^k possibilities. With 8 candidates you want to split into three roughly equal groups: 3, 3, and 2. First weighing (3 vs 3): if one pan drops, the heavy ball is among those 3; if the pans balance, it's among the untouched 2. Second weighing: in the group of 3, weigh any two balls against each other — the heavier pan reveals it, or if they balance it's the third ball; in the group of 2, just weigh them directly. Either branch finishes in exactly 2 weighings. The common mistake is to split in half (4 vs 4), which throws away the informative 'balanced' outcome and needs a third weighing.",
    difficulty: "medium",
    concept: "Information per weighing (ternary)",
    source: "Balance-scale weighing puzzle",
  },
  {
    id: "bt-poison",
    prompt:
      "You have 1000 bottles of wine; exactly one is poisoned, and the poison kills a taster in about 24 hours. You have 24 hours before a banquet and some disposable 'testers'. What is the minimum number of testers needed to guarantee identifying the poisoned bottle in time?",
    answer:
      "10 testers. Number the bottles 0–999 in 10-bit binary; tester i drinks from every bottle whose i-th bit is 1. After 24 hours, the pattern of which testers die spells the poisoned bottle's number in binary.",
    explanation:
      "Because you only get one 24-hour round, you must extract all the information in parallel. Assign each tester to one bit position of the bottles' 10-bit binary labels (0000000000 … 1111100111). Tester i takes a sip from every bottle that has a 1 in bit position i. All sips happen simultaneously. After 24 hours, read the dead/alive status of the 10 testers as a 10-bit number, where 'dead' = 1: that binary number is exactly the label of the poisoned bottle, because a tester dies iff the poisoned bottle had a 1 in their bit. Ten bits encode 2^10 = 1024 distinct values ≥ 1000, so 10 testers suffice. This is essentially running 10 yes/no questions ('is the poisoned bottle's bit i set?') at once.",
    difficulty: "hard",
    concept: "Binary encoding",
    source: "Poisoned wine / binary encoding",
  },
  {
    id: "bt-monty",
    prompt:
      "On a game show, a car sits behind one of three doors and goats behind the other two. You pick a door. The host — who knows what's behind every door — opens a DIFFERENT door revealing a goat, then offers to let you switch to the remaining unopened door. Should you switch, and what is your probability of winning if you do?",
    answer:
      "Yes, switch — you win with probability 2/3. Staying wins only 1/3 of the time.",
    explanation:
      "When you first pick, you're right 1/3 of the time and wrong 2/3 of the time; equivalently, the car is behind one of the OTHER two doors with probability 2/3. The host then always opens a losing door among those two — a deliberate, informed action, not a random one. That reveal never changes the 1/3 chance your original door is correct, but it collapses the entire 2/3 that was spread over the other two doors onto the single remaining unopened door. So switching wins whenever your first guess was wrong, which is 2/3 of the time. The classic error is to think the two remaining closed doors are now a 50/50 coin flip; that reasoning ignores that the host's choice of which door to open carried information.",
    difficulty: "medium",
    concept: "Conditional probability / information",
    source: "Monty Hall problem",
  },
  {
    id: "bt-25horses",
    prompt:
      "You have 25 horses and a track that races exactly 5 horses at a time. You have no stopwatch — each race only tells you the finishing ORDER of those 5. What is the minimum number of races needed to identify the 3 fastest horses overall?",
    answer:
      "7 races. Race 5 groups of 5 (5 races), race the 5 group-winners (race 6), then race a specific set of 5 contenders for places 2 and 3 (race 7).",
    explanation:
      "Without a timer you only learn relative order within a single race. Step 1: divide the 25 horses into 5 groups of 5 and race each group — 5 races — giving a full ranking inside every group. Step 2 (race 6): race the 5 group winners; the winner of this race is the fastest horse overall. Call the groups A, B, C, D, E by how their winners placed here (A1 > B1 > C1 > …). Step 3: figure out who can still be 2nd or 3rd overall. Groups D and E are eliminated entirely (their best is at best 4th). Only five horses remain possible: A2 and A3 (they trail only A1), B1 and B2 (B1 lost only to A1), and C1 (lost only to A1 and B1). Race those 5 (race 7); the top two finishers are the 2nd- and 3rd-fastest overall. Total = 5 + 1 + 1 = 7. The frequent slip is stopping at 6 and forgetting the final race that separates places 2 and 3.",
    difficulty: "hard",
    concept: "Tournament / partial ordering",
    source: "25 horses, 5 lanes puzzle",
  },
  {
    id: "bt-2eggs",
    prompt:
      "You have 2 identical eggs and a 100-floor building. An egg breaks if dropped from floor H or above (H is unknown) and survives any drop below H. You want to find H while minimizing the WORST-CASE number of drops. How many drops do you need to guarantee finding H?",
    answer:
      "14 drops in the worst case. Drop the first egg from floors 14, 27, 39, 50, 60, 69, 77, 84, 90, 95, 99, 100 (steps shrinking by 1); when it breaks, walk up one floor at a time with the second egg.",
    explanation:
      "With only two eggs you can't binary-search, because once the first egg breaks you must switch to a floor-by-floor linear search upward from the last known safe floor (you can't risk your last egg on a big jump). The elegant strategy makes the worst case identical no matter where H is. Drop the first egg from floor 14; if it survives, go up 13 floors to 27; if it survives again, up 12 to 39; and so on, reducing the jump by one each time. The reasoning: each first-egg drop that survives 'spends' one drop but also shrinks the remaining linear-search span by one, keeping the total worst case constant. The number of floors reachable in n drops is n + (n−1) + … + 1 = n(n+1)/2, and you need that to be at least 100. The smallest n with n(n+1)/2 ≥ 100 is 14, since 14·15/2 = 105 ≥ 100 while 13·14/2 = 91 < 100.",
    difficulty: "hard",
    concept: "Minimax / triangular numbers",
    source: "Two-egg drop puzzle",
  },
];

const hard: Flashcard[] = [
  {
    id: "bt-fading-buyer",
    prompt:
      "You are trying to sell one block of stock. Interested buyers arrive one at a time, and each independently offers a price that is a uniform random number on [0, 1] (every value equally likely). When an offer arrives you must immediately either ACCEPT it (the sale is done at that price and the game ends) or REJECT it (that offer is gone forever, no recall). Here is the catch: each time you reject an offer, there is a probability of exactly 1/2 that the entire deal collapses — the block gets sold elsewhere and you walk away with 0 — and a probability 1/2 that another buyer arrives. There is no limit on the number of buyers as long as the deal has not collapsed. Playing optimally to maximize your expected sale price, (a) what acceptance rule should you use, and (b) what is your expected payoff?",
    answer:
      "Accept the first offer that is at least the threshold t* = 2 − √3 ≈ 0.2679; reject anything below it. Expected payoff W = 4 − 2√3 ≈ 0.5359.",
    explanation:
      "Because every future decision faces exactly the same situation (offers are i.i.d. and the collapse probability is memoryless), the optimal policy is a single fixed THRESHOLD: accept an offer if and only if it is at least some cutoff t, reject otherwise. Let W be your expected payoff at the start (before seeing an offer). When you reject, with probability 1/2 you get 0 and with probability 1/2 you face the same problem again worth W; so the value of rejecting is ½·0 + ½·W = W/2. A rational player accepts the current offer x exactly when it beats the reject value, i.e. when x ≥ W/2. Thus the optimal threshold is t = W/2.\n\nNow compute W self-consistently. Upon seeing an offer x uniform on [0, 1] you effectively receive max(x, t): you take x if it clears the bar, else you fall back to the continuation value t = W/2. Splitting the average at t:\n W = E[max(x, t)] = (integral of t from 0 to t) + (integral of x from t to 1) = t² + (1 − t²)/2 = 1/2 + t²/2.\n\nSubstitute t = W/2 (so W = 2t) into W = 1/2 + t²/2: 2t = 1/2 + t²/2 → 4t = 1 + t² → t² − 4t + 1 = 0. The root in [0, 1] is t = (4 − √12)/2 = 2 − √3 ≈ 0.2679, giving W = 2t = 4 − 2√3 ≈ 0.5359.\n\nThe 'aha': the RISK that the opportunity vanishes forces you to be far LESS picky than in the classic no-risk version. If offers never disappeared you could wait indefinitely for a near-1 offer, so no finite threshold would be optimal; the collapse probability is exactly what makes the problem well-posed and pins the cutoff at 2 − √3. The whole solution rests on setting the continuation value equal to the threshold — a fixed point (t = W/2).",
    difficulty: "hard",
    concept: "Optimal stopping (threshold = continuation value)",
    source: "Original house brainteaser",
  },
  {
    id: "bt-round-trip",
    prompt:
      "A stock's closing price on each of the next three days is an independent uniform random number on [0, 1] (each day's price is revealed only at the end of that day, and past prices cannot be re-traded). You want to do exactly one round trip: buy one share on some day and sell it on a strictly later day, deciding in real time as prices are revealed (you cannot see future prices when you act). Concretely: on day 1 you may buy or wait; on day 2, if you already hold you may sell or keep holding, and if you are flat you may buy or wait; on day 3, if you hold you sell at that day's price (final chance), and if you are flat it is too late to complete a round trip (profit 0). Your profit is the selling price minus the buying price. Playing optimally, what is your maximum expected profit, and what is the optimal strategy?",
    answer:
      "Maximum expected profit = $1/4 = $0.25. Buy on day 1 iff its price ≤ 1/2; if you bought on day 1, sell on day 2 iff day-2 price ≥ 1/2, otherwise sell on day 3. If you did NOT buy on day 1, then buy on day 2 iff its price < 1/2 and sell on day 3; otherwise do not trade.",
    explanation:
      "Solve by BACKWARD INDUCTION — work out the value of each situation starting from the last day and moving earlier. Throughout, the expected value of a fresh uniform price is 1/2.\n\nSelling side. If you are holding with only day 3 left, you must sell at day 3, worth 1/2 on average. If you are holding entering day 2 (you bought on day 1), you compare selling now at x₂ versus holding for the day-3 average 1/2: sell iff x₂ ≥ 1/2. The expected sale price is E[max(x₂, 1/2)] = (integral of 1/2 from 0 to 1/2) + (integral of x from 1/2 to 1) = 1/4 + 3/8 = 5/8. So a share bought on day 1 fetches an expected 5/8; a share bought on day 2 fetches an expected 1/2.\n\nBuying side. If you are still flat entering day 2 with price x₂, buying yields expected profit 1/2 − x₂ (buy at x₂, sell day 3 at expected 1/2); you buy iff that is positive, i.e. x₂ < 1/2. The value of being flat entering day 2 is therefore E[max(1/2 − x₂, 0)] = (integral of (1/2 − x) from 0 to 1/2) = 1/8.\n\nDay 1. Seeing x₁, buying yields expected profit 5/8 − x₁ (you will realize the 5/8 selling value), while waiting is worth 1/8. Buy iff 5/8 − x₁ ≥ 1/8, i.e. x₁ ≤ 1/2. The overall value is E[max(5/8 − x₁, 1/8)] = (integral of (5/8 − x) from 0 to 1/2) + (integral of 1/8 from 1/2 to 1) = 3/16 + 1/16 = 1/4.\n\nSo the maximum expected profit is exactly 1/4. The 'aha' is that this is a TWO-SIDED optimal-stopping problem — you optimize both the entry and the exit, and the two thresholds happen to both sit at the symmetric value 1/2, yet the entry cutoff on day 1 is driven by the sell-side continuation value 5/8, not by 1/2 directly.",
    difficulty: "hard",
    concept: "Optimal stopping (two-sided) / backward induction",
    source: "Original house brainteaser",
  },
  {
    id: "bt-inventory-cap",
    prompt:
      "A market maker keeps an inventory that starts at 0 and must always stay within the range {−1, 0, +1} (a strict one-lot risk limit). Customers arrive one after another; each customer independently wants to trade one lot in a random direction — with probability 1/2 they buy from the maker (which would move inventory down by 1) and with probability 1/2 they sell to the maker (inventory up by 1). If the requested trade would push inventory outside [−1, +1] (e.g. a customer wants to sell to a maker who is already at +1), the maker REJECTS that customer and inventory stays where it is; the rejected customer simply leaves. In the long run (steady state), what fraction of arriving customers are rejected?",
    answer:
      "Exactly 1/3 of arriving customers are rejected.",
    explanation:
      "Model the inventory as a MARKOV CHAIN — a system that hops between states where the next state depends only on the current one. The states are −1, 0, +1. From state 0, either trade is allowed, so the chain goes to +1 or −1, each with probability 1/2 (never a rejection at 0). From state +1: a customer buying from the maker (prob 1/2) moves inventory to 0 — accepted; a customer selling to the maker (prob 1/2) would go to +2 — REJECTED, so the chain stays at +1. State −1 is the mirror image.\n\nWe need the STATIONARY DISTRIBUTION (π₋₁, π₀, π₊₁): the long-run fraction of steps the chain spends in each state, characterized by the balance equations 'probability flowing into a state = probability of being there.' By the left–right symmetry, π₊₁ = π₋₁. Balance at +1: you arrive at +1 either from 0 (with prob ½·π₀) or by staying at +1 after a rejection (with prob ½·π₊₁):\n π₊₁ = ½·π₀ + ½·π₊₁  ⟹  ½·π₊₁ = ½·π₀  ⟹  π₊₁ = π₀.\nSo all three states are equally likely: π₋₁ = π₀ = π₊₁ = 1/3.\n\nFinally, a rejection happens only when the chain is at +1 and the customer wants to push it to +2 (prob 1/2), or at −1 and the customer wants −2 (prob 1/2); at 0 rejection is impossible. So the long-run rejection rate is π₊₁·(1/2) + π₋₁·(1/2) + π₀·0 = (1/3)·(1/2) + (1/3)·(1/2) = 1/3.\n\nThe 'aha': because the reflecting cap makes the maker LINGER at the boundary states (a rejection leaves inventory unchanged, so +1 and −1 are 'sticky'), all three inventory levels turn out equally likely, and exactly one-third of order flow is turned away.",
    difficulty: "hard",
    concept: "Markov chains / steady state (balance equations)",
    source: "Original house brainteaser",
  },
  {
    id: "bt-12balls",
    prompt:
      "You have 12 identical-looking balls; exactly one is 'odd' — it is either heavier OR lighter than the rest, and you don't know which. Using only a two-pan balance scale, what is the minimum number of weighings that guarantees identifying the odd ball AND whether it is heavy or light?",
    answer:
      "3 weighings. (There are 24 possibilities and each weighing has 3 outcomes, so you need at least log₃24 ≈ 2.9 → 3, and 3 is achievable with the classic 4-4 scheme.)",
    explanation:
      "First bound the answer by counting: the odd ball could be any of 12, and it could be heavy or light, giving 12 × 2 = 24 distinct cases to tell apart. Each weighing has three results (left down, right down, balanced), so k weighings can distinguish at most 3^k cases. Since 3^2 = 9 < 24 but 3^3 = 27 ≥ 24, three weighings are the information-theoretic minimum. Three is also achievable: weigh 4 vs 4. If they balance, the odd ball is among the 4 set aside, and two further weighings against known-good balls isolate it and its direction. If the first weighing tips, you know the odd ball is in those 8 and you have a candidate direction for each side; a carefully designed second weighing that rotates some balls across pans and sets others aside narrows it to a few cases, and the third weighing pins down both the ball and whether it is heavy or light. The takeaway: bound the problem by outcome-counting first, then construct a scheme that splits the remaining cases into three near-equal groups each step.",
    difficulty: "hard",
    concept: "Information theory bound (ternary)",
    needsVerification: true,
    source: "12-ball (heavy or light) weighing puzzle",
  },
  {
    id: "bt-blueeyes",
    prompt:
      "On an island, 100 people have blue eyes and 100 have brown eyes. No one knows their own eye color, there are no mirrors, and they never discuss it; anyone who logically deduces their own eye color must leave that midnight. One day a trusted visitor announces to everyone: 'At least one of you has blue eyes.' On which night do the blue-eyed people leave?",
    answer:
      "On the 100th night — all 100 blue-eyed islanders leave together that night.",
    explanation:
      "Use induction on the number of blue-eyed people. Base case: if there were exactly 1 blue-eyed person, they'd see no other blue eyes, so the announcement 'at least one' tells them it must be them — they leave on night 1. With 2 blue-eyed people, each sees exactly 1 other and reasons, 'if I'm not blue, that person is the only blue-eyed one and will leave on night 1.' When night 1 passes and nobody leaves, each of the two concludes they must also be blue and both leave on night 2. In general, with k blue-eyed people, each one sees k−1 others and waits: 'if there were only k−1, they'd all leave on night k−1.' When night k−1 passes with no departures, all k deduce simultaneously that they are blue and leave together on night k. With k = 100 that is the 100th night. The subtle part is why the visitor's announcement matters even though everyone can already SEE blue eyes: it converts that fact into COMMON KNOWLEDGE (everyone knows that everyone knows … that at least one is blue), which is exactly what seeds and synchronizes the induction.",
    difficulty: "expert",
    concept: "Common knowledge / induction",
    needsVerification: true,
    source: "Blue-eyed islanders / common knowledge",
  },
  {
    id: "bt-pirates",
    prompt:
      "5 perfectly rational, greedy pirates ranked 1 (lowest) to 5 (highest) must split 100 gold coins. The highest-ranked pirate proposes a split; ALL pirates (including the proposer) vote. If at least half approve, it passes; otherwise the proposer is thrown overboard and the next-highest proposes, and so on. Each pirate prefers gold, but prefers staying alive above all, and enjoys throwing others overboard as a tie-breaker. How many coins does the top pirate keep with optimal play?",
    answer:
      "98 coins. The optimal proposal is {P5: 98, P4: 0, P3: 1, P2: 0, P1: 1}, which passes 3-to-2.",
    explanation:
      "Solve by backward induction, starting from the smallest subgame and working up. With 2 pirates left (P2, P1): P2 proposes and only needs 'at least half' of 2 votes — his own suffices — so he takes all 100 and P1 gets 0. With 3 left (P3, P2, P1): P3 needs one more vote besides his own. P1 gets 0 in the 2-pirate outcome, so offering P1 a single coin buys his vote: {99, 0, 1}. With 4 left (P4, P3, P2, P1): P4 needs one extra vote; P2 would get 0 in the 3-pirate outcome, so 1 coin buys P2: {99, 0, 1, 0}. With all 5: P5 needs two extra votes beyond his own (3 of 5). The pirates who would get 0 in the 4-pirate outcome are P3 and P1, so bribing each with a single coin secures their votes: {98, 0, 1, 0, 1}. P5 keeps 98. The engine of the solution is that every pirate votes yes only if the current offer beats what they'd receive after the proposer is thrown overboard — so the proposer buys exactly the cheapest majority.",
    difficulty: "expert",
    concept: "Backward induction / game theory",
    needsVerification: true,
    source: "Pirate game (backward induction)",
  },
  {
    id: "bt-100prisoners-switch",
    prompt:
      "100 prisoners are taken one at a time, in random order with repeats allowed, into a room containing a single light switch (initial state known). A prisoner may flip the switch or not, and at any visit may declare 'everyone has now visited at least once.' If the declaration is ever wrong, all are executed; they may agree on a strategy beforehand but cannot communicate afterward except through the switch. What strategy guarantees eventual success?",
    answer:
      "Elect one 'counter'. Every OTHER prisoner turns the light ON the first time (and only the first time) they enter and find it off. The counter is the only one who ever turns it OFF, adding 1 to a tally each time. When the counter's tally reaches 99, he declares that everyone has visited.",
    explanation:
      "A single light bit can't directly encode 100 people's visits, so the strategy funnels all the information through one designated person, the counter. Each non-counter contributes exactly ONE reliable signal: the first time they enter and see the light off, they turn it on; on every later visit they leave it untouched. This guarantees a non-counter turns the light on at most once in the entire process. The counter does the opposite: whenever he enters and finds the light ON, he turns it off and increments his private count by one — and because only non-counters ever turn it on, and each does so at most once, every 'on' the counter sees corresponds to a distinct, first-time visitor. When his count reaches 99, all 99 non-counters must each have visited at least once (and the counter himself obviously has), so he can safely declare that everyone has visited. The random order and repeated visits don't threaten correctness — they only affect how LONG it takes — because the protocol never double-counts anyone.",
    difficulty: "expert",
    concept: "Distributed counting protocol",
    needsVerification: true,
    source: "100 prisoners and a light switch",
  },
];

const levels: Level[] = [
  {
    id: "bt-1",
    title: "Logic Warm-Ups",
    subtitle: "Rates, optimization, and lateral thinking",
    blurb:
      "Reason-it-out flashcards on rates and lateral thinking — burning ropes, the bridge crossing, 100 lockers, and three switches.",
    difficulty: "easy",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: warmups,
    // Infinite, exact-verified originals for "Give me another at this difficulty"
    // (bonus only — never touches mastery). The Backup Dealer is the easy family.
    flashcardGenerators: [backupDealerFamily],
    lesson: {
      paragraphs: [
        "Brainteasers test how you *structure* a problem under pressure, not obscure facts. Interviewers watch your reasoning out loud far more than the final number — so these are flashcards: think it through honestly, reveal the answer, then be strict with yourself about whether you truly had it.",
        "Two reliable moves: (1) look for a second 'channel' of information (heat, parity, order), and (2) reason about *rates* — burning a rope from both ends doubles its rate, so it finishes in half the time regardless of uneven burning.",
      ],
      keyIdea:
        "Find an extra observable state or invariant; then the puzzle usually collapses.",
      whyInterviewers:
        "Firms use these to see if you panic or decompose. Narrate your reasoning.",
    },
  },
  {
    id: "bt-2",
    title: "Classic Puzzles",
    subtitle: "Weighings, encodings, and the Monty Hall trap",
    blurb:
      "Information-counting classics: balance-scale weighings, binary poisoned-bottle encoding, Monty Hall, 25 horses, and the two-egg drop.",
    difficulty: "medium",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: classics,
    // Two medium originals generate infinitely (bonus only). The famous static
    // classics (8 balls, poison, Monty, 25 horses, 2 eggs) stay fixed.
    flashcardGenerators: [adjacentCrossFamily, walkOfferDownFamily],
    lesson: {
      paragraphs: [
        "Many 'hard' teasers are really about how much INFORMATION a step gives you. A balance scale has three outcomes (left, right, equal), so k weighings distinguish 3^k cases — always count outcomes before you start.",
        "Encoding puzzles (poisoned bottles) map objects to binary strings so parallel yes/no tests read off the answer. And beware the Monty Hall trap: a host's informed action changes the conditional probabilities. Reveal each answer only after you've committed to your own reasoning.",
      ],
      keyIdea: "Count the information each action yields (log base #outcomes).",
      whyInterviewers:
        "Tests whether you quantify information rather than guess.",
    },
  },
  {
    id: "bt-3",
    title: "Hard Brainteasers",
    subtitle: "Induction, game theory, and protocols",
    blurb:
      "Expert puzzles via backward induction and protocols: the 12-ball weighing, blue-eyed islanders, pirates, and the prisoners' switch.",
    difficulty: "expert",
    mode: "flashcard",
    masteryThreshold: 0.7,
    flashcards: hard,
    // Three hard originals generate infinitely (bonus only). The famous static
    // classics (12 balls, blue eyes, pirates, prisoners) stay fixed.
    flashcardGenerators: [fadingBuyerFamily, roundTripFamily, inventoryCapFamily],
    lesson: {
      paragraphs: [
        "The hardest teasers reward two techniques: backward induction (solve the smallest case, then build up — pirates, blue eyes) and designing a protocol that turns a shared resource into a reliable counter (the light-switch prisoners).",
        "When a problem feels impossible, shrink it: what if there were 1 pirate? 1 blue-eyed person? 2 prisoners? The base case usually reveals the invariant that scales. Reveal only after you've genuinely tried to derive it.",
      ],
      keyIdea: "Shrink to the base case; find the invariant; induct upward.",
      whyInterviewers:
        "These separate candidates who memorized answers from those who can derive them.",
    },
  },
];

export const brainteasersTrack: Track = {
  id: "brainteasers",
  title: "Brainteasers",
  tagline: "Think like a trader under pressure",
  description:
    "Famous logic and quant puzzles, from burning ropes to the blue-eyed islanders. Reason it out, reveal the answer, and be honest about whether you had it.",
  motif: "brainteasers",
  levels,
};
