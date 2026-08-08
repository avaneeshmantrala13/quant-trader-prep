import type { Flashcard, Level, Track } from "@/types/content";
import {
  adjacentCrossFamily,
  backupDealerFamily,
  fadingBuyerFamily,
  inventoryCapFamily,
  roundTripFamily,
  walkOfferDownFamily,
} from "./generators";
import {
  binaryWeightsFamily,
  digitProductFamily,
  houseOfCardsFamily,
  lockerToggleFamily,
  modularHatsFamily,
  pigeonholeFamily,
  subtractionGameFamily,
  trailingZerosFamily,
  twoBallsFamily,
} from "./techniqueGenerators";

/**
 * Brainteasers, hand-authored from famous, well-established puzzles (fresh
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
      "Light rope A at BOTH ends and rope B at ONE end at the same instant. When A finishes burning (30 minutes), immediately light B's other end. B then finishes 15 minutes later, 30 + 15 = 45 minutes total.",
    explanation:
      "Each rope holds '60 minutes' worth of burn. Lighting a rope at both ends sends two flame fronts toward each other, and together they always consume the entire rope in 60 ÷ 2 = 30 minutes, regardless of the uneven rate, because the two fronts must meet exactly when all the rope is gone. Start A (both ends) and B (one end) together. The moment A is consumed, exactly 30 minutes have elapsed and rope B has 30 minutes of burn remaining. Now light B's second end: those remaining 30 minutes are eaten by two fronts in 15 minutes. 30 + 15 = 45. The key trick is that 'both ends' halves the elapsed TIME even though you can never predict how much LENGTH corresponds to a given time.",
    difficulty: "easy",
    concept: "Rate / simultaneous processes",
    source: "Classic burning-rope fuse puzzle",
    gradable: true,
    numericAnswer: 45,
    tolerance: 0,
  },
  {
    id: "bt-bridge",
    prompt:
      "Four people must cross a bridge at night with a single torch; at most two can cross at a time, and a pair moves at the slower person's pace. Their individual crossing times are 1, 2, 5, and 10 minutes. What is the minimum total time for all four to get across?",
    answer:
      "17 minutes. Send 1 & 2 across (2), 1 returns (1), send 5 & 10 across (10), 2 returns (2), send 1 & 2 across (2): 2 + 1 + 10 + 2 + 2 = 17.",
    explanation:
      "The torch has to be carried back after each crossing, so the whole problem is about minimizing how often the slow people (5 and 10) move and making them move together. The naive strategy, the fastest person (1) escorts everyone one by one, costs 1+10+1+5+1+2 = 20, or 19 if you optimize the last leg. The optimal idea is to burn one round trip getting the two fastest to the far side, then send the two SLOWEST across together so the 10 and 5 overlap into a single 10-minute crossing (you only 'pay' for the 10 once), then use the fast person already waiting to shuttle the torch back. Concretely: 1&2 cross (2), 1 returns (1), 5&10 cross (10), 2 returns (2), 1&2 cross (2) = 17 minutes. Pairing the two slowest is what beats the intuitive 'always use the fastest as escort' plan.",
    difficulty: "easy",
    concept: "Optimization / greedy vs optimal",
    source: "Bridge-and-torch puzzle",
    gradable: true,
    numericAnswer: 17,
    tolerance: 0,
  },
  {
    id: "bt-backup-dealer",
    prompt:
      "You want to buy a single share, so you ping two independent liquidity providers at once. Each one returns a quote that is an independent uniform draw somewhere between $2 and $6 (every price in that band equally likely). You plan to lift whichever quote is lower, but the fast line to the better price is unreliable: exactly half the time it drops and you get filled at the higher quote, and the other half you get the lower quote as planned. What price should you expect to pay for the share?",
    answer:
      "$4.00, exactly the midpoint ($2 + $6)/2, the same as if you had ignored both quotes and traded with one provider chosen at random.",
    explanation:
      "The 'expected value' of a quantity is the average of its possible values weighted by their probabilities. Call the two quotes X and Y; each is uniform on [$2, $6], so on its own each averages the midpoint $4. Write m = min(X, Y) for the cheaper quote and M = max(X, Y) for the dearer one. With probability 1/2 you pay m and with probability 1/2 you pay M, so your expected cost is ½·E[m] + ½·E[M] = ½·(E[m] + E[M]).\n\nHere is the key identity: for ANY two numbers, the smaller plus the larger equals the two originals added together, i.e. m + M = X + Y always. Taking expectations, E[m] + E[M] = E[X] + E[Y] = $4 + $4 = $8. So your expected cost is ½·$8 = $4.\n\nThe 'aha' is that the 50/50 backup EXACTLY cancels the advantage of shopping for the minimum: averaging the min and the max with equal weight is the same as averaging the two original quotes. (You never even need the fact that E[min] = $10/3 ≈ $3.33 and E[max] = $14/3 ≈ $4.67 for two uniforms on this band, though those are consistent: their sum is $8 and their average is $4.) In general, if you got the cheaper quote with probability p, your expected cost would be $2 + $4·(2 − p)/3, which only beats the midpoint $4 when p > 1/2.",
    difficulty: "easy",
    concept: "Expected value / order statistics (min + max identity)",
    source: "Original house brainteaser",
    gradable: true,
    numericAnswer: 4,
    tolerance: 0.005,
  },
  {
    id: "bt-lockers",
    prompt:
      "100 lockers all start closed. Person k (for k = 1..100) walks by and toggles every k-th locker (person 1 toggles all, person 2 toggles 2,4,6,…, and so on). After all 100 people have passed, how many lockers are left OPEN?",
    answer:
      "10 lockers are open, exactly the perfect squares: 1, 4, 9, 16, 25, 36, 49, 64, 81, 100.",
    explanation:
      "Locker n gets toggled once by each person whose number divides n, so its final state depends on how many divisors n has: it ends OPEN iff n has an ODD number of divisors. Divisors normally pair up as (d, n/d), for example 12 gives (1,12), (2,6), (3,4), producing an even count, which returns the locker to closed. That pairing only breaks when d = n/d, i.e. when n is a perfect square and its square root has no distinct partner. So precisely the perfect squares end up with an odd divisor count and stay open. Between 1 and 100 there are 10 perfect squares (1² through 10²), hence 10 open lockers.",
    difficulty: "medium",
    concept: "Divisor parity / perfect squares",
    source: "100 lockers / factors puzzle",
    gradable: true,
    numericAnswer: 10,
    tolerance: 0,
  },
  {
    id: "bt-switches",
    prompt:
      "Three off/on switches are downstairs; exactly one controls a single light bulb upstairs (the others do nothing). You may flip the switches as much as you like, but you may walk upstairs to look only ONCE. How do you determine which switch controls the bulb?",
    answer:
      "Use heat as a second signal. Turn switch 1 ON for a few minutes, then turn it OFF. Turn switch 2 ON and immediately go upstairs. If the bulb is lit → switch 2. If it's off but warm → switch 1. If it's off and cold → switch 3.",
    explanation:
      "On/off alone gives each bulb only two states, which is not enough to distinguish three switches from a single look. The insight is to manufacture a THIRD observable state, temperature. Leaving switch 1 on long enough heats its bulb; switching it back off before you go up leaves that bulb dark but noticeably warm. Switch 2 you leave on, so its bulb is lit. Switch 3 you never touch, so its bulb is dark and cold. Upstairs you can now read three distinguishable conditions, lit, off-and-warm, off-and-cold, each mapping uniquely to switch 2, switch 1, and switch 3. Creating an extra information channel (here, heat) out of the physical setup is the whole lesson.",
    difficulty: "medium",
    concept: "Adding an information channel",
    source: "Three switches, one bulb",
    gradable: false,
  },
];

const classics: Flashcard[] = [
  {
    id: "bt-adjacent-cross",
    prompt:
      "You shuffle a deck of 20 order tickets, 10 marked BUY and 10 marked SELL, uniformly at random and deal them face-up into a single line. Walking the line from left to right, a 'cross' occurs at any spot where a BUY ticket is immediately trailed by a SELL ticket. On average, how many crosses will the line show?",
    answer:
      "Exactly 5. (In general, for n buys and n sells, the expected count is n/2.)",
    explanation:
      "The powerful tool here is LINEARITY OF EXPECTATION: the expected value of a sum of random quantities equals the sum of their individual expected values, even when those quantities are not independent. There are 20 − 1 = 19 adjacent slots (positions 1–2, 2–3, …, 19–20). For slot i, define an indicator I_i that equals 1 if that pair is 'buy then sell' and 0 otherwise. The number of crosses is I_1 + … + I_19, so its expectation is the sum over slots of P(slot i is B then S).\n\nFor a single fixed adjacent slot, the chance the left card is a buy is 10/20; given that, the chance the right card is a sell is 10/19 (10 sells remain among the 19 other cards). So each slot is a cross with probability (10/20)·(10/19) = (1/2)·(10/19) = 10/38 = 5/19. Multiplying by the 19 slots: 19·(5/19) = 5.\n\nThe 'aha' is that even though neighboring slots overlap (they share a card) and are therefore DEPENDENT, linearity lets you ignore that entirely and just add per-slot probabilities. In general the per-slot probability is (n/2n)·(n/(2n−1)) = n/(2(2n−1)), and multiplying by the 2n−1 slots gives exactly n/2, independent of the messy dependence structure.",
    difficulty: "medium",
    concept: "Linearity of expectation",
    source: "Original house brainteaser",
    gradable: true,
    numericAnswer: 5,
    tolerance: 0,
  },
  {
    id: "bt-walk-offer-down",
    prompt:
      "A single client will take one block off you, but only at or below their hidden reservation price V, which is uniform on [0, 12] dollars (you never observe it). You announce one firm ask; a client whose V meets it buys and pays that ask, otherwise they balk, and only then may you announce a single strictly cheaper ask, which likewise clears if V meets it (else the client leaves and you earn 0). The client simply grabs any ask no higher than V. Fixing both asks ahead of time, (a) what pair of prices maximizes your expected take, and (b) what is that take, compared with the best you could do posting just one price?",
    answer:
      "Quote $8 first, then $4; maximum expected revenue = $4. A single-ask seller's best is to quote $6 for expected revenue $3, the second chance lifts revenue from $3 to $4, a 33% improvement.",
    explanation:
      "With a SINGLE ask p, the buyer accepts with probability P(V ≥ p) = (12 − p)/12 (since V is uniform on [0, 12], the chance it lands above p is the fraction (12 − p)/12), so expected revenue is p·(12 − p)/12. This parabola peaks at p = 6, giving 6·6/12 = $3.\n\nNow allow a fallback. Let the first ask be p₁ and the lower fallback be p₂ < p₁. There are two disjoint ways to earn money:\n • The buyer accepts the first ask: needs V ≥ p₁, probability (12 − p₁)/12, earning p₁ → contribution p₁·(12 − p₁)/12.\n • The buyer declines the first but accepts the fallback: needs p₂ ≤ V < p₁, probability (p₁ − p₂)/12, earning p₂ → contribution p₂·(p₁ − p₂)/12.\n\nSo expected revenue is R = [p₁·(12 − p₁) + p₂·(p₁ − p₂)]/12. Optimize the fallback first: for fixed p₁, the term p₂·(p₁ − p₂) is a parabola in p₂ maximized at p₂ = p₁/2, where it equals p₁²/4. Substitute: R = [p₁·(12 − p₁) + p₁²/4]/12 = [12·p₁ − (3/4)·p₁²]/12. Setting the derivative to zero: 12 − (3/2)·p₁ = 0, so p₁ = 8, hence p₂ = 4. The revenue is [8·4 + 4·4]/12 = 48/12 = $4.\n\nThe 'aha': a second, lower quote lets you price-discriminate OVER TIME, capture the high-value buyers at $8, then recover a sale from the medium-value buyers at $4, which strictly beats any single price. Note the fallback $4 is NOT the single-ask optimum $6; the whole schedule shifts because the first ask has already 'creamed off' the top of the distribution.",
    difficulty: "medium",
    concept: "Sequential pricing / price discrimination",
    source: "Original house brainteaser",
    gradable: false,
  },
  {
    id: "bt-8balls",
    prompt:
      "You have 8 identical-looking balls; exactly one is slightly heavier than the rest. Using only a two-pan balance scale (no weights), what is the minimum number of weighings that GUARANTEES you find the heavy ball, and how?",
    answer:
      "2 weighings. Split the balls 3-3-2 and weigh the two groups of 3. If one side sinks, weigh two of those 3 against each other. If the 3-vs-3 balances, weigh the leftover 2 against each other.",
    explanation:
      "A balance scale returns one of three outcomes, left heavier, right heavier, or balanced, so each weighing yields a base-3 'digit' of information, and k weighings can distinguish up to 3^k possibilities. With 8 candidates you want to split into three roughly equal groups: 3, 3, and 2. First weighing (3 vs 3): if one pan drops, the heavy ball is among those 3; if the pans balance, it's among the untouched 2. Second weighing: in the group of 3, weigh any two balls against each other, the heavier pan reveals it, or if they balance it's the third ball; in the group of 2, just weigh them directly. Either branch finishes in exactly 2 weighings. The common mistake is to split in half (4 vs 4), which throws away the informative 'balanced' outcome and needs a third weighing.",
    difficulty: "medium",
    concept: "Information per weighing (ternary)",
    source: "Balance-scale weighing puzzle",
    gradable: true,
    numericAnswer: 2,
    tolerance: 0,
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
    gradable: true,
    numericAnswer: 10,
    tolerance: 0,
  },
  {
    id: "bt-monty",
    prompt:
      "On a game show, a car sits behind one of three doors and goats behind the other two. You pick a door. The host, who knows what's behind every door, opens a DIFFERENT door revealing a goat, then offers to let you switch to the remaining unopened door. Should you switch, and what is your probability of winning if you do?",
    answer:
      "Yes, switch, you win with probability 2/3. Staying wins only 1/3 of the time.",
    explanation:
      "When you first pick, you're right 1/3 of the time and wrong 2/3 of the time; equivalently, the car is behind one of the OTHER two doors with probability 2/3. The host then always opens a losing door among those two, a deliberate, informed action, not a random one. That reveal never changes the 1/3 chance your original door is correct, but it collapses the entire 2/3 that was spread over the other two doors onto the single remaining unopened door. So switching wins whenever your first guess was wrong, which is 2/3 of the time. The classic error is to think the two remaining closed doors are now a 50/50 coin flip; that reasoning ignores that the host's choice of which door to open carried information.",
    difficulty: "medium",
    concept: "Conditional probability / information",
    source: "Monty Hall problem",
    gradable: false,
  },
  {
    id: "bt-25horses",
    prompt:
      "You have 25 horses and a track that races exactly 5 horses at a time. You have no stopwatch, each race only tells you the finishing ORDER of those 5. What is the minimum number of races needed to identify the 3 fastest horses overall?",
    answer:
      "7 races. Race 5 groups of 5 (5 races), race the 5 group-winners (race 6), then race a specific set of 5 contenders for places 2 and 3 (race 7).",
    explanation:
      "Without a timer you only learn relative order within a single race. Step 1: divide the 25 horses into 5 groups of 5 and race each group, 5 races, giving a full ranking inside every group. Step 2 (race 6): race the 5 group winners; the winner of this race is the fastest horse overall. Call the groups A, B, C, D, E by how their winners placed here (A1 > B1 > C1 > …). Step 3: figure out who can still be 2nd or 3rd overall. Groups D and E are eliminated entirely (their best is at best 4th). Only five horses remain possible: A2 and A3 (they trail only A1), B1 and B2 (B1 lost only to A1), and C1 (lost only to A1 and B1). Race those 5 (race 7); the top two finishers are the 2nd- and 3rd-fastest overall. Total = 5 + 1 + 1 = 7. The frequent slip is stopping at 6 and forgetting the final race that separates places 2 and 3.",
    difficulty: "hard",
    concept: "Tournament / partial ordering",
    source: "25 horses, 5 lanes puzzle",
    gradable: true,
    numericAnswer: 7,
    tolerance: 0,
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
    gradable: true,
    numericAnswer: 14,
    tolerance: 0,
  },
];

const hard: Flashcard[] = [
  {
    id: "bt-fading-buyer",
    prompt:
      "You need to unload one block of stock to a stream of arriving bidders. Each bidder independently names a price that is uniform on [0, 100] dollars, and the instant you see it you must lock in the sale at that price or pass on it permanently (no recall). The twist: every time you pass, a coin flip decides your fate, with probability exactly 1/2 the block gets placed elsewhere and you are left with 0, and with probability 1/2 the next bidder shows up. Bidders keep coming until the block is placed or lost. To maximize your expected proceeds, (a) what rule tells you when to accept, and (b) what do you expect to collect?",
    answer:
      "Accept the first offer that is at least the threshold t* = 100·(2 − √3) ≈ $26.79; reject anything below it. Expected payoff W = 100·(4 − 2√3) ≈ $53.59.",
    explanation:
      "Because every future decision faces exactly the same situation (offers are i.i.d. and the collapse probability is memoryless), the optimal policy is a single fixed THRESHOLD: accept an offer if and only if it is at least some cutoff t, reject otherwise. Let W be your expected payoff at the start (before seeing an offer). When you reject, with probability 1/2 you get 0 and with probability 1/2 you face the same problem again worth W; so the value of rejecting is ½·0 + ½·W = W/2. A rational player accepts the current offer x exactly when it beats the reject value, i.e. when x ≥ W/2. Thus the optimal threshold is t = W/2.\n\nNow compute W self-consistently. Upon seeing an offer x uniform on [0, 100] you effectively receive max(x, t): you take x if it clears the bar, else you fall back to the continuation value t = W/2. Splitting the average at t:\n W = E[max(x, t)] = (integral of t from 0 to t)/100 + (integral of x from t to 100)/100 = t²/100 + (100² − t²)/200 = 50 + t²/200.\n\nSubstitute t = W/2 (so W = 2t) into W = 50 + t²/200: 2t = 50 + t²/200 → 400t = 10000 + t² → t² − 400t + 10000 = 0. The root in [0, 100] is t = (400 − √(160000 − 40000))/2 = 200 − √30000 = 100·(2 − √3) ≈ 26.79, giving W = 2t = 100·(4 − 2√3) ≈ 53.59.\n\nThe 'aha': the RISK that the opportunity vanishes forces you to be far LESS picky than in the classic no-risk version. If offers never disappeared you could wait indefinitely for a near-100 offer, so no finite threshold would be optimal; the collapse probability is exactly what makes the problem well-posed and pins the cutoff at 100·(2 − √3). The whole solution rests on setting the continuation value equal to the threshold, a fixed point (t = W/2).",
    difficulty: "hard",
    concept: "Optimal stopping (threshold = continuation value)",
    source: "Original house brainteaser",
    gradable: false,
  },
  {
    id: "bt-round-trip",
    prompt:
      "Picture a stock whose close on each of the next three days is an independent uniform draw on [0, 100] dollars, each close revealed only at that day's end and never re-tradable afterward. You want to complete a single round trip, go long on one day and unwind on a strictly later day, choosing live, without seeing future closes. If you are still long going into day 3 you must sell into that close, and if you never went long by then you miss your chance (profit 0). Your profit equals the sell price minus the buy price. Under optimal play, what is the greatest expected profit, and what strategy attains it?",
    answer:
      "Maximum expected profit = $25. Buy on day 1 iff its price ≤ $50; if you bought on day 1, sell on day 2 iff day-2 price ≥ $50, otherwise sell on day 3. If you did NOT buy on day 1, then buy on day 2 iff its price < $50 and sell on day 3; otherwise do not trade.",
    explanation:
      "Solve by BACKWARD INDUCTION, work out the value of each situation starting from the last day and moving earlier. Throughout, the expected value of a fresh uniform price is $50.\n\nSelling side. If you are holding with only day 3 left, you must sell at day 3, worth $50 on average. If you are holding entering day 2 (you bought on day 1), you compare selling now at x₂ versus holding for the day-3 average $50: sell iff x₂ ≥ $50. The expected sale price is E[max(x₂, 50)] = (integral of 50 from 0 to 50)/100 + (integral of x from 50 to 100)/100 = 25 + 37.5 = $62.50. So a share bought on day 1 fetches an expected $62.50; a share bought on day 2 fetches an expected $50.\n\nBuying side. If you are still flat entering day 2 with price x₂, buying yields expected profit 50 − x₂ (buy at x₂, sell day 3 at expected $50); you buy iff that is positive, i.e. x₂ < $50. The value of being flat entering day 2 is therefore E[max(50 − x₂, 0)] = (integral of (50 − x) from 0 to 50)/100 = $12.50.\n\nDay 1. Seeing x₁, buying yields expected profit 62.5 − x₁ (you will realize the $62.50 selling value), while waiting is worth $12.50. Buy iff 62.5 − x₁ ≥ 12.5, i.e. x₁ ≤ $50. The overall value is E[max(62.5 − x₁, 12.5)] = (integral of (62.5 − x) from 0 to 50)/100 + (integral of 12.5 from 50 to 100)/100 = 18.75 + 6.25 = $25.\n\nSo the maximum expected profit is exactly $25. The 'aha' is that this is a TWO-SIDED optimal-stopping problem, you optimize both the entry and the exit, and the two thresholds happen to both sit at the symmetric value $50, yet the entry cutoff on day 1 is driven by the sell-side continuation value $62.50, not by $50 directly.",
    difficulty: "hard",
    concept: "Optimal stopping (two-sided) / backward induction",
    source: "Original house brainteaser",
    gradable: true,
    numericAnswer: 25,
    tolerance: 0,
  },
  {
    id: "bt-inventory-cap",
    prompt:
      "A dealer runs a book whose net position begins flat at 0 and is never allowed outside {−2, −1, 0, +1, +2} (a hard two-lot limit). One at a time, clients arrive wanting a single lot in a random direction: with probability 1/2 the client buys from the dealer (position falls by 1) and with probability 1/2 the client sells to the dealer (position rises by 1). Any request that would carry the position beyond ±2 is declined outright, the position holds and that client departs. After the book settles into its long-run behaviour, what fraction of arriving clients end up declined?",
    answer:
      "Exactly 1/5 of arriving customers are rejected.",
    explanation:
      "Model the inventory as a MARKOV CHAIN, a system that hops between states where the next state depends only on the current one. The states are −2, −1, 0, +1, +2. From any interior state (−1, 0, +1) either trade is allowed, so the chain steps +1 or −1, each with probability 1/2 (never a rejection there). From the top state +2: a customer buying from the maker (prob 1/2) moves inventory to +1, accepted; a customer selling to the maker (prob 1/2) would go to +3. REJECTED, so the chain stays put at +2. State −2 is the mirror image.\n\nWe need the STATIONARY DISTRIBUTION (π₋₂, π₋₁, π₀, π₊₁, π₊₂): the long-run fraction of steps spent in each state, characterized by the balance condition 'flow up across a boundary = flow down across it.' For adjacent states this detailed balance reads π_i·(½) = π_{i+1}·(½), i.e. π_i = π_{i+1}, every neighbouring pair is equally likely. So all five states share the same probability, and since they sum to 1, π₋₂ = π₋₁ = π₀ = π₊₁ = π₊₂ = 1/5.\n\nFinally, a rejection happens only when the chain is at +2 and the customer wants to push it to +3 (prob 1/2), or at −2 and the customer wants −3 (prob 1/2); at every interior state rejection is impossible. So the long-run rejection rate is π₊₂·(1/2) + π₋₂·(1/2) = (1/5)·(1/2) + (1/5)·(1/2) = 1/5.\n\nThe 'aha': because the reflecting cap makes the maker LINGER at the boundary states (a rejection leaves inventory unchanged, so +2 and −2 are 'sticky'), all five inventory levels turn out equally likely, the symmetric book spreads probability uniformly, and exactly one-fifth of order flow is turned away. (In general a symmetric book with a k-lot cap rejects 1/(2k+1) of arrivals.)",
    difficulty: "hard",
    concept: "Markov chains / steady state (balance equations)",
    source: "Original house brainteaser",
    gradable: true,
    numericAnswer: 0.2,
    tolerance: 0.005,
  },
  {
    id: "bt-12balls",
    prompt:
      "You have 12 identical-looking balls; exactly one is 'odd', it is either heavier OR lighter than the rest, and you don't know which. Using only a two-pan balance scale, what is the minimum number of weighings that guarantees identifying the odd ball AND whether it is heavy or light?",
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
      "On the 100th night, all 100 blue-eyed islanders leave together that night.",
    explanation:
      "Use induction on the number of blue-eyed people. Base case: if there were exactly 1 blue-eyed person, they'd see no other blue eyes, so the announcement 'at least one' tells them it must be them, they leave on night 1. With 2 blue-eyed people, each sees exactly 1 other and reasons, 'if I'm not blue, that person is the only blue-eyed one and will leave on night 1.' When night 1 passes and nobody leaves, each of the two concludes they must also be blue and both leave on night 2. In general, with k blue-eyed people, each one sees k−1 others and waits: 'if there were only k−1, they'd all leave on night k−1.' When night k−1 passes with no departures, all k deduce simultaneously that they are blue and leave together on night k. With k = 100 that is the 100th night. The subtle part is why the visitor's announcement matters even though everyone can already SEE blue eyes: it converts that fact into COMMON KNOWLEDGE (everyone knows that everyone knows … that at least one is blue), which is exactly what seeds and synchronizes the induction.",
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
      "Solve by backward induction, starting from the smallest subgame and working up. With 2 pirates left (P2, P1): P2 proposes and only needs 'at least half' of 2 votes, his own suffices, so he takes all 100 and P1 gets 0. With 3 left (P3, P2, P1): P3 needs one more vote besides his own. P1 gets 0 in the 2-pirate outcome, so offering P1 a single coin buys his vote: {99, 0, 1}. With 4 left (P4, P3, P2, P1): P4 needs one extra vote; P2 would get 0 in the 3-pirate outcome, so 1 coin buys P2: {99, 0, 1, 0}. With all 5: P5 needs two extra votes beyond his own (3 of 5). The pirates who would get 0 in the 4-pirate outcome are P3 and P1, so bribing each with a single coin secures their votes: {98, 0, 1, 0, 1}. P5 keeps 98. The engine of the solution is that every pirate votes yes only if the current offer beats what they'd receive after the proposer is thrown overboard, so the proposer buys exactly the cheapest majority.",
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
      "A single light bit can't directly encode 100 people's visits, so the strategy funnels all the information through one designated person, the counter. Each non-counter contributes exactly ONE reliable signal: the first time they enter and see the light off, they turn it on; on every later visit they leave it untouched. This guarantees a non-counter turns the light on at most once in the entire process. The counter does the opposite: whenever he enters and finds the light ON, he turns it off and increments his private count by one, and because only non-counters ever turn it on, and each does so at most once, every 'on' the counter sees corresponds to a distinct, first-time visitor. When his count reaches 99, all 99 non-counters must each have visited at least once (and the counter himself obviously has), so he can safely declare that everyone has visited. The random order and repeated visits don't threaten correctness, they only affect how LONG it takes, because the protocol never double-counts anyone.",
    difficulty: "expert",
    concept: "Distributed counting protocol",
    needsVerification: true,
    source: "100 prisoners and a light switch",
  },
];

/* ========================================================================== */
/*  NEW. Techniques Toolkit (datasets 3–8): technique-grouped static one-offs */
/*  Fresh framings inspired by the dataset puzzles (never reused verbatim);    */
/*  the dataset originals live only as hidden solver fixtures in the tests.    */
/* ========================================================================== */

/** Level "Counting & Pigeonhole", summation / counting / number-theory / pigeonhole. */
const countingPigeonhole: Flashcard[] = [
  {
    id: "bt-count-threes",
    prompt:
      "If you write out every whole number from 1 to 100,000 (one hundred thousand), how many times in total does the digit 3 appear?",
    answer:
      "50,000 times. For a nonzero digit written across 1…10^k, the count is k·10^(k−1); here k = 5, so 5·10^4 = 50,000.",
    explanation:
      "Think of every number 1…100000 padded to 5 digit slots (00001 … 100000; the extra 100000 contributes no 3s). As all 5-digit strings 00000–99999 run through, each of the 5 positions independently cycles through 0–9 with perfect uniformity, so each position shows a '3' exactly one-tenth of the time: 100000 ÷ 10 = 10,000 threes per position. Across the 5 positions that is 5 × 10,000 = 50,000. This 'digit-odometer' counting gives the general formula: digit d (1–9) appears k·10^(k−1) times over 1…10^k. The lesson is to count by POSITION, not by scanning numbers.",
    difficulty: "easy",
    concept: "Digit counting by position (k·10^(k−1))",
    source: "Brainteasers · Simplification (How Many Twos, fresh variant)",
    gradable: true,
    numericAnswer: 50000,
    tolerance: 0,
  },
  {
    id: "bt-count-handshakes",
    prompt:
      "Fifteen people are at a party; some shake hands, some don't (no one shakes their own hand and a given pair shakes at most once). Prove that at least two people must have shaken exactly the same number of hands.",
    answer:
      "It is always true. Each person's handshake count is one of 0,1,…,14 (15 values), but 0 and 14 cannot both occur, leaving only 14 possible values for 15 people, so two people share a count.",
    explanation:
      "Each of the 15 people shook somewhere between 0 and 14 hands, which looks like 15 possible values for 15 people, not yet a forced repeat. The key observation removes one value: if someone shook 14 hands they shook everyone's, so NOBODY could have shaken 0; conversely a 0 rules out any 14. So the counts actually lie among only 14 possibilities (either 0–13 or 1–14). By the PIGEONHOLE PRINCIPLE, distributing 15 people into at most 14 possible counts forces two people into the same count. The subtle step is spotting that 0 and 14 are mutually exclusive, which shrinks the pigeonholes from 15 to 14.",
    difficulty: "easy",
    concept: "Pigeonhole principle (mutually-exclusive extremes)",
    source: "Brainteasers · Pigeonhole (Handshakes, fresh variant)",
  },
  {
    id: "bt-count-points-square",
    prompt:
      "Fifty points are scattered anywhere inside a 1-by-1 square. Show that some 1/4-by-1/4 sub-square (an axis-aligned quarter-by-quarter tile) must contain at least 4 of the points.",
    answer:
      "Cut the square into a 4×4 grid of 16 tiles, each 1/4 by 1/4. Since 16·3 = 48 < 50, the points cannot be spread ≤ 3 per tile, so some tile holds ≥ 4.",
    explanation:
      "Partition the unit square into 16 congruent 1/4 × 1/4 tiles (a 4-by-4 grid), these are the pigeonholes. If every tile held at most 3 points, the whole square could hold at most 16 × 3 = 48 points. But there are 50 > 48 points, a contradiction, so at least one tile must contain at least ⌈50/16⌉ = 4 points. This is the geometric form of the PIGEONHOLE PRINCIPLE: chop the region into fewer cells than you have objects (scaled by the per-cell cap) and some cell is forced to overflow. (A point on a boundary can be assigned to either adjacent tile without affecting the count.)",
    difficulty: "medium",
    concept: "Geometric pigeonhole (grid cells)",
    source: "Brainteasers · Pigeonhole (Catching Ants, fresh variant)",
  },
  {
    id: "bt-count-partition",
    prompt:
      "Can the numbers 1, 2, 3, …, 15 be split into three groups so that every group has the same sum? If so, give one such split; if not, explain why.",
    answer:
      "Yes. The total 1+…+15 = 120 divides evenly into three groups of 40, e.g. {15, 14, 11}, {13, 12, 9, 6}, and {10, 8, 7, 5, 4, 3, 2, 1}.",
    explanation:
      "First apply the necessary DIVISIBILITY condition: the grand total is the triangular number 1+2+…+15 = 15·16/2 = 120, and an equal 3-way split requires each group to sum to 120 ÷ 3 = 40 (an integer, so it is not ruled out). Then construct one greedily by placing the largest remaining numbers to hit 40: {15, 14, 11} = 40; {13, 12, 9, 6} = 40; the rest {10, 8, 7, 5, 4, 3, 2, 1} also sums to 40. The two-part lesson: compute the total with the triangular-number formula and check divisibility FIRST (if 120 weren't a multiple of 3 the task would be impossible), then build the partition.",
    difficulty: "medium",
    concept: "Triangular sum + equal-partition (divisibility check)",
    source: "Brainteasers · Summation (Clock Parts, fresh variant)",
  },
  {
    id: "bt-count-coin-weighing",
    prompt:
      "You have 6 stacks of coins. Genuine coins weigh exactly 10 g each; exactly ONE stack is counterfeit, with every coin in it weighing 11 g. You have a digital scale you may use only ONCE (a single weighing that reads total grams). How do you identify the counterfeit stack?",
    answer:
      "Take 1 coin from stack 1, 2 from stack 2, …, 6 from stack 6 (21 coins) and weigh them together. Genuine, they'd read 210 g; the reading minus 210 equals the counterfeit stack's number.",
    explanation:
      "One weighing gives one number, so you must ENCODE each stack's identity into that number. Take i coins from stack i, for i = 1…6, that is 1+2+…+6 = 21 coins, which would weigh 21 × 10 = 210 g if all genuine. Each counterfeit coin adds exactly 1 g, and stack k contributes exactly k of the counterfeit coins to your sample, so the total excess over 210 g is precisely k grams. Read the scale, subtract 210, and the difference is the counterfeit stack's number (e.g. a reading of 214 g ⇒ stack 4). The trick is a POSITIONAL (weighted) encoding: giving stack i a distinct multiplicity i makes the single measured deviation spell out the culprit.",
    difficulty: "medium",
    concept: "Positional encoding in one measurement",
    source: "Brainteasers · Summation (Coin Imbalance, fresh variant)",
  },
];

/** Level "Invariants & Parity", parity/invariant/mirror/pairing arguments. */
const invariantsParity: Flashcard[] = [
  {
    id: "bt-inv-coffee-cream",
    prompt:
      "You have a cup of coffee and a cup of cream. You take one spoonful of cream, stir it into the coffee, then take one spoonful of the (now mixed) coffee and stir it back into the cream. After this exchange, is there more cream in the coffee cup, or more coffee in the cream cup?",
    answer:
      "Exactly equal amounts. There is precisely as much cream in the coffee cup as there is coffee in the cream cup.",
    explanation:
      "Track the CONSERVATION INVARIANT: each cup ends with the same TOTAL volume it started with (one spoon out, one spoon back). So whatever volume of coffee now sits in the cream cup must have been displaced by an equal volume of cream that left it, i.e. the coffee cup gave up exactly that much coffee and received exactly that much cream in return. Formally, the cream missing from the cream cup all lives in the coffee cup, and since the cream cup is back to its original volume, the 'hole' left by that missing cream is filled by exactly the same volume of coffee. No mixing ratios or spoon sizes matter. The answer is forced purely by volume bookkeeping, the classic 'water-and-wine' invariant.",
    difficulty: "medium",
    concept: "Conservation invariant (volume bookkeeping)",
    source: "Brainteasers · Symmetry (Water and Wine, fresh variant)",
  },
  {
    id: "bt-inv-fair-from-biased",
    prompt:
      "You have a biased coin that lands heads with probability 0.7 and tails with probability 0.3 (you don't know these numbers exactly, only that it is biased and 0 < p < 1). Using only this coin, how can you simulate a perfectly fair 50/50 decision between two friends?",
    answer:
      "Flip the coin twice. If you get Heads-then-Tails, friend A wins; if Tails-then-Heads, friend B wins; if you get two matching flips (HH or TT), discard and repeat.",
    explanation:
      "Use VON NEUMANN's trick, which exploits a symmetry between the two ordered outcomes. In two independent flips, P(HT) = p(1−p) and P(TH) = (1−p)p, these are EQUAL regardless of the unknown bias p. The matching outcomes HH (prob p²) and TT (prob (1−p)²) carry the bias, so you simply throw them away and reflip. Conditioned on getting one of the two unequal-looking-but-equal-probability outcomes HT or TH, each has probability exactly 1/2. Because p(1−p) > 0, the procedure ends with probability 1 (the expected number of flip-pairs is 1/(2p(1−p))). The insight: pairing outcomes symmetrically cancels the unknown bias.",
    difficulty: "medium",
    concept: "Von Neumann fair-coin extraction (symmetry cancels bias)",
    source: "Brainteasers · Symmetry (Unfair Coin, fresh variant)",
  },
  {
    id: "bt-inv-mutilated-board",
    prompt:
      "Take a standard 8×8 chessboard and cut off two diagonally OPPOSITE corner squares, leaving 62 squares. You have 31 dominoes, each covering exactly two adjacent squares. Can the 31 dominoes tile the mutilated board exactly, with no overlaps or gaps?",
    answer:
      "No, it is impossible. The two opposite corners are the same color, so the board loses 2 squares of one color, leaving 32 of one color and 30 of the other; every domino must cover one of each.",
    explanation:
      "The COLORING INVARIANT settles it. On a chessboard the two diagonally opposite corners are always the SAME color (say both white), so removing them leaves 30 white and 32 black squares. Now note that any domino, covering two ADJACENT squares, always sits on exactly one white and one black square. Hence 31 dominoes would cover exactly 31 white and 31 black squares. But the mutilated board has 30 white and 32 black, the counts don't match 31–31, so no tiling can exist. The whole impossibility follows from a parity/coloring argument, without trying any arrangements: find a quantity every domino preserves (here the white−black balance) and show the target violates it.",
    difficulty: "medium",
    concept: "Coloring parity invariant (tiling impossibility)",
    source: "Brainteasers · Logical (Mutilated Chessboard, fresh variant)",
  },
  {
    id: "bt-inv-foxes-rabbit",
    prompt:
      "On an enchanted island live 100 identical, perfectly logical foxes and one magic rabbit. Any fox may eat the rabbit, but a fox that does so instantly turns INTO the (new) magic rabbit, which the remaining foxes could then eat, and so on. Every fox prefers to be a live fox over a rabbit, and prefers being an eaten-but-not-a-target over being eaten. Assuming all foxes are hungry but supremely rational, does the rabbit get eaten?",
    answer:
      "No, with 100 foxes (an even number) the rabbit survives. The outcome flips with parity: an even number of foxes ⇒ safe, an odd number ⇒ eaten.",
    explanation:
      "Use PARITY INDUCTION from the base case. With 1 fox: it simply eats the rabbit (it then becomes the rabbit, but there are no other foxes left to eat it), so 1 fox ⇒ rabbit eaten. With 2 foxes: if a fox eats the rabbit it becomes the rabbit and now faces the '1 fox' situation, where that lone remaining fox WILL eat it. Foreseeing this, neither fox eats, so 2 foxes ⇒ rabbit safe. In general, a fox eats only if doing so leaves an even number of foxes behind (making the fox-turned-rabbit safe). So the state alternates: n foxes ⇒ eaten iff n is ODD. Since 100 is even, every fox knows eating would doom it, so the rabbit is never touched. The key is reducing to the smallest case and tracking the parity that flips at each step.",
    difficulty: "medium",
    concept: "Parity induction (reduce to base case)",
    source: "Brainteasers · Simplification (Tigers vs Sheep, fresh variant)",
  },
  {
    id: "bt-inv-last-ball",
    prompt:
      "A bag holds 20 red marbles and 14 blue marbles. Repeat this until one marble remains: draw two marbles at random; if they are the SAME color, put one BLUE marble back (discarding both drawn); if they are DIFFERENT colors, put the RED one back (discarding the blue). What color is the final marble?",
    answer:
      "Blue. The number of red marbles never changes parity, it starts even (20), so it stays even and must end at 0, leaving a blue marble.",
    explanation:
      "Find the INVARIANT: track the parity (odd/even) of the RED count. Consider each move. Two reds drawn (same color) → both removed, one blue added → reds drop by 2 (parity unchanged). Two blues drawn (same color) → both removed, one blue added → reds unchanged (parity unchanged). One red + one blue (different) → the red goes back, the blue is discarded → reds unchanged (parity unchanged). In every case the number of reds changes by 0 or −2, so its PARITY is invariant throughout. It starts at 20, which is even, so it remains even forever and the game can only end with 0 reds, hence the last marble is blue. (Had reds started odd, they'd end at 1 and the last marble would be red.) The blue count is a red herring; only red-parity matters.",
    difficulty: "hard",
    concept: "Parity invariant (monovariant)",
    source: "Brainteasers · Logical (The Last Ball, fresh variant)",
  },
  {
    id: "bt-inv-blind-sort",
    prompt:
      "In a completely dark room there are 48 identical coins on a table; exactly 15 of them are currently heads-up and the rest tails-up. You cannot see or feel which is which, but you can move coins and flip any coin you choose. How do you split the coins into two groups that contain the SAME number of heads-up coins?",
    answer:
      "Separate any 15 coins into their own pile and flip ALL 15 of them. The flipped pile and the remaining 33 coins will then have equal numbers of heads.",
    explanation:
      "Use a COMPLEMENTATION invariant. Scoop off any 15 coins (matching the known total of 15 heads) and call the number of heads that happen to be in this pile X, you don't and can't know X. Then the other 33 coins contain the remaining 15 − X heads. Now FLIP every coin in the 15-pile: each of its X heads becomes a tail and each of its 15 − X tails becomes a head, so the 15-pile now shows 15 − X heads. That exactly matches the 15 − X heads in the other pile. It works for any hidden value of X because flipping turns 'heads in the pile' into 'tails in the pile' and vice versa, the size of the split (15, the head-count) is the only thing you need to know.",
    difficulty: "hard",
    concept: "Complementation invariant (flip trick)",
    source: "Brainteasers · Symmetry (Blind Sorting, fresh variant)",
  },
  {
    id: "bt-inv-last-penny",
    prompt:
      "Two players take turns placing identical circular coins flat on a circular table. Coins may not overlap and may not hang off the edge; a player who cannot place a coin on their turn loses. You move first. What is your winning strategy?",
    answer:
      "Place your first coin dead-center on the table. Thereafter, mirror every coin your opponent plays by putting yours at the point diametrically opposite (symmetric through the center). You can always move, so your opponent is the first who cannot.",
    explanation:
      "Exploit the table's CENTRAL SYMMETRY. Open by covering the exact center. From then on, whenever the opponent places a coin somewhere, respond by placing yours at the mirror-image position through the center. Because the center is already taken, the opponent's coin never sits on the center, so its mirror point is a DIFFERENT location; and by symmetry that mirror spot is empty and non-overlapping precisely because the opponent's coin fit its spot. Thus every time the opponent has a legal move, so do you (its reflection). Since the table is finite the game must end, and by this pairing it is always the opponent who first runs out of room. The first-move-plus-mirror strategy converts the whole game into a symmetry you control.",
    difficulty: "hard",
    concept: "Symmetry / mirroring strategy (first-player win)",
    source: "Brainteasers · Symmetry (Last Penny, fresh variant)",
  },
  {
    id: "bt-inv-casino-pairs",
    prompt:
      "A dealer shuffles a deck of 40 cards, 20 red and 20 black, and turns them face-up two at a time. If a pair is both black, you keep it; if both red, the dealer keeps it; if mixed, it's discarded. Whoever collects more cards at the end wins $100 (a tie pays nothing). What is a fair price to pay to play this game?",
    answer:
      "$0, the game is always a tie, so it is worth nothing. Your black-pair count always equals the dealer's red-pair count, no matter how the deck falls.",
    explanation:
      "Find the PAIRING INVARIANT. The 40 cards split into 20 pairs; say there are p black-black pairs (yours), q red-red pairs (dealer's), and m mixed pairs. Count the reds: each red-red pair uses 2 reds, each mixed pair uses 1 red, and black-black pairs use 0, so 2q + m = 20 (total reds). Counting blacks the same way gives 2p + m = 20 (total blacks). Subtracting, 2q + m = 2p + m ⇒ p = q. So you and the dealer ALWAYS win the same number of pairs, the result is a guaranteed tie every single time. Since a tie pays $0 with certainty, the game's expected value is exactly $0, and a rational player would pay nothing to play. The invariant (equal counts of the two colors ⇒ equal same-color pairs) makes the randomness irrelevant.",
    difficulty: "hard",
    concept: "Pairing / counting invariant (guaranteed tie)",
    source: "Brainteasers · Symmetry (Casino's Offer, fresh variant)",
  },
];

/** Level "Games, Induction & Lateral Logic", games, backward induction, lateral. */
const gamesInductionLateral: Flashcard[] = [
  {
    id: "bt-game-knaves",
    prompt:
      "On an island every inhabitant is either a knight (who always tells the truth) or a knave (who always lies). You meet two islanders, A and B. A says: 'At least one of us two is a knave.' From this statement alone, what is A, and what is B?",
    answer:
      "A is a knight and B is a knave.",
    explanation:
      "Test A's type against the truth-value of A's statement. Suppose A were a KNAVE. Then A's statement 'at least one of us is a knave' would actually be TRUE (A himself is a knave), but knaves only make false statements, a contradiction. So A cannot be a knave; A is a KNIGHT. Since knights tell the truth, A's statement is true: at least one of A, B is a knave. A is the knight, so the knave must be B. Hence A = knight, B = knave. The method is the standard knights-and-knaves move: assume a speaker's type, then require their statement's truth to match (true for a knight, false for a knave), and keep whichever assignment is consistent.",
    difficulty: "medium",
    concept: "Truth-teller/liar consistency reasoning",
    source: "Brainteasers · Logical (Knights and Knaves, fresh variant)",
  },
  {
    id: "bt-game-cucumbers",
    prompt:
      "A grocer receives 200 pounds of cucumbers that are 99% water by weight. Left in the sun, they dry out until they are 98% water by weight. What is the total weight of the cucumbers now?",
    answer:
      "100 pounds.",
    explanation:
      "Anchor on the quantity that does NOT change: the dry (non-water) matter. Initially the cucumbers are 99% water, so the dry solids are 1% of 200 lb = 2 lb, and only water evaporates, the 2 lb of solids stay fixed. After drying, the cucumbers are 98% water, meaning the solids are now 2% of the new total weight W. So 2 lb = 2% × W = 0.02·W, giving W = 2 ÷ 0.02 = 100 lb. The result feels shocking (a 1-point drop in water percentage halves the weight) precisely because intuition tracks the water while the INVARIANT is the dry mass: a small change in the water fraction forces a large change in total weight to keep the fixed 2 lb of solids at the right proportion.",
    difficulty: "medium",
    concept: "Fixed-quantity invariant (percentage trap)",
    source: "Brainteasers · Logical (Watermelon, fresh variant)",
    gradable: true,
    numericAnswer: 100,
    tolerance: 0,
  },
  {
    id: "bt-game-horse-race",
    prompt:
      "You have 49 horses and a track with exactly 7 lanes, so you can race 7 horses at a time. You have no timer, each race only reveals the finishing ORDER of those 7 horses. What is the minimum number of races that guarantees identifying the 3 fastest horses overall?",
    answer:
      "9 races. (In general, finding the top 3 among L² horses with L lanes takes L + 2 races: L·L → 7 heats, 1 race of heat-winners, and 1 final of the remaining contenders.)",
    explanation:
      "Step 1: split the 49 horses into 7 heats of 7 and race each, 7 races, fully ranking every heat. Step 2 (race 8): race the 7 heat-winners; the winner here is the fastest horse overall. Label the heats A, B, C, … by how their winners placed (A's winner first, B's second, …). Step 3: only 5 horses can still be 2nd or 3rd overall. A's 2nd and 3rd (they trail only A1), B's 1st and 2nd (B1 lost only to A1), and C's 1st (lost only to A1 and B1); heats D–G are eliminated. Race those 5 in one final (race 9); its top two are the overall 2nd and 3rd. Total 7 + 1 + 1 = 9. The trick is realizing that after the winners' race, the pool of possible medalists collapses to a fixed small set, exactly L + 2 races for L² horses.",
    difficulty: "medium",
    concept: "Tournament / partial ordering (top-3 selection)",
    source: "Brainteasers · Logical (Horse Race, fresh variant)",
    gradable: true,
    numericAnswer: 9,
    tolerance: 0,
  },
  {
    id: "bt-game-explorers",
    prompt:
      "Four explorers, ranked 4 (most senior) down to 1, must divide 30 gold nuggets. The most senior proposes a split; then ALL explorers (including the proposer) vote. If at least half vote yes, it passes; otherwise the proposer is expelled with nothing and the next-most-senior proposes, and so on. Every explorer is perfectly rational and greedy, values survival above gold, and gold above being generous. How many nuggets does the most senior explorer keep?",
    answer:
      "29 nuggets. The optimal proposal is {senior: 29, next: 0, third: 1, junior: 0}, which passes 2 votes to 2 (half of 4).",
    explanation:
      "Solve by BACKWARD INDUCTION from the smallest subgame up. With 2 explorers left, the senior of the two needs only half of 2 votes, his own, so he keeps all 30 and the other gets 0. With 3 left, the proposer needs one extra vote beyond his own; the explorer who'd get 0 in the 2-player outcome will accept a single nugget, so the split is {29, 0, 1}. With all 4, the proposer needs two of four votes (his own plus one more). Looking at the 3-player result {29, 0, 1} (for the juniors below him), the explorer slated to get 0 there is the cheapest to buy, hand that one explorer 1 nugget for their yes vote. So the senior proposes {29, 0, 1, 0}: his own vote plus the bribed explorer's makes 2 ≥ half of 4, and it passes. Each voter compares the offer to what they'd get after the proposer is expelled, so the proposer buys exactly the cheapest majority, keeping 29.",
    difficulty: "hard",
    concept: "Backward induction / game theory (cheapest majority)",
    source: "Brainteasers · Simplification (Pirates, fresh variant)",
    gradable: true,
    numericAnswer: 29,
    tolerance: 0,
  },
  {
    id: "bt-game-fox-duck",
    prompt:
      "A duck sits at the center of a circular pond. A fox waits on the bank; it cannot swim, but it runs along the shore at 4 times the duck's swimming speed. The duck can reach the water's edge and fly, but only if it can touch land while the fox is not right there. Can the duck escape?",
    answer:
      "Yes. Because the fox's speed ratio (4) is below the critical value π + 1 ≈ 4.14, the duck can escape.",
    explanation:
      "Compare ANGULAR speeds. While the duck stays within radius r/4 of the center (r = pond radius), it can circle fast enough to keep the center directly between itself and the fox: at radius ρ the duck's angular speed is v/ρ, which beats the fox's angular speed 4v/r whenever ρ < r/4. So the duck spirals out to just inside radius r/4, positioned diametrically opposite the fox. From there it makes a straight dash to the nearest shore: its swim distance is a bit over r − r/4 = 3r/4, while the fox, starting on the far side, must run half the circumference, π·r, to reach the duck's landing point. The fox covers π·r at speed 4v (time π·r/4v ≈ 0.785 r/v) while the duck covers ~3r/4 at speed v (time 0.75 r/v), the duck lands first. This works exactly because 4 < π + 1 ≈ 4.14, the threshold ratio at which the shore-run and the dash tie; a faster fox (ratio ≥ π+1) would catch it.",
    difficulty: "expert",
    concept: "Pursuit / angular-speed comparison (spiral then dash)",
    source: "Brainteasers · Logical (Fox vs Duck, fresh variant)",
  },
  {
    id: "bt-game-wythoff",
    prompt:
      "Two players share two piles of chocolates: one pile of 10 and one of 15. On your turn you must either eat any positive number of chocolates from a SINGLE pile, or eat an EQUAL positive number from BOTH piles. Whoever eats the last chocolate wins. You move first, can you force a win, and what is your first move?",
    answer:
      "Yes. Eat 1 chocolate from the pile of 10, leaving the position (9, 15). From there you can always respond to keep your opponent in a losing 'cold' position and take the last chocolate.",
    explanation:
      "This is WYTHOFF'S game, whose losing ('cold') positions for the player to move are the pairs (⌊nφ⌋, ⌊nφ²⌋) where φ = (1+√5)/2 ≈ 1.618, for example (0,0), (1,2), (3,5), (4,7), (6,10), (9,15), …. Each nonzero pile-count appears in exactly one cold pair, and from any cold position every legal move lands you in a 'hot' (winning-for-the-mover) position, while from any hot position there is a move back to a cold one. The start (10, 15) is hot; the nearest cold position is (9, 15), reached by eating 1 chocolate from the pile of 10. After that, whatever your opponent does you can always move to the next cold pair, and since the piles only shrink you will be the one to reach (0,0), i.e. eat the last chocolate. The whole game reduces to steering onto the golden-ratio (Beatty) cold pairs.",
    difficulty: "expert",
    concept: "Wythoff's game (golden-ratio cold positions)",
    source: "Brainteasers · Logical (The Last Chocolate, fresh variant)",
  },
];

const levels: Level[] = [
  {
    id: "bt-1",
    section: "Core Puzzles",
    title: "Logic Warm-Ups",
    subtitle: "Rates, optimization, and lateral thinking",
    blurb:
      "Reason-it-out flashcards on rates and lateral thinking, burning ropes, the bridge crossing, 100 lockers, and three switches.",
    difficulty: "easy",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: warmups,
    // Infinite, exact-verified originals for "Give me another at this difficulty"
    // (bonus only, never touches mastery). The Backup Dealer is the easy family.
    flashcardGenerators: [backupDealerFamily],
    lesson: {
      paragraphs: [
        "Brainteasers test how you *structure* a problem under pressure, not obscure facts. Interviewers watch your reasoning out loud far more than the final number, so these are flashcards: think it through honestly, reveal the answer, then be strict with yourself about whether you truly had it.",
        "Two reliable moves: (1) look for a second 'channel' of information (heat, parity, order), and (2) reason about *rates*, burning a rope from both ends doubles its rate, so it finishes in half the time regardless of uneven burning.",
      ],
      keyIdea:
        "Find an extra observable state or invariant; then the puzzle usually collapses.",
      whyInterviewers:
        "Firms use these to see if you panic or decompose. Narrate your reasoning.",
      deepDive: {
        whyItWorks:
          "Many warm-up puzzles crack open once you find a second 'channel' of information or reason about rates rather than absolute amounts. Reframing what you are allowed to observe or control usually collapses the problem.",
        approach: [
          "Restate exactly what you can observe, control, and measure.",
          "Look for a hidden second signal (heat, order, parity) beyond the obvious one.",
          "When timing matters, reason about rates rather than lengths or amounts.",
          "Confirm your construction uses only the allowed operations.",
        ],
        pitfalls: [
          "Assuming half a rope burns in half the time when the burn rate is uneven.",
          "Sticking to the intuitive greedy plan when pairing the slower parties does better.",
          "Restricting yourself to the obvious on/off states and missing an extra observable one.",
        ],
      },
    },
  },
  {
    id: "bt-2",
    section: "Core Puzzles",
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
        "Many 'hard' teasers are really about how much INFORMATION a step gives you. A balance scale has three outcomes (left, right, equal), so k weighings distinguish 3^k cases, always count outcomes before you start.",
        "Encoding puzzles (poisoned bottles) map objects to binary strings so parallel yes/no tests read off the answer. And beware the Monty Hall trap: a host's informed action changes the conditional probabilities. Reveal each answer only after you've committed to your own reasoning.",
      ],
      keyIdea: "Count the information each action yields (log base #outcomes).",
      whyInterviewers:
        "Tests whether you quantify information rather than guess.",
      deepDive: {
        whyItWorks:
          "Many 'hard' puzzles are really about how much information each action yields: an action with k possible outcomes can distinguish at most kⁿ cases in n uses. Counting outcomes before acting tells you the minimum number of steps and how to split the possibilities.",
        approach: [
          "Count how many distinct cases you must tell apart.",
          "Count how many outcomes each action (weighing, test, question) can produce.",
          "Split the remaining possibilities as evenly as possible at every step.",
          "For an informed reveal, update the conditional probabilities rather than assuming symmetry.",
        ],
        pitfalls: [
          "Splitting a group in half and wasting the informative 'balanced' outcome of a three-way scale.",
          "Treating an informed host's reveal as carrying no information, collapsing to a naive 50/50.",
          "Confusing the number of outcomes with the number of actions when bounding the minimum steps.",
        ],
      },
    },
  },
  {
    id: "bt-3",
    section: "Core Puzzles",
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
        "The hardest teasers reward two techniques: backward induction (solve the smallest case, then build up, pirates, blue eyes) and designing a protocol that turns a shared resource into a reliable counter (the light-switch prisoners).",
        "When a problem feels impossible, shrink it: what if there were 1 pirate? 1 blue-eyed person? 2 prisoners? The base case usually reveals the invariant that scales. Reveal only after you've genuinely tried to derive it.",
      ],
      keyIdea: "Shrink to the base case; find the invariant; induct upward.",
      whyInterviewers:
        "These separate candidates who memorized answers from those who can derive them.",
      deepDive: {
        whyItWorks:
          "The hardest teasers yield to two moves: solve the smallest version first and induct upward, or design a protocol that funnels information through a shared resource so one agent can decode it. Shrinking the problem exposes the invariant that scales.",
        approach: [
          "Shrink the problem to its smallest case and solve that directly.",
          "Assume the pattern holds one size down, then extend it up by one.",
          "For coordination puzzles, assign roles and define one reliable signal per agent.",
          "Check the protocol never double-counts or loses information.",
        ],
        pitfalls: [
          "Memorizing the answer instead of deriving it from the base case.",
          "In common-knowledge puzzles, forgetting a public announcement adds shared knowledge even when everyone already sees the fact.",
          "Designing a signal a single agent might send more than once, corrupting a count.",
        ],
      },
    },
  },
  {
    id: "bt-4",
    section: "Techniques Toolkit",
    title: "Counting & Pigeonhole",
    subtitle: "Triangular sums, number theory, and the pigeonhole principle",
    blurb:
      "Counting-technique flashcards: triangular sums (house of cards, two-ball drops), trailing zeros, digit products, binary weights, and pigeonhole thresholds.",
    difficulty: "medium",
    mode: "flashcard",
    masteryThreshold: 0.75,
    flashcards: countingPigeonhole,
    // Six parametric counting families generate infinitely (bonus only); the
    // hand-authored one-offs above are the fixed mastery deck.
    flashcardGenerators: [
      pigeonholeFamily,
      houseOfCardsFamily,
      twoBallsFamily,
      trailingZerosFamily,
      digitProductFamily,
      binaryWeightsFamily,
    ],
    lesson: {
      paragraphs: [
        "A huge fraction of puzzles are secretly COUNTING problems. Two moves dominate: (1) recognize a triangular sum 1+2+…+n = n(n+1)/2 (stacked rows, shrinking-step searches), and (2) the pigeonhole principle, if items outnumber the boxes (times the per-box cap), some box overflows.",
        "Number-theory counts follow the same spirit: trailing zeros of n! count factors of 5 (Σ⌊n/5^i⌋), the smallest number with a given digit product is built greedily from 9 down to 2, and single-pan weights should be powers of two. Reason it out, reveal, and be honest.",
      ],
      keyIdea:
        "Count by structure: triangular sums, factor counts, and pigeonhole thresholds (boxes·(m−1)+1).",
      whyInterviewers:
        "Tests whether you set up an exact count instead of guessing or enumerating by hand.",
      deepDive: {
        whyItWorks:
          "A surprising number of puzzles are secretly exact counting problems: recognize a structured sum (such as a triangular sum) or apply the pigeonhole principle, if items outnumber the boxes times the per-box cap, some box must overflow. Setting up the count beats enumerating by hand.",
        approach: [
          "Decide what you are counting and by which structural unit (position, factor, cell).",
          "Recognize a standard sum, consecutive integers form a triangular sum.",
          "For existence claims, define the boxes and count items against capacity.",
          "Conclude an overflow whenever items exceed boxes times the per-box limit.",
        ],
        pitfalls: [
          "Counting by scanning items one by one instead of by position or structure.",
          "Skipping a divisibility check before claiming an equal split is possible.",
          "Mis-stating the pigeonhole threshold, off by one on boxes times capacity.",
        ],
      },
    },
  },
  {
    id: "bt-5",
    section: "Techniques Toolkit",
    title: "Invariants & Parity",
    subtitle: "Quantities that never change, parity, mirroring, and checksums",
    blurb:
      "Invariant flashcards: parity monovariants (last marble), coloring parity, conservation, mirror strategies, complementation, and modular-checksum hat lines.",
    difficulty: "hard",
    mode: "flashcard",
    masteryThreshold: 0.7,
    flashcards: invariantsParity,
    // The prisoners'-hats modular-checksum family and the toggling-lockers
    // divisor-parity family both generate infinitely; the invariant/parity/mirror
    // one-offs above are the fixed mastery deck.
    flashcardGenerators: [modularHatsFamily, lockerToggleFamily],
    lesson: {
      paragraphs: [
        "The most powerful single trick in puzzle-solving: find an INVARIANT, a quantity that every allowed move leaves unchanged (or a parity that never flips). If the goal state would violate the invariant, it's impossible; if the invariant pins down the end state, you get the answer for free.",
        "Symmetry is the same idea in disguise: mirror your opponent through a center, pair outcomes to cancel a bias (von Neumann), or broadcast one modular checksum so everyone downstream can decode their own hat. Look for what CAN'T change.",
      ],
      keyIdea:
        "Identify a conserved quantity or parity; the goal is forced (or forbidden) by it.",
      whyInterviewers:
        "Separates candidates who search blindly from those who find the structural invariant.",
      deepDive: {
        whyItWorks:
          "The strongest single trick is to find an invariant, a quantity every legal move leaves unchanged, or a parity that never flips. If the goal state would violate the invariant it is impossible; if the invariant pins down the end state, the answer falls out for free.",
        approach: [
          "Scan the allowed moves for a quantity none of them changes.",
          "Track its parity or exact value from the starting position.",
          "Test whether the goal state is consistent with that invariant.",
          "Use symmetry, mirroring or pairing, as an invariant you actively maintain.",
        ],
        pitfalls: [
          "Fixating on the visible, changing quantity instead of the conserved one.",
          "Assuming two mutually-exclusive extremes (like a maximum and a minimum count) can occur together.",
          "Searching case by case when a single invariant settles possibility or impossibility at once.",
        ],
      },
    },
  },
  {
    id: "bt-6",
    section: "Techniques Toolkit",
    title: "Games, Induction & Lateral Logic",
    subtitle: "Backward induction, combinatorial games, and classic traps",
    blurb:
      "Strategy flashcards: subtraction/Nim-style games, Wythoff pairs, backward-induction bargaining, pursuit, tournament selection, and famous lateral traps.",
    difficulty: "expert",
    mode: "flashcard",
    masteryThreshold: 0.7,
    flashcards: gamesInductionLateral,
    // The count-to-target subtraction-game family generates infinitely (target,
    // maxStep); the lateral/induction one-offs above are the fixed mastery deck.
    flashcardGenerators: [subtractionGameFamily],
    lesson: {
      paragraphs: [
        "Combinatorial games fall to BACKWARD INDUCTION: find the losing ('cold') positions by working back from the end, then always hand your opponent one. Subtraction games reduce to arithmetic mod (max step + 1); Wythoff's game hides its cold positions in the golden ratio.",
        "Bargaining puzzles (splitting loot) use the same shrink-to-the-base-case logic, and the lateral classics (the dehydrating produce, the pursuit on the pond) reward finding the one quantity that actually matters. Derive it, don't recall it.",
      ],
      keyIdea:
        "Work backward from the end: label cold positions, then force the opponent onto them.",
      whyInterviewers:
        "These reveal whether you can build a strategy from first principles under pressure.",
      deepDive: {
        whyItWorks:
          "Combinatorial games fall to backward induction: label the losing ('cold') positions by working back from the end, then always hand your opponent one. Bargaining puzzles use the same shrink-to-the-base-case logic, and lateral traps reward finding the one quantity that actually matters.",
        approach: [
          "Identify who wins from the terminal positions and reason backward.",
          "Mark cold positions from which every move hands the opponent a winning one.",
          "On your turn, always move onto a cold position.",
          "For bargaining, solve the smallest subgame and buy the cheapest majority upward.",
        ],
        pitfalls: [
          "Playing forward by intuition instead of labeling positions from the end.",
          "In percentage 'traps', tracking the changing quantity rather than the fixed one.",
          "Assuming voters accept any offer rather than comparing it to their fallback if the proposer is removed.",
        ],
      },
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
