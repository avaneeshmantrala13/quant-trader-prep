# Quant Question Bank — Probability & Statistics → Game Theory

> **Handoff note for [coworker] + the SLM training pipeline.** This is the second completed subcategory (**Game Theory**) of the **Probability and Statistics** category. It follows the same format as the Betting and Sizing handoff, with a few differences noted below because Game Theory is structured differently.

## How to read this document

**What this is.** 11 quant-interview game-theory questions, all in the one subcategory *Game Theory* under the *Probability and Statistics* category.

**Key difference from Betting and Sizing.** Betting and Sizing was one Kelly formula reused 90 times (a single parametric schema). Game Theory is **not** like that — it is a set of **distinct concepts**, each with its own solution method. So questions here are grouped by **game family** (the tool that solves them: dominant strategy, backward induction, mixed strategy, etc.), not by a repeating template. Do not expect a single formula.

**Company tags.** Unlike Betting and Sizing (no company attribution), several of these are **Jane Street**-tagged. Each question carries a **Company** field (`Jane Street` or `—` if unknown). 8 of 11 are Jane Street; 3 are untagged (Whose Turn Is It, Are We There Yet, Beach Carts). Do not synthesize a company where it says `—`.

**Three questions have NO single numeric answer — this is intentional.** Building the Book (coordination/stag hunt), Are We There Yet (non-credible threat), and Spread Truce (repeated game / folk theorem) are open-ended "explain the reasoning" problems. Their `Correct Answer` line explicitly says "no single number" and states what the real answer is (the reasoning). **For SLM training, route these as long-form explanation / SFT targets, NOT as verifiable-reward (RL) items** — there is no scalar to check. The other 8 have exact numeric answers suitable for verifier-checked RL.

**Structure — three levels, outer to inner:**
1. **Category** → `Probability and Statistics`.
2. **Subcategory** → `Game Theory` (this file).
3. **Family** → the solution method. There are 8 families here (dominant-strategy/PD, coordination, sequential/backward-induction, spatial/Hotelling, beauty-contest, zero-sum/mixed, repeated/folk-theorem, volunteer's-dilemma).

**Each question carries:** a Company tag, a Difficulty (Easy/Medium/Hard), a Concept, then two forms:
- **Condensed** — a one-line question and a compact worked answer (fluff removed, same numbers/logic).
- **Verbatim** — the exact question text and full step-by-step solution as it appeared on the source platform.

There is also a **per-question index table** at the top of the subcategory summarizing family, concept, company, difficulty, and answer for all 11.

**For SLM training specifically:**
- 8 questions have a single exact answer (2, 7, 6, 50, 2.8, 2.5, 0.0625, and Half-the-Average's equilibrium 0) — verifier-checkable.
- 3 questions are reasoning-only (see above) — treat as explanation targets.
- Condensed = short-CoT target; Verbatim = long-CoT / full-derivation target.
- The concepts covered: Prisoner's Dilemma, stag hunt / coordination, backward induction & credible threats, Hotelling / median-voter, Keynesian beauty contest & level-k, zero-sum mixed strategy & minimax, repeated-game folk theorem & grim trigger, Volunteer's Dilemma & diffusion of responsibility.

---

# Probability and Statistics — Game Theory

> **Note on this subcategory.** Unlike *Betting and Sizing* (one Kelly formula reused 90 times), Game Theory is a set of **distinct concepts**, each with its own solution method. Questions are grouped by **game family** (the tool that solves them). Each carries a **Company** tag where known, a **Concept**, and — for the numeric ones — an exact `Correct Answer`. Three questions (Are We There Yet, Building the Book, Spread Truce) are open-ended "explain the reasoning" problems with **no single numeric answer**; that is the intended answer and is flagged.

## Game Theory — index of questions

| Question | Family | Concept | Company | Difficulty | Answer |
|---|---|---|---|---|---|
| Whose Turn Is It | Simultaneous / dominant strategy | Prisoner's Dilemma | — | Easy | 2 |
| Latency Arms Race | Simultaneous / dominant strategy | Prisoner's Dilemma | Jane Street | Easy | 7 |
| Building the Book | Coordination | Stag hunt (2 pure + 1 mixed NE) | Jane Street | Medium | no single answer |
| Challenger's Gambit | Sequential | Backward induction, credible threat | Jane Street | Medium | 6 |
| Are We There Yet | Sequential | Non-credible threat, commitment | — | Medium | no single answer |
| Beach Carts | Spatial competition | Hotelling / median-voter | — | Easy | 50 |
| Half the Average | Iterated dominance | Beauty contest, level-k | Jane Street | Medium | 0 (equilibrium) |
| Quoting Duel | Zero-sum | Mixed strategy, minimax | Jane Street | Medium | 2.8 |
| Redundant Quote | Zero-sum | Dominated-row elimination + mixing | Jane Street | Hard | 2.5 |
| Spread Truce | Repeated game | Folk theorem, grim trigger | Jane Street | Hard | no single answer (δ ≥ 3/7) |
| Who Calls the Landlord | Volunteer's Dilemma | Symmetric mixed equilibrium | Jane Street | Hard | 0.0625 |

---

## Family: Simultaneous games / dominant strategy

*Method: best-response analysis down each column → if one action wins in every column it is strictly dominant. Both players play their dominant action; that cell is the unique Nash equilibrium. Both examples here are the Prisoner's Dilemma (dominant-strategy play yields an outcome both players dislike).*

### GT1 — Whose Turn Is It
**Company:** — · **Difficulty:** Easy · **Concept:** Prisoner's Dilemma (dominant strategy)

#### Condensed
**Q:** Flatmates simultaneously Clean up or Leave it. Payoffs (you, mate): (Clean,Clean)=(4,4), (Clean,Leave)=(1,5), (Leave,Clean)=(5,1), (Leave,Leave)=(2,2). Unique NE payoff to you?
**A:** Leave it dominates (5>4 vs Clean, 2>1 vs Leave), symmetric → both Leave it. Unique NE = (Leave, Leave) = **2** each. (Both-Clean pays 4 but is unstable — a Prisoner's Dilemma.)

#### Verbatim
You and your flatmate share a kitchen. Each night, independently and without coordinating, you each decide whether to Clean up the day's mess (a bit of effort now) or Leave it for the other person to deal with. The table below gives the payoffs as (your happiness, flatmate's happiness) in arbitrary units:

| | Flatmate: Clean up | Flatmate: Leave it |
|---|---|---|
| You: Clean up | (4, 4) | (1, 5) |
| You: Leave it | (5, 1) | (2, 2) |

Read the top-right cell as: if you Clean up while your flatmate Leaves it, you get 1 (you did all the work) and they get 5 (they relax in a clean kitchen). Both of you are rational and care only about your own happiness. What happiness do you earn in the unique Nash equilibrium?

Before solving, let's set up the language. This is a simultaneous game: each player picks an action without seeing the other's choice, and the payoff matrix records what each earns for every combination, written as (your payoff, flatmate's payoff). The cheapest first move when solving any such game is to look for a dominant strategy: an action that gives you a strictly higher payoff than your other action no matter what the opponent does. If you have one, a rational you will always play it; and if your equally rational flatmate has one too, the game is solved on the spot.

The tool for finding it is best-response analysis: freeze your flatmate on each of their choices in turn, and ask which of your own actions pays you more. Let's read down each column of the matrix.
- If your flatmate Cleans up (left column), you compare your payoffs: Clean up gives 4, Leave it gives 5. Since 5>4, you prefer to Leave it.
- If your flatmate Leaves it (right column), you compare again: Clean up gives 1, Leave it gives 2. Since 2>1, you prefer to Leave it.

Leave it is better for you in both columns, so Leave it is your strictly dominant strategy. The game is symmetric — your flatmate faces an identical matrix from their side — so by exactly the same reasoning Leave it is dominant for them too. Both of you Leave it.

This pair of choices is a Nash equilibrium: a combination where no player can raise their own payoff by switching alone. At (Leave it, Leave it) you each earn 2, and neither of you can do better by deviating. It is the unique Nash equilibrium, so your happiness is 2.

This little game is the famous Prisoner's Dilemma. Notice the trap: if you could both just Clean up, you would each enjoy 4 — a tidy kitchen for shared effort — which beats the grimy 2 you actually end up with. But (Clean up, Clean up) is not stable, because from there either of you can sneak a switch to Leave it and jump from 4 to 5, dumping the chore on the other. Each of you, acting rationally and in your own interest, is dragged to the worse shared outcome. This is the same force that drives the Latency Arms Race question, where two trading firms both overspend on speed: individually rational defection produces a result both sides dislike.

**Correct Answer: 2**

---

### GT2 — Latency Arms Race
**Company:** Jane Street · **Difficulty:** Easy · **Concept:** Prisoner's Dilemma (dominant strategy)

#### Condensed
**Q:** Two HFT firms simultaneously Hold or Upgrade. Payoffs (you, rival): (Hold,Hold)=(10,10), (Hold,Upgrade)=(5,13), (Upgrade,Hold)=(13,5), (Upgrade,Upgrade)=(7,7). Unique NE payoff?
**A:** Upgrade dominates (13>10 vs Hold, 7>5 vs Upgrade), symmetric → both Upgrade. Unique NE = (Upgrade, Upgrade) = **7** each. (Both-Hold pays 10 but is unstable — Prisoner's Dilemma / latency arms race.)

#### Verbatim
You and a rival high-frequency trading firm each have to decide, independently and at the same moment, whether to Hold (keep your current data line) or Upgrade (pay for a faster line so you see and react to market prices ahead of the competition). The game is symmetric, and the table below gives the monthly profits in arbitrary units as (your profit, rival's profit):

| | Rival: Hold | Rival: Upgrade |
|---|---|---|
| You: Hold | (10, 10) | (5, 13) |
| You: Upgrade | (13, 5) | (7, 7) |

Read the top-right cell as: if you Hold while the rival Upgrades, you earn 5 and the rival earns 13. Both firms are rational and care only about their own profit. What profit do you earn in the unique Nash equilibrium?

Before solving, let's set up the language of a simultaneous game. Each player picks one action without seeing the other's choice, and the payoff matrix records what each player earns for every combination of choices, written as (your payoff, rival's payoff). The cheapest first move when solving any such game is to look for a dominant strategy: an action that gives you a strictly higher payoff than every other action no matter what the opponent does. If you have one, a rational you will always play it; and if your equally rational opponent has one too, the game is solved on the spot.

The tool for finding a dominant strategy is best-response analysis: freeze the opponent on each of their choices in turn, and ask which of your own actions pays you more.
- If the rival Holds (left column), you compare your payoffs: Hold gives 10, Upgrade gives 13. Since 13>10, you prefer to Upgrade.
- If the rival Upgrades (right column), you compare again: Hold gives 5, Upgrade gives 7. Since 7>5, you prefer to Upgrade.

Upgrade is better for you in both columns, so Upgrade is your strictly dominant strategy. The game is symmetric — the rival faces an identical matrix from their side — so by exactly the same reasoning Upgrade is dominant for the rival too. Both of you Upgrade.

This pair of choices is a Nash equilibrium: a combination where no player can raise their own payoff by switching alone. At (Upgrade, Upgrade) you each earn 7, and neither of you can do better by deviating. It is the unique Nash equilibrium of the game, so your profit is 7.

This little game is the famous Prisoner's Dilemma. Notice the trap: if you could both just Hold, you would each pocket 10, which beats the 7 you actually end up with. But (Hold, Hold) is not stable, because from there either firm can sneak a switch to Upgrade and jump from 10 to 13. Each of you, acting rationally and in your own interest, is dragged to the worse shared outcome.

The trading story here is the latency arms race. "Latency" is the delay between the market changing and your system being able to act on it; "Upgrade" means paying for faster hardware, a closer server, or a quicker data feed so you see and react to prices before the competition does. When one firm gets faster, it picks off the good trades first and leaves the slower firm with the leftovers — so each firm is forced to keep spending just to avoid being the slow one. Collectively the firms would all be richer if nobody had to pay for the upgrades, but no single firm can afford to be the one who stands still. That is the Prisoner's Dilemma playing out on a real desk.

**Correct Answer: 7**

---

## Family: Coordination games

*Method: best-response analysis reveals multiple Nash equilibria; the substance is which one gets played. Distinguish payoff-dominant vs risk-dominant equilibria; resolution needs a focal point outside the matrix.*

### GT3 — Building the Book
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Coordination / stag hunt (payoff- vs risk-dominance)

#### Condensed
**Q:** Two market makers simultaneously Build or Stay Safe. Payoffs (you, rival): (Build,Build)=(9,9), (Build,Safe)=(0,6), (Safe,Build)=(6,0), (Safe,Safe)=(6,6). What to do?
**A:** Best-reply is to match → **two pure NE** (Build,Build)=(9,9) and (Safe,Safe)=(6,6), plus a mixed NE at Build-prob m=2/3. (Build,Build) is payoff-dominant; Stay Safe is risk-dominant (guarantees 6; Build averages 4.5 vs a coin-flip rival). **No single forced answer** — depends on trust / focal point. This is a stag hunt.

#### Verbatim
You and a rival market maker are each, independently and without communicating, deciding how to treat a newly launched product. You can either Build the Book — commit real capital to quote tight, two-sided prices all day — or Stay Safe and only handle easy, low-risk flow. Quoting a deep market in a new product only pays off if the other firm does it too: with two committed makers the product attracts real volume and you both profit handsomely, but if you commit alone you get picked off and lose. The payoffs (your profit, rival's profit), in arbitrary units, are:

| | Rival: Build | Rival: Stay Safe |
|---|---|---|
| You: Build | (9, 9) | (0, 6) |
| You: Stay Safe | (6, 0) | (6, 6) |

You cannot talk to each other beforehand. Do you Build the Book or Stay Safe?

This is a coordination game — specifically the one game theorists call a stag hunt — and unlike a game with a dominant strategy, it has no single forced answer. That is the whole reason it gets asked.

Start with the reliable hand method, best-response analysis: for each thing the rival might do, find your best reply, then look for cells where both players are simultaneously best-responding (a Nash equilibrium, a cell neither player wants to leave alone).
- If the rival Builds, you compare 9 (Build) against 6 (Stay Safe) and prefer to Build.
- If the rival Stays Safe, you compare 0 (Build) against 6 (Stay Safe) and prefer to Stay Safe.

Your best reply is to match the rival, and by symmetry theirs is to match you. So there are two pure-strategy Nash equilibria: (Build, Build) paying (9, 9), and (Stay Safe, Stay Safe) paying (6, 6). There is also a third, mixed equilibrium: if each of you Builds with probability m, the other is made indifferent when 9m = 6m + 6(1−m), that is 9m = 6, so m = 2/3. Three equilibria, and nothing in the rules tells you which one occurs — that is why there is no single correct action.

The tension between the two pure equilibria is the substance of the question.
- **Payoff dominance:** (Build, Build) is better for both of you than (Stay Safe, Stay Safe), 9 against 6. If you could simply agree, you would both Build and never look back.
- **Risk dominance:** Building is only great if the rival also Builds; if they Stay Safe, your Build collapses to 0. Stay Safe guarantees 6 whatever they do. Measure the risk by asking what is best against a rival equally likely to do either thing: Building yields ½(9)+½(0)=4.5, while Staying Safe yields ½(6)+½(6)=6. Against an uncertain partner, Stay Safe wins, so it is the risk-dominant choice.

So the answer genuinely depends on something outside the payoff matrix: how much you trust the rival to be bold. The best outcome requires mutual confidence; the safe outcome is what fear delivers. Real players resolve the ambiguity using a focal point — a shared expectation that lets them coordinate without talking, such as an industry convention, a prior relationship, a public signal of commitment, or simply which firm is known to make markets aggressively. Anything that lets you both believe the other will Build pulls you to (9, 9); any doubt pushes you both to the safe (6, 6).

**Correct Answer: no single answer** — two pure NE (9,9) and (6,6) plus mixed NE at m=2/3; choice depends on trust / focal point.

---

## Family: Sequential games

*Method: backward induction on the game tree (extensive form) — solve the last mover first, fix it, roll back. Produces subgame-perfect equilibrium and automatically strips out non-credible threats.*

### GT4 — Challenger's Gambit
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Backward induction, credible threat

#### Condensed
**Q:** Sequential entry game, payoffs (Challenger, Incumbent): Challenger Stays Out → (0,10); Enters → Incumbent Fights → (−4,−2), or Accommodates → Challenger Holds (3,5) or Expands (6,1). Challenger's payoff at the rational outcome?
**A:** Backward induction: Challenger's last move Expand (6>3) → Incumbent Accommodates (1>−2) → Challenger Enters (6>0). Path Enter→Accommodate→Expand → Challenger earns **6**. The "I'll fight a price war" threat is non-credible (fighting pays −2 < accommodating +1).

#### Verbatim
A small challenger fund is deciding whether to break into a market that an established incumbent currently dominates. The game unfolds in stages, and every payoff is written (Challenger, Incumbent):
- The Challenger first chooses to Stay Out or Enter. Staying out ends the game at (0, 10).
- If the Challenger Enters, the Incumbent observes this and chooses to Fight a price war or Accommodate. Fighting ends the game at (-4, -2).
- If the Incumbent Accommodates, the Challenger makes one final choice: Hold its current size for (3, 5), or Expand for (6, 1).

Everyone is rational, cares only about their own payoff, and all of this is common knowledge. What payoff does the Challenger earn at the rational outcome of the game?

This is a sequential game: the players move in turn, each seeing what came before, so we picture it as a tree (the "extensive form") rather than a grid. The right tool is backward induction — you reason from the last decision back to the first. The logic is that whoever moves last faces a simple choice with no future left to worry about, so you can settle it immediately; once you know what they will do, the second-to-last mover can treat that as fixed, and so on back to the opening move. The strategy profile this produces is called a subgame-perfect equilibrium.

Let's walk the tree from the end.

Step 1: the Challenger's final move, reached only if the Incumbent has Accommodated. The Challenger compares Hold, worth 3 to itself, against Expand, worth 6. Since 6>3, the Challenger Expands, and this branch resolves to (6, 1).

Step 2: the Incumbent's move, reached only if the Challenger has Entered. The Incumbent now looks ahead and knows that if it Accommodates, the Challenger will Expand, leaving the Incumbent with 1. Its choices are therefore Fight, worth −2 to itself, or Accommodate, worth 1. Since 1>−2, the Incumbent Accommodates.

Step 3: the Challenger's opening move. The Challenger foresees that entering leads to Accommodate and then Expand, which pays the Challenger 6, while staying out pays 0. Since 6>0, the Challenger Enters.

Stitching the rational choices together, the game's path is Enter, then Accommodate, then Expand, with payoffs (6, 1). The Challenger earns 6.

The interview point hiding in here is the idea of a credible threat. The Incumbent would dearly love to scare the Challenger off by announcing "if you enter, I will Fight a price war." If the Challenger believed it, entry would look like it leads to −4, worse than the 0 from staying out, and the Challenger would stay home. But the threat is empty: once entry has actually happened, fighting earns the Incumbent −2 while accommodating earns +1, so a rational Incumbent never fights. Backward induction automatically strips out these non-credible threats, which is exactly why we trust its answer over the bluff. (A "price war" here means deliberately quoting at a loss — undercutting on price or spread below your own cost — to drive the rival out; it hurts whoever wages it, which is why the threat to start one is rarely believable.)

There is a second, subtler lesson. A naive Incumbent might Accommodate while expecting the Challenger to politely Hold, which would hand the Incumbent 5. But a rational Challenger, once accommodated, Expands and grabs the bigger share, dropping the Incumbent to 1. Anticipating your opponent's actual last move, not the one you wish they would make, is the entire discipline of backward induction.

**Correct Answer: 6**

---

### GT5 — Are We There Yet
**Company:** — · **Difficulty:** Medium · **Concept:** Non-credible threat, commitment devices

#### Condensed
**Q:** Sequential parenting game. Child chooses Keep Screaming / Quiet Down, then parent chooses Drive Home / Carry On. Payoffs (you, child): (Quiet,CarryOn)=(10,5), (Screaming,CarryOn)=(4,8), (Screaming,DriveHome)=(1,0). Is "stop or we go home" credible?
**A:** Backward induction: on the screaming branch you Carry On (4>1), so driving home is a **non-credible threat**. Child foresees this and keeps screaming (8>5) → outcome (4,8). No single number. Fixes that make a threat credible: (1) commitment device / burn bridges, (2) reputation via repeated play, (3) pick a punishment that's cheap for *you* to execute, (4) emotion as commitment. Answer = recognize non-credibility + name the fixes.

#### Verbatim
You have finally loaded the whole family into the car for a long-awaited day at the beach, and barely ten minutes from home your young child starts screaming in the back seat. You play the classic parental card: "If you don't stop screaming, we turn around and go straight home." Treat this as a sequential game. First the child, hearing your ultimatum, chooses to Keep Screaming or Quiet Down; then you, having heard the child, choose to Drive Home or Carry On to the beach. The crux is that driving home punishes you too: you also lose the beach day you got up early to drive to. With illustrative payoffs (yours as the parent first, then the child's):

| Child's move | Your move | Outcome (you, child) |
|---|---|---|
| Quiet Down | Carry On | (10, 5) |
| Keep Screaming | Carry On | (4, 8) |
| Keep Screaming | Drive Home | (1, 0) |

The peaceful beach day (10, 5) is your dream; a noisy-but-still-the-beach day (4, 8) is a win for the child; turning the car around (1, 0) is the threatened punishment, and it costs you the outing as well. (The fourth combination — the child quiets down and you drive home anyway — is off the table; no parent punishes a child who has just gone quiet.) Is your threat credible? Will it actually stop the screaming, and if not, what would make it work?

This is a sequential game: the players move one after another, each seeing what came before, so we draw it as a tree (the "extensive form") rather than a payoff grid. The tool for solving any such game is backward induction — you reason from the last decision back to the first. The idea is that whoever moves last faces a clean choice with no future left to influence, so you can settle what they will do immediately; once that move is fixed you treat it as known and ask what the second-to-last mover does against it, and you roll the logic all the way back to the opening move.

Let's walk the tree from the end. Your final move only really bites on the branch where the child has kept screaming — if the child has already quieted down you happily Carry On to the beach and reach (10, 5), with nothing to agonize over. So focus on the hard branch. The screaming has already happened; it is in the past and nothing you do now can un-ring that bell. The only question is which future you prefer from here: Carry On to the beach pays you 4, while Drive Home pays you 1. Since 4>1, you Carry On. Driving home would punish you a second time, throwing away the very outing you organized — so a calm, self-interested parent simply does not do it.

Now step back to the child, who is not stupid. The child looks ahead and realizes that whatever they do, you are going to end up at the beach, because Carry On beats Drive Home for you in every case. So the child compares only their own two reachable outcomes: Keep Screaming and still get the beach pays the child 8, whereas Quiet Down and get the beach pays 5. Since 8>5, the child keeps right on screaming. Your dramatic ultimatum changed nothing, and you arrive at the beach frazzled at (4, 8).

The name for what just happened is a non-credible threat. A threat is credible only if carrying it out is actually in your interest at the moment you would have to carry it out. Yours fails that test: "go straight home" sounds fearsome in advance, but the instant the child calls your bluff, executing it makes you strictly worse off (1 instead of 4), so you back down. Backward induction automatically strips out threats you would never want to execute, which is exactly why the literal ultimatum is empty.

So if the words alone are worthless, what makes discipline — or any threat, in parenting, diplomacy, or business — actually work? You must somehow change the game so that following through becomes your genuine best response. Four classic ways:
- **Commitment device.** Remove your own ability to back down. Make Drive Home automatic or more painful to skip than to do, rewriting your payoffs until carrying out the threat is what you'd actually choose. Schelling's "burning your bridges" — voluntarily destroying your escape route so the threat is self-enforcing.
- **Reputation and repeated play.** This is one round in years of parenting, with siblings watching. Carrying out a costly threat once becomes an investment: it teaches everyone your threats are real, paying off across every future standoff.
- **Choose a threat that is cheap for you to carry out.** "No screen time tonight" costs you nothing to follow through on, which is exactly why it is credible.
- **Emotion as commitment.** A parent known to act on principle/anger rather than cold cost-benefit is more persuasive — emotions function as a built-in commitment device guaranteeing you won't coolly optimize your way out.

All four are one idea: a threat works only when the person making it would genuinely want to carry it out when the time comes. Recognizing the threat is non-credible, and then naming precisely what would make it credible, is the whole answer the interviewer is listening for.

**Correct Answer: no single number** — the threat is non-credible (you'd Carry On, 4>1); child keeps screaming → (4,8). Answer = identify non-credibility + name the credibility fixes (commitment / reputation / cheap punishment / emotion).

---

## Family: Spatial competition

*Method: best-response analysis on positions → Nash equilibrium where neither competitor can gain by moving alone. The Hotelling model; both converge to the median.*

### GT6 — Beach Carts
**Company:** — · **Difficulty:** Easy · **Concept:** Hotelling / median-voter / minimum differentiation

#### Condensed
**Q:** Beach 0–100, 100 sunbathers 1/metre, each buys from nearer of two ice-cream carts placed simultaneously. Where do carts end up, how many do you serve?
**A:** Best reply is to crowd just beside the rival on the bigger side (grabbing max(b,100−b) ≥ 50). Only stable point is both at the **centre, 50** — the unique NE — each serving **50**. Median-voter / minimum-differentiation result. (Stable but inefficient: 25 & 75 would minimize walking but isn't an equilibrium.)

#### Verbatim
A long, straight beach runs from metre 0 to metre 100, with sunbathers spread perfectly evenly along its whole length: picture one sunbather per metre, 100 in all. You and a rival each run an ice-cream cart, and at the start of the day the two of you simultaneously pick a spot anywhere on the beach to park. Every sunbather then walks to whichever cart is nearer and buys an ice cream there; a sunbather sitting exactly midway between the two carts is equally likely to go either way, so such ties split evenly. Each of you cares about one thing only — selling to as many sunbathers as possible. Where do the two carts end up, and how many of the 100 sunbathers do you serve there?

This is a spatial competition problem — the classic Hotelling model — and the tool that cracks it is plain best-response analysis: freeze your rival at some position, work out your own best reply, then look for a pair of positions where each cart is simultaneously best-responding to the other. Such a mutually stable pair is a Nash equilibrium.

First, let's nail down who buys from whom. Put your cart at position a and the rival's at b, and suppose a<b. Each sunbather goes to the nearer cart, so the dividing line is exactly the midpoint m=(a+b)/2: everyone to the left of m is closer to you, everyone to the right is closer to the rival. Since the sunbathers are spread one per metre, your share is simply the length of beach on your side, m customers, and the rival gets 100−m.

Now the crucial move. Suppose the rival has parked at some spot b. What is your best reply? You can slide your cart right up next to theirs and steal the entire beach on one side:
- Park just to the left of the rival, at a=b−ε for a tiny ε. The midpoint then sits essentially at b, so you scoop up everyone from 0 up to b — about b customers.
- Park just to the right, at a=b+ε. Now you scoop everyone from b to 100 — about 100−b customers.

Parking anywhere far from the rival only splits the beach more evenly between you, which is worse, so your best reply is to crowd right up against them on whichever side holds more beach. That hands you max(b, 100−b) customers — always at least 50, with equality only when b sits dead centre.

This single fact settles the game. Take any rival position b≠50. The longer side then holds strictly more than half the sunbathers, so by parking just beside the rival on that side you grab strictly more than 50, leaving the rival with strictly fewer than 50. The rival, being just as clever, will not sit still for that. So no off-centre arrangement can be stable.

The only spot immune to this squeeze is the exact centre, b=50. If the rival is at 50 and you try to undercut by parking at 50+ε, the longer side is now the stretch below you — but it is only just under half the beach, so you capture just under 50 customers, worse than the clean 50 you get by parking at 50 yourself. So your best reply to a rival at 50 is to sit at 50 too, and by identical reasoning that is the rival's best reply to you. Both carts at the centre is the unique Nash equilibrium, and you each serve 50 of the 100 sunbathers.

This is the celebrated median-voter result. The midpoint of a uniform crowd is its median, and anyone standing away from the median can be undercut by a rival who steps just inside them. Economists call the resulting huddle the principle of minimum differentiation — why two petrol stations, coffee chains, or hardware shops so often sit side by side, why rival products end up nearly identical, and why two vote-chasing candidates drift toward the centre.

It is worth seeing that this equilibrium, though stable, is socially wasteful. If the carts sat at 25 and 75, every sunbather would be at most 25 metres from a cart and total walking distance would be minimized. But that arrangement is not an equilibrium: from 25 you would leap to just below 75 and seize the whole right half. Private competition huddles the carts at the centre even though everyone would be better served by spreading them out.

**Correct Answer: 50**

---

## Family: Beauty contest

*Method: iterated elimination of dominated strategies → unique Nash equilibrium at 0, but the money-winning answer uses level-k thinking (go one level deeper than the room).*

### GT7 — Half the Average
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Keynesian beauty contest, level-k reasoning

#### Condensed
**Q:** Many analysts each write a whole number 0–100; closest to *half the average* wins. What do you write, what wins?
**A:** Iterated dominance (>50 dominated → >25 → >12.5 …) collapses to the unique NE = **0**. But winning ≠ equilibrium: real rooms play level-k (L0≈50, L1≈25, L2≈12.5…), so the winning number is small-but-positive. Skilled answer: "estimate the room's reasoning depth, then go one level deeper." No single winning number.

#### Verbatim
Your trading desk plays a guessing game at the Monday meeting. Each of the many analysts privately writes down a whole number between 0 and 100. The winner is the analyst whose number lands closest to half of the average of everyone's numbers, and the winner takes a bonus. What number should you write down — and what do you actually expect the winning number to be?

This is a famous game — economists call it a beauty contest — and it is the cleanest illustration of why a perfectly rigorous game-theoretic answer and the answer that actually wins money can be two different numbers.

First, the technique: iterated elimination of dominated strategies. A choice is dominated if some other choice is always at least as good no matter what everyone else does, and a rational player never makes a dominated choice. Once you delete everyone's dominated choices the game shrinks, and choices that were fine before may become dominated in the smaller game — so you delete again, and keep going.

Apply it here. The average of numbers between 0 and 100 can be at most 100, so half the average can be at most 50. Any guess above 50 can never be closest to the target — it is dominated — so cross out 51 to 100. But now everyone is choosing from 0 to 50, the average is at most 50, half is at most 25, and every guess above 25 is now dominated. Cross those out too. Repeat: the ceiling falls to 12.5, then 6.25, each round halving it. Iterating forever, the only number that survives is 0. So the unique Nash equilibrium is for every analyst to write 0.

Here is the catch. Winning does not require you to play the equilibrium; it requires you to be closest to half of what your actual colleagues write. Real people do not run the elimination infinitely. The standard model is level-k thinking:
- A level-0 player picks something like the midpoint, around 50.
- A level-1 player assumes everyone else is level-0 and best-responds: half of 50, about 25.
- A level-2 player assumes everyone is level-1 and guesses about 12.5, and so on, each layer halving.

| Reasoning level k | Guess = 50·(1/2)^k |
|---|---|
| 0 | 50 |
| 1 | 25 |
| 2 | 12.5 |
| 3 | 6.25 |
| 4 | 3.125 |

Real rooms are a mixture of these depths, so the average lands well above 0 and the winning guess is a small but positive number that depends entirely on how sophisticated the room is. Guessing 0 is "correct" in equilibrium yet usually loses. The genuinely skilled answer is not a number: it is "estimate how many levels of reasoning this specific group will do, then go one level deeper."

**Correct Answer: 0** in equilibrium (money-winning answer is a small positive number, "one level deeper than the room" — no single fixed number).

---

## Family: Zero-sum games

*Method: check for a pure-strategy equilibrium (best responses cycle → none); then apply the indifference principle to find the mixing probabilities and the value of the game (von Neumann minimax). Eliminate strictly dominated rows first if present.*

### GT8 — Quoting Duel
**Company:** Jane Street · **Difficulty:** Medium · **Concept:** Mixed strategy, indifference principle, minimax value

#### Condensed
**Q:** 2×2 zero-sum, your payoffs: Top=(L4,R1), Bottom=(L2,R4). Value of the game with optimal mixing?
**A:** No pure NE (best responses cycle). Mix Top with prob p: set 2+2p = 4−3p → p=2/5. Value = 2+2(2/5) = **2.8**. (Opponent mixes Left q=3/5.) Randomizing beats the safe pure Bottom (guarantees only 2).

#### Verbatim
You are locked in a stylized two-player zero-sum game against another trader. You secretly pick one of the two rows of the payoff table — Top or Bottom — while your opponent secretly picks one of the two columns — Left or Right. You choose simultaneously. The number in each cell is your payoff in arbitrary units; because the game is zero-sum, your opponent's payoff is exactly the negative.

| | Opponent: Left | Opponent: Right |
|---|---|---|
| Top | 4 | 1 |
| Bottom | 2 | 4 |

Both of you play optimally, randomizing if it helps. What is your expected payoff per round — the value of the game? (Round to 2 decimals.)

A zero-sum game is one where your gain is exactly your opponent's loss. A mixed strategy means you randomize, playing Top with some probability and Bottom the rest of the time. Every finite game has at least one equilibrium once randomizing is allowed.

Let's first check for a pure-strategy equilibrium. Trace the best responses:
- If your opponent plays Left, you compare 4 (Top) against 2 (Bottom) and prefer Top.
- But if you play Top, your opponent prefers Right, cutting your score to 1.
- If your opponent plays Right, you compare 1 (Top) against 4 (Bottom) and prefer Bottom.
- But if you play Bottom, your opponent prefers Left.

The best responses chase each other in a loop, so there is no pure-strategy equilibrium. We must mix.

The key idea is the indifference principle: choose your mixing probability so that your opponent gets the same expected payoff from Left as from Right, removing any reason for them to lean one way. Let p be the probability you play Top:
- payoff if they play Left = 4p + 2(1−p) = 2 + 2p
- payoff if they play Right = 1·p + 4(1−p) = 4 − 3p

Set equal: 2 + 2p = 4 − 3p ⟹ 5p = 2 ⟹ p = 2/5. So play Top two times in five. The value is 2 + 2·(2/5) = 14/5 = 2.8.

For completeness, the opponent's mix: let q be the probability of Left, chosen to make you indifferent: 1 + 3q = 4 − 2q ⟹ 5q = 3 ⟹ q = 3/5. Against Right the value checks out: 4 − 3·(2/5) = 14/5 = 2.8, matching. This is von Neumann's minimax theorem: your maximin equals the opponent's minimax, and that common number is the value. Naively playing the "safe" pure Bottom only guarantees min(2,4)=2, strictly less than 2.8 — randomizing buys the edge.

The trading lesson: any predictable pattern in how you quote, hedge, or route orders can be detected and leaned on by a counterparty. Mixing — deliberately randomizing so the other side cannot read you — is the optimal policy, lifting your guaranteed take from 2 to 2.8 per round.

**Correct Answer: 2.8**

---

### GT9 — Redundant Quote
**Company:** Jane Street · **Difficulty:** Hard · **Concept:** Iterated dominance + mixed strategy in a 3×2 zero-sum

#### Condensed
**Q:** 3×2 zero-sum, your payoffs: Top=(L5,R1), Middle=(L3,R0), Bottom=(L0,R4). Value?
**A:** Middle is strictly dominated by Top (5>3, 1>0) → delete it. Remaining 2×2 has no pure NE; mix Top with prob p: 5p = 4−3p → p=1/2. Value = 5·(1/2) = **2.5**. (Opponent Left q=3/8; discarded Middle would've paid only 1.125, confirming the deletion was safe.)

#### Verbatim
You face a two-player zero-sum game in which you choose one of three rows — Top, Middle, or Bottom — while your opponent chooses one of two columns — Left or Right. You move simultaneously, and each cell shows your payoff:

| | Opponent: Left | Opponent: Right |
|---|---|---|
| Top | 5 | 1 |
| Middle | 3 | 0 |
| Bottom | 0 | 4 |

Both of you play optimally, randomizing if it helps. What is the value of the game? (Round to 2 decimals.)

The first move is pure bookkeeping: prune choices nobody would make. A strategy is strictly dominated if some other strategy gives strictly higher payoff in every column; a rational player never plays it.

Compare Top with Middle: 5>3 against Left and 1>0 against Right. Top beats Middle whatever the opponent does, so Middle is strictly dominated by Top — delete the Middle row. (This is the "redundant quote" of the title: a third option that looks like a choice but is strictly worse.)

What remains is a 2×2 zero-sum: Top=(5,1), Bottom=(0,4). Check for a stable cell: against Left you prefer Top (5>0), but facing Top the opponent prefers Right (cutting you to 1); against Right you prefer Bottom (4>1), but facing Bottom the opponent prefers Left. The best responses cycle, so no pure equilibrium — mix.

Apply the indifference principle. Let p be the probability you play Top:
- payoff if they play Left = 5p + 0(1−p) = 5p
- payoff if they play Right = 1·p + 4(1−p) = 4 − 3p

Set equal: 5p = 4 − 3p ⟹ 8p = 4 ⟹ p = 1/2. Value = 5·(1/2) = 2.5.

Confirm the opponent's side and that dropping Middle was safe. Let q be the probability of Left, making you indifferent: 1 + 4q = 4 − 4q ⟹ 8q = 3 ⟹ q = 3/8. Against this mix the discarded Middle row would have paid 3·(3/8) = 9/8 = 1.125, far below the 2.5 from Top/Bottom — so eliminating Middle cost nothing.

**Correct Answer: 2.5**

---

## Family: Repeated games

*Method: solve the one-shot game (Prisoner's Dilemma), then add discounting. Cooperation is sustainable via grim-trigger when the discount factor clears δ* = (T−R)/(T−P). Folk theorem: many equilibria exist.*

### GT10 — Spread Truce
**Company:** Jane Street · **Difficulty:** Hard · **Concept:** Repeated Prisoner's Dilemma, folk theorem, grim trigger

#### Condensed
**Q:** Repeated market-maker PD, payoffs (you, rival): (Coop,Coop)=(10,10), (Coop,Undercut)=(5,13), (Undercut,Coop)=(13,5), (Undercut,Undercut)=(6,6), discount δ. Can wide-spread cooperation be sustained?
**A:** One-shot: Undercut dominates → both grind to 6. Repeated with grim trigger, cooperation holds when δ ≥ (T−R)/(T−P) = (13−10)/(13−6) = **3/7 ≈ 0.43**. Above that, (Coop,Coop)=10 is sustainable — but the folk theorem means it's not unique (perpetual undercut is also equilibrium). A fixed end date unravels it; tit-for-tat handles noise better. No single number.

#### Verbatim
You and a rival market maker meet in the same product every single trading day, and the relationship has no fixed end date. Each day you simultaneously choose to Cooperate (keep your quoted spread wide) or Undercut (quote a tighter spread to grab order flow). A single day's profits (yours, rival's):

| | Rival: Cooperate | Rival: Undercut |
|---|---|---|
| You: Cooperate | (10, 10) | (5, 13) |
| You: Undercut | (13, 5) | (6, 6) |

Because you face each other indefinitely — value a profit t days away at δ^t for some 0<δ<1 — can the two of you sustain the cooperative wide-spread outcome, and if so under what condition? What strategy would you play?

A single day of this game is a Prisoner's Dilemma. One day in isolation: whatever the rival does, Undercut beats Cooperate (13>10; 6>5), so Undercut is strictly dominant for both, and you each earn 6 even though both Cooperating pays 10.

Now add the future. A profit t days from now is worth δ^t today. Repetition opens the door to cooperation because a player who undercuts today can be punished tomorrow. Consider the grim-trigger strategy: "I cooperate every day, but the first time you undercut, I undercut forever after."

Use the one-shot-deviation principle. Cooperate forever earns R=10 every day: R/(1−δ). Undercut today earns temptation T=13 now, then both undercut forever at P=6: T + δP/(1−δ). Cooperation survives when:
R/(1−δ) ≥ T + δP/(1−δ)
⟹ R ≥ (1−δ)T + δP ⟹ δ ≥ (T−R)/(T−P)

Plugging in: (T−R)/(T−P) = (13−10)/(13−6) = 3/7 ≈ 0.43. So if each of you cares about tomorrow at least 43% as much as today, the wide-spread truce holds and you both pocket 10 a day; care less, and the quick undercut wins and you grind to 6.

But this question has no single answer even though the threshold is exact. The folk theorem says once δ clears the bar, cooperation is an equilibrium — but not the only one. "Both Undercut every day" is always an equilibrium too, as are countless partial patterns. Which outcome the desks settle into depends on history, trust, and beliefs the matrix doesn't contain.

Subtleties:
- **A known end date unravels everything:** with a definite final day, backward induction kills cooperation — the last day both undercut, making the second-to-last effectively final, cascading back. Indefinite repetition is essential.
- **Mistakes and forgiveness:** grim trigger is unforgiving; in a noisy market a forgiving rule like tit-for-tat (punish once, then return to cooperating) survives accidents better.

General grim-trigger threshold: δ* = (T−R)/(T−P) — the more tempting a one-day undercut, or the milder the punishment, the more patient players must be.

**Correct Answer: no single number** — one-shot both Undercut (6); repeated cooperation sustainable when δ ≥ 3/7 ≈ 0.43, but not guaranteed (folk theorem). Play grim trigger / tit-for-tat.

---

## Family: Volunteer's Dilemma

*Method: no pure equilibrium (each wants someone else to act) → symmetric mixed equilibrium via the indifference principle. Counterintuitively, more players makes collective failure more likely.*

### GT11 — Who Calls the Landlord
**Company:** Jane Street · **Difficulty:** Hard · **Concept:** Volunteer's Dilemma, symmetric mixed equilibrium, diffusion of responsibility

#### Condensed
**Q:** 4 tenants; any one call fixes the boiler (benefit 80 each); calling costs 10. Call net = 70, someone-else-calls = 80, nobody = 0. In the symmetric mixed equilibrium, P(nobody calls)?
**A:** Indifference: calling (70) = waiting (80·(1−(1−p)³)) → (1−p)³ = 1/8 → 1−p = 1/2 → p = 1/2. P(nobody calls) = (1−p)⁴ = (1/2)⁴ = 1/16 = **0.0625**. (More tenants → each calls less → freeze more likely: diffusion of responsibility.)

#### Verbatim
The boiler in your building gives out on a freezing winter night. There are 4 flats, and any single tenant can phone the landlord to get the heat back on. Once anyone makes that call the boiler is fixed for the whole building — a benefit worth 80 to each of you. But making the call is a hassle, costing the caller 10. So if you make the call, your net payoff is 80−10=70; if someone else makes it, you get the full 80 for nothing; and if nobody calls, everyone gets 0. All 4 tenants are rational, self-interested, and reason identically, each deciding independently and simultaneously whether to call. In the symmetric equilibrium where every tenant calls with the same probability, what is the probability that nobody calls and the whole building freezes? (Give a probability between 0 and 1, rounded to 4 decimals.)

This is the famous Volunteer's Dilemma. If you knew the other three would sit on their hands you would gladly call (70 beats 0); but if you knew even one would call you would rather wait and pocket 80. Your best move depends on the others, and since all four reason identically there is no stable pure outcome. The way out is a symmetric mixed-strategy equilibrium: every tenant calls with probability p, chosen so no one can do better by behaving differently.

The tool is the indifference principle. A tenant randomizes only if calling and waiting give the same expected payoff.
- Calling: fixes the boiler no matter what, sure net payoff 80 − 10 = 70.
- Waiting: worth 80 if at least one of the other three calls, 0 if all three stay silent. Compute the complement — all three silent — with probability (1−p)³. So P(at least one other calls) = 1 − (1−p)³, and waiting is worth 80(1 − (1−p)³).

Set calling equal to waiting: 70 = 80(1 − (1−p)³). Divide by 80: 1 − (1−p)³ = 7/8, so (1−p)³ = 1/8 ⟹ 1−p = 1/2 ⟹ p = 1/2. Each tenant calls with probability one half.

The building freezes only when all four stay silent: P(nobody calls) = (1−p)⁴ = (1/2)⁴ = 1/16 = 0.0625. Even though every tenant would happily pay the hassle rather than freeze, there is a 6.25% chance the boiler stays broken all night — because each is quietly hoping someone else picks up the phone.

The counterintuitive heart: a bigger building makes a freeze more likely, not less. For general N tenants with benefit b and cost c, indifference gives (1−p)^(N−1) = c/b, so 1−p = (c/b)^(1/(N−1)). As N grows the exponent shrinks, pushing 1−p toward 1 — each tenant calls less often, more confident someone else will. P(nobody calls) = (1−p)^N = (c/b)^(N/(N−1)), which climbs toward c/b = 1/8 = 0.125 as N→∞. More potential helpers make collective rescue less reliable — diffusion of responsibility as a mathematical fact, not just a psychological quirk (the bystander effect).

**Correct Answer: 0.0625**

---

*Last updated: 2026-07-21.*
