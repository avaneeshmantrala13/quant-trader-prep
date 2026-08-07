import type { Level } from "@/types/content";
import {
  AUCTION_NUMERIC_GENERATORS,
  AUCTION_QUIZ_GENERATORS,
} from "./generators";

const N = AUCTION_NUMERIC_GENERATORS;
const Q = AUCTION_QUIZ_GENERATORS;

/**
 * Winner's-Curse / Common-Value Auctions.
 *
 * A section of levels drilling the single most counter-intuitive idea in
 * auction theory: WINNING IS BAD NEWS. When a good has a common value V and you
 * bid off a noisy signal, you only win when your signal is the highest, which
 * systematically overstates V. These levels build from the conditional value
 * (acquiring a company), to the exact bid shade E[max of n signals], to the
 * +EV/−EV bid decision and how shading must grow with the number of bidders.
 *
 * NOTE: these `Level` objects are exported but NOT registered into any track —
 * the Integrator (or a T11 OA pool) wires them in. See the integration handoff.
 */
export const AUCTION_LEVELS: Level[] = [
  {
    id: "auc-1",
    title: "Acquiring a Company",
    subtitle: "Winning tells you the value is low",
    blurb:
      "The classic winner's-curse setup: when you win only if V ≤ your bid, the value conditional on winning is just b/2, half your bid.",
    difficulty: "medium",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: N.genAcquireEvGivenWin,
    questionCount: 5,
    lesson: {
      paragraphs: [
        "A firm's value V is unknown and uniform on {0, …, M}. The owner sells only when V ≤ your bid b, so WINNING is itself information: it tells you V landed in the low range {0, …, b}. Averaging those, E[V | you won] = b/2, only half of what you offered.",
        "This is the winner's curse in its purest form: conditioning on the event that your bid succeeded systematically lowers the expected value. Price the deal off E[V | win], never off the unconditional average M/2.",
      ],
      keyIdea: "E[V | V ≤ b] = b/2, condition on winning, not on the whole range.",
      whyInterviewers:
        "The 'acquiring a company' problem is a canonical desk interview test of conditional reasoning.",
      deepDive: {
        whyItWorks:
          "Winning is not a neutral event: it is the event that the value fell below your bid, which drags the conditional average down. The correct estimate averages only the outcomes consistent with winning.",
        approach: [
          "Write down which values of V would let your bid win.",
          "Restrict the value's distribution to exactly those winning outcomes.",
          "Take the mean over that restricted set, that is E[V | win].",
          "Compare it to the price you would pay, not to the unconditional average.",
        ],
        pitfalls: [
          "Valuing the deal at the unconditional average M/2 instead of conditioning on winning.",
          "Assuming winning means the value equals your bid rather than lies at or below it.",
          "An off-by-one on the range, {0, …, b} has b+1 integers and mean b/2, not (b+1)/2.",
        ],
      },
    },
  },
  {
    id: "auc-2",
    title: "How Much to Shade",
    subtitle: "Shade = E[max of n signals]",
    blurb:
      "With n bidders each seeing an unbiased signal, the exact bid shade equals the expected maximum of the n signals, positive, and growing with n.",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: N.genWinnersCurseShade,
    questionCount: 6,
    lesson: {
      paragraphs: [
        "Each of n bidders sees an unbiased signal V + ε. You win only with the highest signal, so conditional on winning your own noise behaves like the MAXIMUM of the n noises. Shade your bid below your signal by exactly E[max of n], the expected overstatement.",
        "For a single bidder the shade is zero (nobody to out-signal); it rises with every extra rival, because winning against more bidders is stronger evidence that your signal was inflated.",
      ],
      keyIdea: "Optimal shade = E[max of n signals]; it is 0 for n = 1 and rises with n.",
      whyInterviewers:
        "Turning 'winning is bad news' into an exact number is the quantitative heart of common-value bidding.",
      deepDive: {
        whyItWorks:
          "Conditioning on holding the highest of n independent signals makes your own signal an extreme order statistic, whose expected value exceeds the truth by the expected maximum of the noise. Subtracting that restores an unbiased estimate.",
        approach: [
          "Model the noise as a symmetric, mean-zero distribution around V.",
          "Recognize that winning means your signal is the maximum of the n draws.",
          "Compute the expected maximum of n such noises.",
          "Shade your bid down by that expected maximum.",
        ],
        pitfalls: [
          "Treating an unbiased signal as needing no correction, the bias appears only after conditioning on winning.",
          "Using a shade sized for fewer bidders and failing to grow it with n.",
          "Dividing the expected maximum by n instead of using the maximum itself.",
        ],
      },
    },
  },
  {
    id: "auc-3",
    title: "Value Conditional on Winning",
    subtitle: "E[V | win] = signal − shade",
    blurb:
      "Combine the two ideas: the value conditional on winning is your signal minus the winner's-curse shade E[max of n signals].",
    difficulty: "hard",
    mode: "numeric",
    masteryThreshold: 0.8,
    numericGenerator: N.genEvGivenWin,
    questionCount: 6,
    lesson: {
      paragraphs: [
        "Put the pieces together: your unbiased signal minus the expected overstatement gives E[V | you won] = signal − E[max of n]. This is strictly below your signal for two or more bidders, the winner's curse quantified.",
        "The mirror-image mistake is to ADD the correction (the loser's blessing) or to forget it entirely. Winning means your signal was too high, so the conditional value must come down.",
      ],
      keyIdea: "E[V | you won] = signal − E[max of n signals] < signal.",
      whyInterviewers:
        "Producing the conditional value on the spot separates traders who truly internalize adverse selection.",
      deepDive: {
        whyItWorks:
          "The signal is unbiased before you know whether you won, but the act of winning selects the high tail of your own noise. Subtracting the expected maximum of the noise removes exactly that selection bias.",
        approach: [
          "Start from your raw signal as the unconditional estimate of V.",
          "Identify the correction: the expected maximum of the n noises.",
          "Subtract it to obtain the estimate conditional on winning.",
          "Sanity-check that the result is below your signal and falls further as n grows.",
        ],
        pitfalls: [
          "Reporting the raw signal as the value.",
          "Adding the correction (the loser's blessing) instead of subtracting it.",
          "Using the correction for fewer bidders than actually compete.",
        ],
      },
    },
  },
  {
    id: "auc-4",
    title: "Bidding Decisions",
    subtitle: "+EV vs −EV, and shading with n",
    blurb:
      "Decide whether a bid is +EV conditional on winning, why the optimal bid falls as bidders are added, and when synergy beats the value-halving.",
    difficulty: "expert",
    masteryThreshold: 0.75,
    generator: Q.genBidEvDecision,
    questionCount: 8,
    lesson: {
      paragraphs: [
        "Every common-value bid reduces to one comparison: bid versus E[V | win]. A bid below the conditional value is +EV; a bid at or above it falls to the winner's curse. Comparing to your raw signal instead of E[V | win] is the classic flip.",
        "Two corollaries: the optimal bid must DROP as more rivals are added (E[max of n] grows), and in the acquiring-a-company frame a positive bid is +EV only when the synergy multiple exceeds 2×, enough to overcome E[V | win] = b/2.",
      ],
      keyIdea: "Compare the bid to E[V | win]; shade more as n grows; need synergy > 2×.",
      whyInterviewers:
        "This is the live decision a common-value market maker faces: quote below the conditional value or get picked off.",
      deepDive: {
        whyItWorks:
          "Winning is an adverse event, so the only defensible benchmark for a bid is the value conditional on winning. Because that benchmark falls with more competitors, and because the acquiring-a-company case halves the value, the profitable region is narrower than naive pricing suggests.",
        approach: [
          "Compute E[V | win] for the situation (signal minus shade, or b/2).",
          "Judge the bid +EV only if it is strictly below that conditional value.",
          "When rivals are added, lower the bid because the shade grows.",
          "In a synergy deal, require the multiple to exceed 2× before bidding positive.",
        ],
        pitfalls: [
          "Comparing the bid to the raw signal or the unconditional mean rather than E[V | win].",
          "Leaving the bid unchanged as the number of bidders rises.",
          "Believing any synergy above 1× justifies bidding when winning halves the value.",
        ],
      },
    },
  },
];
