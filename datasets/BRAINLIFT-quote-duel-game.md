Owners
This section lists the primary authors and maintainers of the BrainLift.

* Moksh Shah

Purpose
The purpose of this BrainLift is to work out how to build Quote Duel: a live, head-to-head market-making game where the learner and an AI bot both post two-sided quotes on the same asset, customer flow routes to whoever shows the better price, and quoting too tight gets you picked off by informed flow. I picked this game because it is the closest thing our app has to a real superday format. Firms like Optiver and IMC run group market-making rounds where several candidates all quote one instrument at once and order flow goes to the best price, and the whole test is whether you can win that flow without getting run over. Every market-making game we already ship is round-based: deal, quote, resolve, move on. None of them puts the learner in a continuous, competitive market where the spread is a live decision under adverse selection and inventory risk at the same time. The thing we ship is a game where the two failure modes a real maker fears (winning flow you should have skipped, and holding inventory you cannot offload) are both visible on the screen while the clock runs. Quote Duel is that game, and this BrainLift is how we make its bot and its scoring faithful to the actual microstructure rather than a reskinned quiz.

In Scope

* Designing the bot as an informed-plus-noise counterparty so the spread the learner earns is genuinely eaten by adverse selection, the way a real book bleeds to traders who know more than the maker.
* Designing the flow-routing and scoring so the learner is graded on the two things a competitive maker is actually graded on: capturing spread when it is safe, and skewing or widening before informed flow arrives.
* Designing the live inventory and mark-to-market panel so the learner feels position risk build in real time, and building the debrief that names which of their fills were the picked-off ones.

Out of Scope

* Building a full limit-order-book simulator with queue priority, latency, and a real matching engine. The game teaches the maker's decision, so it abstracts the microsecond mechanics away.
* Modeling a superhuman high-frequency bot that wins by speed. The bot has an information edge the learner can reason about and defend against, so the game stays a thinking game.
* Claiming the game trains real trading P&L. The deliverable is that the learner can explain and defend a two-sided quote under adverse selection, measured on the game, and nothing beyond that.

DOK 4: Spiky Points of View (SPOVs)

* Spiky POV 1: The spread is not a fee you charge, it is insurance you sell against being wrong, and a game that does not have informed flow is teaching the learner to sell insurance to nobody.
   * Elaboration: Beginners think the bid-ask spread is how a market maker gets paid, like a commission. That framing is exactly why beginners blow up. Glosten and Milgrom showed the spread exists because some of the people trading with you know something you do not, and every time one of them lifts your offer or hits your bid, you lose. The spread is the premium you charge everyone to cover the losses to the few who are informed. A market-making game with no informed counterparty rewards tightening the spread to zero, which is the single most dangerous habit you can build, and it is what a naive round-based game accidentally teaches. So the design rule for Quote Duel is that the bot must sometimes know the next move before the learner does, and it must trade on that knowledge. The learner should be able to watch a tight quote get systematically picked off and feel the spread stop being free money. If the learner can win by quoting a one-tick spread, the game is broken.
* Spiky POV 2: Winning the flow is the losing move when the flow is informed, so the game has to make "I chose not to trade" a scorable, rewarded action.
   * Elaboration: The obvious way to score a competitive quoting game is volume: whoever wins more flow wins. That is backwards. In the Kyle model the informed trader hides inside the noise, so the flow that is easiest to win is often the flow that is about to hurt you. A maker who wins every trade against an informed counterparty goes broke fastest. The real skill is discrimination: quote tight and take size when the flow looks like noise, widen and skew away when it looks informed. So Quote Duel cannot reward raw fill count. It has to reward risk-adjusted capture, where declining to be the best price right before an informed move is worth points, and getting adversely selected costs points even though you "won" the trade. This is the hardest thing to communicate to a candidate and the thing a superday grader is actually watching for, which is why it has to be the spine of the scoring rather than a footnote.
* Spiky POV 3: Inventory is the second clock, and a maker who only watches price is already losing.
   * Elaboration: A maker's job is to be flat, or close to it, and to get paid for temporarily warehousing risk that someone else wanted off. Ho and Stoll, and later Avellaneda and Stoikov, formalized this: the price you are willing to quote is not the market mid, it is a reservation price that shifts against your own inventory, so when you are long you lower both quotes to encourage selling and discourage buying. Most learners quote symmetrically around the mid and let inventory pile up until a single adverse move wipes their session. Quote Duel has to surface inventory as a live, unavoidable pressure, with a mark-to-market that moves against a lopsided book every tick. The design consequence is that skewing quotes on inventory has to be a mechanic the learner can execute and see rewarded, because inventory management is half of market making and zero percent of the games we currently ship.
* Spiky POV 4: The bot should be transparent in mechanism and opaque in outcome, because a black-box opponent teaches nothing.
   * Elaboration: There is a temptation to make the AI bot as strong and mysterious as possible so the game feels hard. That produces frustration and no learning, because the learner cannot form a model of what beat them. The pedagogy here comes from deliberate practice: skill grows when a specific action gets specific, interpretable feedback. So the bot's rule has to be simple enough to state in one sentence (it trades in the direction of a private signal that leads price by a short horizon, and otherwise it makes a competing market), and the debrief has to attribute every loss to a cause the learner can act on next round. The learner should leave a session able to say "I got picked off four times because I did not widen when the tape sped up," which is a coachable sentence. A bot that just wins is a scoreboard, and we already argued scoreboards do not teach.
* Spiky POV 5: The honest deliverable is a debrief that separates skill from luck, because one session of a stochastic game proves nothing.
   * Elaboration: A single session of Quote Duel is mostly noise. The learner can quote perfectly and still lose to a bad draw of informed flow, or quote badly and get lucky. If the game reports only a P&L number, it is lying to the learner in the same way a naive accuracy score lies. So the deliverable is a decomposition: spread captured on noise flow, losses to adverse selection, losses to inventory, and the counterfactual of what a disciplined quoting policy would have earned on the same sequence. That lets the learner see whether their process was sound even when the result was red, which is the only feedback that transfers. Averaging over many sessions, the skill signal has to emerge from the luck, and the game should show that convergence rather than hide it behind a leaderboard.

Experts

* Expert 1
   * Who: Lawrence Glosten & Paul Milgrom, financial economists.
   * Focus: The adverse-selection theory of the bid-ask spread, where the spread compensates a market maker for trading against better-informed counterparties.
   * Why Follow: Glosten and Milgrom are the reason the spread exists at all in this game, and reading them directly is how the bot's informed-flow behavior stops being a gimmick and becomes the whole point (SPOV 1).
   * Where: Glosten & Milgrom (1985), "Bid, Ask and Transaction Prices in a Specialist Market with Heterogeneously Informed Traders," Journal of Financial Economics.
* Expert 2
   * Who: Albert S. Kyle, financial economist.
   * Focus: Continuous auctions with an informed trader hiding inside noise-trader flow, and price impact (the "Kyle lambda").
   * Why Follow: Kyle is the formal backbone of SPOV 2, that the easiest flow to win is often the flow that hurts you, because the informed trader is camouflaged in the noise.
   * Where: Kyle (1985), "Continuous Auctions and Insider Trading," Econometrica.
* Expert 3
   * Who: Thomas Ho & Hans Stoll, financial economists.
   * Focus: The inventory model of dealer behavior, where a maker shifts quotes to manage the risk of an unbalanced position.
   * Why Follow: Ho and Stoll are the origin of the reservation-price idea that drives SPOV 3, skew your quotes against your own inventory rather than around the market mid.
   * Where: Ho & Stoll (1981), "Optimal Dealer Pricing Under Transactions and Return Uncertainty," Journal of Financial Economics.
* Expert 4
   * Who: Marco Avellaneda & Sasha Stoikov, quantitative researchers.
   * Focus: Optimal market making under inventory risk, turning the reservation price and optimal spread into an implementable quoting rule.
   * Why Follow: Avellaneda and Stoikov give the modern, computable version of inventory-aware quoting that the game's skew mechanic and the bot's competing quotes are both built on (SPOV 3).
   * Where: Avellaneda & Stoikov (2008), "High-frequency trading in a limit order book," Quantitative Finance.
* Expert 5
   * Who: Sanford Grossman & Joseph Stiglitz, economists.
   * Focus: The impossibility of informationally efficient markets, why prices cannot fully reflect private information and why informed traders can profit.
   * Why Follow: Grossman and Stiglitz explain why the bot's information edge is real and durable rather than instantly arbitraged away, which is what makes the adverse-selection lesson honest (SPOV 1).
   * Where: Grossman & Stiglitz (1980), "On the Impossibility of Informationally Efficient Markets," American Economic Review.
* Expert 6
   * Who: K. Anders Ericsson, psychologist.
   * Focus: Deliberate practice, the finding that skill grows from focused repetition with specific, immediate, interpretable feedback.
   * Why Follow: Ericsson is the reason the bot has to be transparent in mechanism and the debrief has to attribute each loss to a cause, so the game trains rather than just tests (SPOV 4).
   * Where: Ericsson, Krampe & Tesch-Römer (1993), "The Role of Deliberate Practice in the Acquisition of Expert Performance," Psychological Review.

DOK 3: Insights

* Insight 1: The spread and adverse selection are two sides of one coin, so the bot's information edge is not a difficulty setting, it is the mechanism that makes the whole game mean anything. Once the bot trades on a short-horizon signal, tightening the spread stops being free and the learner has to price the risk of being informed against, which is the exact judgment a superday round is testing.
* Insight 2: Volume and profit point in opposite directions when flow is informed, which is why the scoring has to reward discrimination rather than fills. The learner who wins the most trades against an informed bot loses the most money, so "chose not to be best price" has to be a first-class, rewarded action or the game teaches the wrong reflex.
* Insight 3: Inventory is a second, independent source of loss that runs on its own clock, so a faithful game needs a live mark-to-market and a skew mechanic. A learner can quote every spread correctly and still be wiped by a position they let grow, which means inventory-aware quoting has to be built in rather than mentioned.
* Insight 4: A game only teaches when the opponent is legible, so the bot's one-sentence rule and the loss-attribution debrief are the pedagogy, not the packaging. The learner has to leave with a coachable sentence about what beat them, which a black-box opponent can never provide.
* Insight 5: A single session of a stochastic market is dominated by luck, so the honest deliverable is a skill-versus-luck decomposition rather than a P&L headline. Separating spread captured, losses to adverse selection, and losses to inventory lets the learner see a sound process behind a red result, and that separation is the only feedback that transfers to the real round.

DOK 2: Knowledge Tree

* Category 1: Market microstructure and the spread
   * Subcategory 1.1: Adverse selection
      * Source 1: Glosten & Milgrom (1985)
         * DOK 1 - Facts:
            * The bid-ask spread arises because some counterparties are better informed than the market maker.
            * Each trade against an informed counterparty moves the maker's expectation, so quotes update after every fill.
         * DOK 2 - Summary:
            * The spread is compensation for expected losses to informed flow, so it cannot be driven to zero without the maker going broke.
            * A market-making game is only honest if some of its flow carries information the maker does not have. This is the link to SPOV 1.
         * Link to source: Glosten & Milgrom (1985), Journal of Financial Economics.
      * Source 2: Grossman & Stiglitz (1980)
         * DOK 1 - Facts:
            * If prices reflected all private information, no one would be paid to gather it, so markets cannot be perfectly efficient.
            * Informed traders earn a return that compensates them for the cost of their information.
         * DOK 2 - Summary:
            * The bot's information edge is durable rather than instantly arbitraged, which is what keeps adverse selection a live threat in the game.
            * This grounds why declining informed flow is a permanent skill and not a temporary quirk of one scenario.
         * Link to source: Grossman & Stiglitz (1980), American Economic Review.
   * Subcategory 1.2: Informed trading and price impact
      * Source 3: Kyle (1985)
         * DOK 1 - Facts:
            * An informed trader disguises their order inside the flow of uninformed noise traders.
            * Price impact per unit of order flow is summarized by a single sensitivity, the Kyle lambda.
         * DOK 2 - Summary:
            * The flow that is easiest to win is often the flow that is about to move against you, because the informed order is camouflaged.
            * Scoring a competitive quoting game on volume rewards exactly the wrong behavior. This is the link to SPOV 2.
         * Link to source: Kyle (1985), Econometrica.
* Category 2: Inventory and optimal quoting
   * Subcategory 2.1: The inventory model
      * Source 4: Ho & Stoll (1981)
         * DOK 1 - Facts:
            * A dealer holding an unbalanced position faces risk that is separate from adverse selection.
            * The dealer shifts quotes away from a lopsided inventory rather than quoting symmetrically around the mid.
         * DOK 2 - Summary:
            * The price a maker will quote is a reservation price that depends on their own position, not the market mid alone.
            * Inventory is a second source of loss on its own clock, which the game has to surface live. This is the link to SPOV 3.
         * Link to source: Ho & Stoll (1981), Journal of Financial Economics.
      * Source 5: Avellaneda & Stoikov (2008)
         * DOK 1 - Facts:
            * The reservation price shifts linearly with inventory and risk aversion over the remaining horizon.
            * The optimal spread widens with volatility and with the time left in the session.
         * DOK 2 - Summary:
            * Inventory-aware skewing can be turned into a concrete quoting rule, which the game uses for both the skew mechanic and the bot's competing market.
            * The same rule that scores the learner's discipline defines a sensible baseline policy to compare against.
         * Link to source: Avellaneda & Stoikov (2008), Quantitative Finance.
* Category 3: Learning design for the game
   * Subcategory 3.1: Deliberate practice and feedback
      * Source 6: Ericsson, Krampe & Tesch-Römer (1993)
         * DOK 1 - Facts:
            * Expert performance grows from focused repetition with immediate, specific feedback on a well-defined task.
            * Practice without interpretable feedback produces little improvement even at high volume.
         * DOK 2 - Summary:
            * The bot's rule must be legible and the debrief must attribute each loss to a cause the learner can act on. This is the link to SPOV 4.
            * A skill-versus-luck decomposition over many sessions is what lets the learner see a sound process behind a noisy result. This is the link to SPOV 5.
         * Link to source: Ericsson, Krampe & Tesch-Römer (1993), Psychological Review.
