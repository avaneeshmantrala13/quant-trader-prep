Owners
This section lists the primary authors and maintainers of the BrainLift.

* Moksh Shah

Purpose
The purpose of this BrainLift is to work out how to build a Quant-Interview Readiness Engine: a learning-science-native replacement for the drill-timer prep sites that dominate the space. I picked quant-trading interviews because they stress the exact skills a scoreboard cannot train. You have to transfer to games you have never seen, you have to be calibrated in probability, and you have to still remember any of it across a hiring funnel that runs for weeks. The incumbent tools (Tradermath, TraderIQ, Trading Interview) are all the same underneath: a question bank, a timer, and a leaderboard. The thing we ship is a measured pre/post gain on unseen transfer items in a pilot cohort, reported as an effect size with error bars against a comparison group. Not a bigger question bank, and not a slicker timer.

In Scope

* Diagnosing why a candidate keeps failing a class of interview problem (mental math, market-making, probability, Bayes) and routing them to the specific upstream skill that is actually broken.
* Designing a defensible mastery decision per topic (a credible-interval bound checked against an 80% bar, an adaptive diagnostic, and a real calibration measurement) instead of a single accuracy number.
* Designing the corrective loop that moves a candidate who is not yet fluent (worked-example fading, misconception-keyed feedback, elicit-then-confront), plus the pilot that measures whether the loop did anything.

Out of Scope

* Building a general-purpose quant tutor that tries to out-solve a frontier model on raw problem-solving.
* Claiming a learning gain from a naive pre/post design with no comparison group, or from accuracy on items the learner has already seen.
* Any result that is not preregistered and gradeable on a transfer-based evaluation harness, meaning unseen items rather than a retake of the practiced quiz.

DOK 4: Spiky Points of View (SPOVs)

* Spiky POV 1: The prep sites everyone uses are drill timers, and the entire "adaptivity" they sell is a difficulty slider.
   * Elaboration: Tradermath, TraderIQ, Trading Interview and Tradermaths are genuinely well-built, and they are genuinely the same tool wearing different skins. Configurable question sets, a stopwatch, right/wrong feedback, a leaderboard, and firm-specific replicas like the Optiver 80-in-8. Their own recommended method gives the game away. It says: start untimed, reach 90% accuracy, then turn up the timer. So the *learner* is the adaptive engine and the tool just holds the clock. That model optimizes the two metrics least predictive of a superday, which are time-on-task and accuracy on items you have already seen. Those also happen to be the two things a paywalled question-bank product can advertise at checkout. The pedagogy is invisible to the buyer, so nobody builds it. My design rule runs the other way: treat the difficulty slider as nearly trivial, and spend the whole engineering budget on the machinery a slider cannot fake, which is mastery estimation, retrieval scheduling, and correctives.
* Spiky POV 2: This is a prerequisite router with games bolted on top. A blown market-making quote is usually a broken upstream skill surfacing late.
   * Elaboration: Quant problems are cleanly hierarchical, and that is the whole opening. A wrong market-making width is very often an expected-value or edge-arithmetic error in disguise. A botched Bayes update is very often base-rate neglect or a conditioning slip in disguise. A slow 80-in-8 is very often shaky fraction-to-decimal fluency. So the highest-leverage thing I can build is a diagnosis that routes upstream, well before I build more market-making reps. When a candidate misprices a two-sided market, the right move is often to check whether they can compute the expected value at all, and if that fails, drop them to the prerequisite rather than re-explain a quoting heuristic they were never able to run. I model the domain as a prerequisite graph first (a DAG, where arrows run from each skill to the skills that depend on it, with no loops) and build the games second. The graph is the moat. ALEKS gets its advantage over a linear syllabus from knowledge-space theory for the same reason: it only ever tests the useful next thing.
* Spiky POV 3: The classic interview traps are lecture-resistant misconceptions, so "telling them the answer" is the one move guaranteed to fail.
   * Elaboration: Gambler's fallacy, base-rate neglect, the conjunction fallacy, ignoring conditioning. None of these are knowledge gaps you close by revealing the correct answer. Fischbein and Konold showed these probabilistic misconceptions are stable and survive being told they are wrong. So bare right/wrong feedback (d ≈ 0.05) is close to useless here, and it is exactly what every prep site ships. The corrective that actually works is representational and confrontational. Recast a Bayes item as natural frequencies ("8 of 1000..."), which roughly triples correct reasoning with zero extra teaching, and run an elicit-then-confront loop that makes the candidate commit to their gut answer and then watch a simulation's counts contradict it. My design rule: never just reveal. Name the trap, re-represent it, show a worked twin, simulate, and reveal only on the last rung, with a leak-checker so an earlier rung cannot spoil the answer.
* Spiky POV 4: Readiness is a calibration question, and no prep site measures the one skill that is literally the job.
   * Elaboration: Making a market means quoting a probability distribution and being held to it. Being 80%-confident and right 80% of the time is the actual deliverable of a trader. Yet every prep tool reports a single accuracy percentage and says nothing about calibration. So the object I have to defend is a reliability claim, not a score: when they say 80%, how often are they right, and how far below the 45-degree line do they sit? That is the CORP and Brier-decomposition machinery. A reliability diagram, an ECE-style gap, and a "confidently wrong" flag for topics where confidence outruns accuracy. A candidate can post high raw accuracy and still be dangerously miscalibrated, and that is the person who blows up on a market-making game. So calibration has to be a first-class metric, or the tool is measuring the wrong thing.
* Spiky POV 5: Ship the pilot as a transfer-measured decision system with error bars.
   * Elaboration: The prime directive is a number with confidence intervals, not a demo, and the trap is baked into this exact project. If I select weak candidates and re-test them, low scorers drift upward for purely statistical reasons. That is regression to the mean, and it hands me a gain even with zero instruction. A naive pre/post design is built to flatter me. The fixes are methodological. Use parallel test forms so the post-test is fresh, unseen items and I am not just measuring who memorized the practice set. Report a reliability so I can bound the artifact. And above all, build a comparison group, ideally a regression-discontinuity at the mastery cut, so near-identical candidates on either side of the line isolate the program effect from the selection effect. I anchor the outcome on transfer, meaning the learning has to show up on an unseen but related game, ideally on the real OA or superday, because a retake of the practiced quiz proves nothing. And a false "ready" (sending someone into a superday who was not ready) costs more than a false "not-ready," so I report the asymmetric error rates rather than a single headline accuracy.

Experts

* Expert 1
   * Who: Benjamin Bloom, educational psychologist, University of Chicago.
   * Focus: Mastery Learning and the "2 Sigma Problem," the finding that tutored students dramatically outperform classroom peers, and the search for group methods that get close.
   * Why Follow: Bloom is the founding result behind the mastery-over-scoreboard stance, and reading him directly is how I separated the 2σ tutoring claim from the roughly 1σ classroom claim that products quietly conflate (SPOV 1).
   * Where: "The 2 Sigma Problem" (1984), https://www.researchgate.net/publication/243775466 ; "Learning for Mastery" (1968).
* Expert 2
   * Who: Gerd Gigerenzer, psychologist, Max Planck Institute; with Efraim Fischbein and Clifford Konold.
   * Focus: Natural-frequency representations of Bayesian problems, and the stability of probabilistic misconceptions.
   * Why Follow: Gigerenzer supplies the representational fix (frequencies roughly triple correct reasoning) and Fischbein and Konold supply the reason bare feedback fails. Together they are the whole of SPOV 3.
   * Where: Gigerenzer & Hoffrage (1995), "How to Improve Bayesian Reasoning Without Instruction"; Fischbein & Schnarch (1997); Konold (1993).
* Expert 3
   * Who: Jean-Paul Doignon & Jean-Claude Falmagne, mathematical psychologists.
   * Focus: Knowledge Space Theory, the formal model of reachable knowledge states behind ALEKS.
   * Why Follow: Their framework is the backbone of the prerequisite-router argument (SPOV 2): only ever test the useful next thing, and let one diagnostic entail many downstream skills.
   * Where: Knowledge Spaces (1999); ALEKS, https://www.aleks.com
* Expert 4
   * Who: Tilmann Gneiting, Timo Dimitriadis & Alexander Jordan; with Valerie Shute.
   * Focus: Calibration and reliability diagrams (CORP and Brier decomposition), and elaborated formative feedback.
   * Why Follow: These are the references for measuring calibration properly and for feedback that changes the next action, which SPOVs 3 and 4 both lean on.
   * Where: Dimitriadis, Gneiting & Jordan (2021), "Stable reliability diagrams" (CORP); Shute (2008), "Focus on Formative Feedback."
* Expert 5
   * Who: Donald Campbell & David Kenny.
   * Focus: Regression artifacts and threats to internal validity in quasi-experimental designs.
   * Why Follow: Campbell & Kenny explain exactly why pre/post on a self-selected weak cohort is booby-trapped, which is the whole of SPOV 5.
   * Where: A Primer on Regression Artifacts (1999); Campbell & Stanley, Experimental and Quasi-Experimental Designs (1963).
* Expert 6
   * Who: John Sweller, Alexander Renkl & Slava Kalyuga.
   * Focus: Cognitive load, the worked-example effect, fading, and expertise reversal.
   * Why Follow: Their work is the mechanism for the corrective loop. Study before you solve, fade the scaffold, and pull support as skill grows because it starts to hurt experts. This underpins SPOV 1's "spend the budget on correctives."
   * Where: Sweller & Cooper (1985); Renkl & Atkinson (2003); Kalyuga et al. (2001), "The Expertise Reversal Effect."

DOK 3: Insights

* Insight 1: Bloom's celebrated 2σ and the roughly 0.5σ meta-analytic classroom effect are the same mechanism at different intensities, and the shared ingredient is the corrective loop rather than the delivery format. This is what lets me claim a product can capture most of the gain by copying the loop (formative check, then a corrective that changes the representation, then a re-test) and skipping the human tutor, while the prep sites keep the cheap gate and drop the loop entirely.
* Insight 2: In a hierarchical domain like quant, a current-topic error is usually a proxy for a broken prerequisite, so the scarce signal is which upstream node failed rather than how many market-making reps were missed. That makes diagnosis-that-routes-upstream higher leverage than more instruction on the surface game.
* Insight 3: Because the interview tests reasoning on games you have never seen, the tool's job is to build transferable structure rather than pile up accuracy on seen items. That reframes the deliverable from "a bigger question bank" to "parametric, unmemorizable games plus a mastery model you can actually read," and it makes transfer-to-unseen the metric that counts.
* Insight 4: Calibration and accuracy come apart, and calibration is the trading-relevant one. A candidate can be accurate and badly miscalibrated at the same time. That is what makes a reliability diagram and a "confidently wrong" flag non-optional, and it is the clearest thing every incumbent leaves on the table.
* Insight 5: The remedial, self-selected setting is the worst possible case for pre/post evaluation, because selecting weak candidates maximizes regression to the mean. The experimental design (comparison group, parallel and unseen forms, RDD at the mastery cut) is not academic polish. It is the only thing standing between the pilot and a fake win, and it ties Insights 3 and 4 into one auditable claim: a confusion matrix near the cut plus a transfer-anchored outcome, rather than a headline accuracy.

DOK 2: Knowledge Tree

* Category 1: Learning science
   * Subcategory 1.1: Mastery learning and correctives
      * Source 1: Bloom, "The 2 Sigma Problem" (1984)
         * DOK 1 - Facts:
            * One-to-one tutoring produced roughly a 2 standard deviation gain over conventional instruction.
            * Classroom Mastery Learning produced a smaller gain, commonly cited around 1σ; the meta-analytic average is nearer 0.5σ.
         * DOK 2 - Summary:
            * The 2σ figure is a tutoring result, not a classroom result, and the two get conflated all the time.
            * The reproducible ingredient across all three is a formative check followed by corrective instruction, before the student advances.
         * Link to source: https://www.researchgate.net/publication/243775466
      * Source 2: Sweller & Cooper (1985); Renkl & Atkinson (2003); Kalyuga et al. (2001)
         * DOK 1 - Facts:
            * Beginners learn more from studying worked examples than from solving equivalent problems (the worked-example effect).
            * Scaffolding that helps novices measurably hurts experts (expertise reversal), so support has to be faded on the mastery signal.
         * DOK 2 - Summary:
            * A "corrective" means changing the representation and studying a worked twin, rather than replaying the first exposure.
            * Fading has to be adaptive: re-scaffold on regression, and fade the misconception-critical step first.
         * Link to source: Renkl & Atkinson (2003), "Structuring the Transition From Example Study to Problem Solving."
   * Subcategory 1.2: Feedback and misconceptions
      * Source 3: Shute (2008); Van der Kleij et al. (2015); Fischbein & Schnarch (1997); Konold (1993)
         * DOK 1 - Facts:
            * Elaborated, misconception-keyed feedback runs d ≈ 0.49; bare knowledge-of-result runs d ≈ 0.05.
            * Probabilistic misconceptions (gambler's fallacy, base-rate neglect) are stable and survive being told the correct answer.
         * DOK 2 - Summary:
            * Feedback only pays off when it changes the next action, and revealing the answer is close to worthless for lecture-resistant errors.
            * The working counter is elicit-then-confront: commit to the intuition, then contradict it with a simulation. This is the link to SPOV 3.
         * Link to source: Shute (2008), "Focus on Formative Feedback," Review of Educational Research.
* Category 2: Representation and prerequisite structure
   * Subcategory 2.1: Natural frequencies
      * Source 4: Gigerenzer & Hoffrage (1995)
         * DOK 1 - Facts:
            * Recasting a Bayesian problem from probabilities to natural frequencies raised correct reasoning from about 16% to about 46%.
            * The swing comes from representation alone, with no additional instruction.
         * DOK 2 - Summary:
            * Bayes and conditional-probability items should be rendered as whole-count trees, with the final division left for the learner.
            * A roughly 3× gain from representation is cheaper and larger than most tutoring interventions, and no prep site uses it.
         * Link to source: Gigerenzer & Hoffrage (1995), Psychological Review.
   * Subcategory 2.2: Knowledge spaces and prerequisite graphs
      * Source 5: Doignon & Falmagne, Knowledge Spaces (1999); ALEKS
         * DOK 1 - Facts:
            * Knowledge Space Theory models a learner's knowledge as a set of mastered items, with feasible states and learning paths.
            * ALEKS uses this to select the next assessable item within a learner's "outer fringe."
         * DOK 2 - Summary:
            * A single diagnostic can entail mastery of many downstream items without testing each one.
            * This is what makes short adaptive diagnostics and upstream routing possible (SPOV 2).
         * Link to source: https://www.aleks.com
* Category 3: Measurement, mastery and calibration
   * Subcategory 3.1: Interpretable mastery estimation
      * Source 6: Pelánek (2016); Gervet et al. (2020); Johnson, Ott & Dogucu, Bayes Rules! (2022); Corbett & Anderson (1995)
         * DOK 1 - Facts:
            * In the small-data regime (few attempts per item), Elo/logistic and Beta-Binomial models match or beat deep knowledge-tracing.
            * Bayesian Knowledge Tracing estimates the probability a learner has mastered a specific skill.
         * DOK 2 - Summary:
            * Per-topic mastery should be an estimate with uncertainty (a credible interval checked against an 80% bar) that returns STRONG, WEAK, or UNCERTAIN, rather than one accuracy number.
            * Interpretability matters, because you can see why a node was judged weak, and both the corrective loop and the placement decision consume that.
         * Link to source: Pelánek (2016), "Applications of the Elo rating system in adaptive educational systems."
   * Subcategory 3.2: Calibration
      * Source 7: Dimitriadis, Gneiting & Jordan (2021), CORP reliability diagrams
         * DOK 1 - Facts:
            * A reliability diagram plots predicted confidence against observed frequency; the gap from the 45-degree line is the miscalibration.
            * The Brier score decomposes into reliability, resolution, and uncertainty terms.
         * DOK 2 - Summary:
            * Calibration is measurable independently of accuracy, so a candidate can be accurate and badly miscalibrated.
            * "Confidently wrong," where accuracy looks fine but the diagram sits below the diagonal, is the trading-relevant failure to surface (SPOV 4).
         * Link to source: Dimitriadis, Gneiting & Jordan (2021), PNAS.
* Category 4: Causal inference and evaluation
   * Subcategory 4.1: Regression artifacts and quasi-experimental design
      * Source 8: Campbell & Kenny (1999); Campbell & Stanley (1963); Imbens & Lemieux (RDD)
         * DOK 1 - Facts:
            * Regression to the mean scales with (1 − reliability) and with how extreme the selection was.
            * Regression-discontinuity identifies a program effect by comparing units just above versus just below a cutoff.
         * DOK 2 - Summary:
            * Selecting the weakest candidates maximizes the fake pre/post gain, so a comparison group is mandatory.
            * Parallel and unseen forms defend against teaching-to-the-test; RDD at the mastery cut defends against regression and maturation. Both are needed, because they cover different threats.
         * Link to source: Campbell & Kenny (1999), A Primer on Regression Artifacts.
   * Subcategory 4.2: Transfer, preregistration, and the incumbent baseline
      * Source 9: Rowland (2014); Sana & Yan (2022); competitor audit (Tradermath, TraderIQ, Trading Interview)
         * DOK 1 - Facts:
            * Retrieval practice runs g ≈ 0.50 across 159 comparisons; interleaved quizzing adds d ≈ 0.35 over blocked practice.
            * The incumbent prep sites ship configurable timed drills, right/wrong feedback, firm-specific replicas, and a leaderboard, with a user-set difficulty slider as their only adaptivity.
         * DOK 2 - Summary:
            * The primary outcome has to be a mastery gain on fresh, unseen transfer items (a retake of the practiced quiz proves nothing), reported as an effect size with confidence intervals against a comparison group.
            * The honest deliverable swaps a headline accuracy for the ready/not-ready confusion matrix near the cut, plus the downstream OA or superday outcome for the candidates actually placed.
         * Link to source: Rowland (2014), Psychological Bulletin; Sana & Yan (2022), https://pdf.retrievalpractice.org/spacing/InterleavedRetrievalPracticePromotesScienceLearning_SanaYan_2022.pdf ; Tradermath, https://www.tradermath.org/
