/**
 * seedSyntheticStudent.ts — build a realistic demo ProgressState for the backend
 * demo account `synthetic_student` and (optionally) persist it to DynamoDB in the
 * EXACT shape the app reads on sign-in.
 *
 * WHY THIS EXISTS
 * The product owner wants a real Cognito account that shows a populated
 * dashboard / skill progress / mastery / roadmap / calibration on any device.
 * Rather than hand-craft a progress blob (brittle + schema-drift-prone), this
 * script drives the ACTUAL mastery engine — `applyItemAttempt` (the pure fold
 * behind `ProgressContext.recordItemAttempt`) — over many simulated graded
 * attempts across the real `SKILL_GRAPH` topics, at mixed accuracy so mastery
 * varies per topic. The result is a schema-correct `UserProgress` (version 4).
 *
 * HOW THE FOLD IS DRIVEN
 * `ProgressContext.recordItemAttempt` is a thin wrapper: it calls
 * `applyItemAttempt(prevMastery, tierD, attempt, dExposures, glickoPrev)` and
 * writes the returned {mastery, tierD, glicko} back into
 * `topicMastery` / `tierDifficulty` (+ the `#n` exposure companion) /
 * `glickoDifficulty`, keyed via `tierDifficultyKey` / `tierExposureKey`. We
 * replicate that exact bookkeeping here, so the engine — not this script — owns
 * every θ/α/β/Glicko/IRT number. If the progress schema grows a new field
 * (e.g. per-topic "repeated mistake" tracking), re-running this script picks it
 * up automatically because it goes through the real engine + `emptyProgress()`.
 *
 * PERSISTENCE SHAPE (must match `src/lib/awsStorage.ts`)
 * The client keys the DynamoDB item by `userId = <Cognito Identity Pool
 * identityId>` (NOT the username or the user-pool `sub`) and stores the whole
 * blob under a `progress` attribute (see `AwsStorageProvider.flushSave` /
 * `hydrateAfterAuth`). We write `{ userId, sub?, progress, updatedAt }` with the
 * same `removeUndefinedValues` marshalling.
 *
 * RUN
 *   # generate + write JSON only (no AWS):
 *   npx vite-node scripts/seedSyntheticStudent.ts
 *   # generate + PutItem into DynamoDB for the demo account:
 *   AWS_PROFILE=sbsandbox npx vite-node scripts/seedSyntheticStudent.ts -- \
 *     --put --identity-id us-east-1:XXXX --table quant-trader-prep-progress \
 *     --region us-east-1 --sub <cognito-sub>
 *
 * NON-DESTRUCTIVE: reads content/engine modules only; the sole side effects are
 * writing the local JSON snapshot and (with --put) a single DynamoDB PutItem for
 * this one account's row.
 */
import { TRACKS } from "@/content";
import { emptyProgress, type LevelProgress, type UserProgress } from "@/types/progress";
import { applyItemAttempt } from "@/lib/mastery/mastery";
import {
  misconceptionKey,
  tierDifficultyKey,
  tierExposureKey,
  topicKeyForLevel,
  topicKeyOf,
} from "@/lib/mastery/topicKey";
import { SKILL_GRAPH } from "@/lib/roadmap/skillGraph";
import type { ItemAttempt, TopicMastery } from "@/types/mastery";
import type { Difficulty } from "@/types/content";
import { FLOOR_TOPIC_KEY } from "@/lib/tradingFloor/config";
import {
  applyReview,
  emptySrsStore,
  getSrsCard,
  type SrsGrade,
} from "@/lib/srs/store";
import { deckCardIds } from "@/lib/srs/deck";

/**
 * REAL, canonical misconception tags per seeded topic (values of `MISCONCEPTION`
 * that resolve to a specific dashboard label). Wrong answers bump one of these
 * so the demo's "Where you struggle" shows SPECIFIC, actionable mistakes instead
 * of the old placeholder `err_1/2/3` (which fell through to a bare topic
 * restatement). Topics deliberately LEFT OUT (brainteasers, Brownian Motion)
 * carry no tag, so the dashboard exercises the concrete sub-skill fallback.
 */
const TOPIC_MISCONCEPTION_TAGS: Record<string, string[]> = {
  "mental-math::_core": ["off_by_carry", "place_value_slip", "percent_as_whole"],
  "math-questions::Rates, Algebra & Word Problems": [
    "swapped_operands",
    "percent_as_whole",
    "operation_confused",
  ],
  "math-questions::Number Theory & Counting": [
    "ignored_repeats",
    "off_by_one",
    "included_self_pairs",
  ],
  "math-questions::Geometry & Derivations": [
    "dropped_third_dimension",
    "squares_not_rectangles",
  ],
  "probability::Combinatorial Analysis": [
    "ordered_vs_unordered",
    "forgot_binomial_coefficient",
    "naive_product",
  ],
  "probability::Core Probability": [
    "or_means_add_no_overlap",
    "and_means_add",
    "complement_confusion",
  ],
  "probability::Conditional Probability": [
    "reversed_conditional",
    "base_rate_neglect",
    "ignored_conditioning",
  ],
  "probability::Expected Value": [
    "ignored_loss_branch",
    "summed_payouts_no_weight",
    "best_case_only",
  ],
  "probability::Conditional Expectation": [
    "unconditional_joint",
    "weighted_by_win_not_loss",
  ],
  "probability::Variance, Covariance & the CLT": [
    "added_sds_not_variances",
    "subtracted_variances",
    "reported_variance_not_sd",
  ],
  "probability::Continuous Distributions": [
    "mean_squared_not_second_moment",
    "forgot_sqrt",
  ],
  "probability::Betting & Sizing": ["odds_ratio_as_prob", "odds_direction_flipped"],
  "probability::Poisson Distribution & Process": [
    "wrong_lambda_power",
    "forgot_factor_two_exp",
  ],
  "probability::Order Statistics": ["single_die_mean", "top_face_only"],
  "probability::Geometric Probability": [
    "false_symmetry_thirds",
    "double_counted_excluded_region",
  ],
  "probability::Markov Chains": [
    "pattern_race_naive_half",
    "single_symbol_wait_only",
    "ruin_symmetric_fair",
  ],
  "probability::Game Theory & Puzzles": [
    "naive_participation_half",
    "reported_value_not_argmax",
    "corner_always_participate",
  ],
  "interview-games::_core": [
    "ignored_option_value",
    "suboptimal_threshold",
    "max_not_mean",
  ],
};

// --------------------------------------------------------------------------
// Deterministic RNG (mulberry32) so re-runs produce the SAME demo history.
// --------------------------------------------------------------------------
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(0xC0FFEE);

// --------------------------------------------------------------------------
// Per-topic seeding plan. Each category = (target accuracy, #graded attempts,
// fraction of the topic's levels to mark mastered). Accuracy + volume together
// drive whether the Beta CI-low clears the 0.8 confident-mastery bar.
// --------------------------------------------------------------------------
interface Category {
  name: string;
  acc: number; // target fraction correct
  n: number; // graded attempts to simulate
  levelFrac: number; // fraction of topic's levels to mark mastered
}
const CATS = {
  mastered: { name: "mastered", acc: 0.96, n: 60, levelFrac: 1.0 },
  strong: { name: "strong (mastered)", acc: 0.96, n: 75, levelFrac: 1.0 },
  unlockedMid: { name: "unlocked / in-progress", acc: 0.75, n: 22, levelFrac: 0.5 },
  mid: { name: "in-progress", acc: 0.66, n: 22, levelFrac: 0.4 },
  lowMid: { name: "in-progress (low)", acc: 0.55, n: 16, levelFrac: 0.25 },
  low: { name: "struggling", acc: 0.42, n: 12, levelFrac: 0.15 },
} satisfies Record<string, Category>;

/** topicKey -> category. Untouched graph nodes stay locked/available. */
const PLAN: Record<string, Category> = {};
const K = (trackId: string, section?: string) =>
  section ? `${trackId}::${section}` : `${trackId}::_core`;

// Foundations + early probability: confidently mastered.
PLAN[K("mental-math")] = CATS.mastered;
PLAN[K("math-questions", "Rates, Algebra & Word Problems")] = CATS.mastered;
PLAN[K("probability", "Combinatorial Analysis")] = CATS.mastered;
PLAN[K("probability", "Core Probability")] = CATS.mastered;
PLAN[K("probability", "Conditional Probability")] = CATS.mastered;
// High-value applied topics: strongly mastered (higher volume).
PLAN[K("probability", "Expected Value")] = CATS.strong;
PLAN[K("interview-games")] = CATS.strong;
// Geometric Probability: confidently mastered for the demo (the roadmap KST
// node renders GREEN and its levels complete). Kept high-volume so its Beta
// CI-low clears the 0.8 confident-mastery bar.
PLAN[K("probability", "Geometric Probability")] = CATS.mastered;
// Mid-course: unlocked but not yet confidently mastered.
PLAN[K("probability", "Conditional Expectation")] = CATS.unlockedMid;
PLAN[K("probability", "Variance, Covariance & the CLT")] = CATS.unlockedMid;
PLAN[K("probability", "Continuous Distributions")] = CATS.unlockedMid;
PLAN[K("probability", "Betting & Sizing")] = CATS.unlockedMid;
// In-progress, weaker.
PLAN[K("math-questions", "Number Theory & Counting")] = CATS.mid;
PLAN[K("brainteasers", "Core Puzzles")] = CATS.mid;
PLAN[K("probability", "Poisson Distribution & Process")] = CATS.mid;
// Low-mid.
PLAN[K("probability", "Order Statistics")] = CATS.lowMid;
PLAN[K("probability", "Markov Chains")] = CATS.lowMid;
// Struggling (visible weak spots for the demo).
PLAN[K("probability", "Game Theory & Puzzles")] = CATS.low;
PLAN[K("math-questions", "Geometry & Derivations")] = CATS.low;
PLAN[K("probability", "Brownian Motion")] = CATS.low;
// Everything else in the graph (MGF/Gamma/Joint/Limit Theorems/Branching/CTMC/
// Markov Structure/Techniques Toolkit + external drills) is left UNTOUCHED so
// the roadmap shows genuine locked/available frontier states.

// --------------------------------------------------------------------------
// Timeline: spread attempts over the last ~8 weeks.
// --------------------------------------------------------------------------
const NOW = Date.now();
const DAY = 86_400_000;
const CREATED_AT = new Date(NOW - 60 * DAY).toISOString();
let cursor = NOW - 56 * DAY; // advancing timestamp for attempts
function nextAt(): string {
  // ~ up to 3 hours between graded items, clustered into study days.
  cursor += Math.floor(rand() * 3 * 3_600_000) + 5 * 60_000;
  if (cursor > NOW) cursor = NOW - Math.floor(rand() * DAY);
  return new Date(cursor).toISOString();
}

// Difficulty ladder used as the learner climbs within a topic.
const TIERS: Difficulty[] = ["intro", "easy", "medium", "hard"];

// --------------------------------------------------------------------------
// Build the ProgressState by driving the real engine.
// --------------------------------------------------------------------------
const progress: UserProgress = emptyProgress();
progress.createdAt = CREATED_AT;
progress.goalMode = "interview";
const tm = (progress.topicMastery ??= {});
const td = (progress.tierDifficulty ??= {});
const gd = (progress.glickoDifficulty ??= {});

const calibrationLog: NonNullable<UserProgress["calibrationLog"]> = [];

/** Fold ONE graded item exactly like ProgressContext.recordItemAttempt. */
function recordItemAttempt(a: ItemAttempt): TopicMastery {
  const dKey = tierDifficultyKey(a.topicKey, a.tier);
  const expKey = tierExposureKey(a.topicKey, a.tier);
  const prevMastery = tm[a.topicKey];
  const dExposures = td[expKey] ?? 0;
  const { mastery, tierD, glicko } = applyItemAttempt(
    prevMastery,
    td[dKey],
    a,
    dExposures,
    gd[dKey],
  );
  tm[a.topicKey] = mastery;
  td[dKey] = tierD;
  td[expKey] = dExposures + 1;
  gd[dKey] = glicko;
  return mastery;
}

interface TopicSummary {
  topicKey: string;
  category: string;
  attempts: number;
  correct: number;
}
const summaries: TopicSummary[] = [];

for (const node of SKILL_GRAPH) {
  const cat = PLAN[node.topicKey];
  if (!cat) continue; // untouched -> stays a fresh/locked node

  let correct = 0;
  for (let i = 0; i < cat.n; i++) {
    // Climb the difficulty ladder as attempts accrue (early=intro, later=hard).
    const tier = TIERS[Math.min(TIERS.length - 1, Math.floor((i / cat.n) * TIERS.length))];
    const isCorrect = rand() < cat.acc;
    if (isCorrect) correct++;
    const at = nextAt();
    // On a wrong answer, bump a REAL canonical misconception tag for this topic
    // (if mapped) so the dashboard shows a SPECIFIC mistake. Unmapped topics
    // carry none → they exercise the concrete sub-skill fallback.
    const tags = TOPIC_MISCONCEPTION_TAGS[node.topicKey];
    const misconceptions =
      isCorrect || !tags
        ? undefined
        : [misconceptionKey(node.topicKey, tags[Math.floor(rand() * tags.length)])];
    recordItemAttempt({
      topicKey: node.topicKey,
      tier,
      correct: isCorrect,
      mode: "quiz",
      kOptions: 4,
      misconceptions,
      at,
    });
    // NOTE: quiz/numeric attempts do NOT elicit a stated confidence (the app's
    // reliability panel is fed the mastery MODEL's predictSuccess there, which
    // FIX 2 excludes as dishonest). Genuine elicited-confidence pairs are seeded
    // below from the Estimation (90% CI) + Trading-Floor drills only.
  }
  summaries.push({ topicKey: node.topicKey, category: cat.name, attempts: cat.n, correct });
}
// --------------------------------------------------------------------------
// GENUINE ELICITED-CONFIDENCE pairs (FIX 2). The reliability panel must only
// reflect surfaces where the learner ACTUALLY STATED a confidence:
//   • Estimation warm-ups — commit a 90% CI; the pair is (0.9, hit?).
//   • Trading Floor — quote a probability/price; the pair is (price, outcome).
// The demo learner is modelled as mildly OVER-confident on their intervals
// (90% CIs contain the truth only ~82% of the time) and roughly calibrated on
// their floor quotes — enough real pairs to clear the sufficiency gate.
// --------------------------------------------------------------------------
const FERMI_KEY = topicKeyOf("fermi");
for (let i = 0; i < 44; i++) {
  calibrationLog.push({
    topicKey: FERMI_KEY,
    pred: 0.9,
    outcome: rand() < 0.82 ? 1 : 0,
    at: nextAt(),
  });
}
// Floor quotes across confidence bands; outcome frequency tracks the stated
// price (well-calibrated), with the ~80% band populated for the headline read.
const FLOOR_BANDS = [0.6, 0.7, 0.8, 0.8, 0.85];
for (let i = 0; i < 40; i++) {
  const pred = FLOOR_BANDS[i % FLOOR_BANDS.length];
  calibrationLog.push({
    topicKey: FLOOR_TOPIC_KEY,
    pred,
    outcome: rand() < pred ? 1 : 0,
    at: nextAt(),
  });
}

// Cap the calibration log the same way the app does (keep the most recent 200).
progress.calibrationLog = calibrationLog.slice(-200);

// --------------------------------------------------------------------------
// levelProgress + XP + streak. Walk the real catalog so level ids are real,
// mark a contiguous prefix of each topic's levels mastered per the category.
// XP mirrors ProgressContext.recordAttempt: round(bestScore*100) + 50 (mastery).
// --------------------------------------------------------------------------
let xp = 0;
let masteredLevels = 0;
for (const track of TRACKS) {
  // Group contiguous levels by topic so we can master a prefix per topic.
  const byTopic = new Map<string, { idx: number; id: string }[]>();
  track.levels.forEach((lvl, idx) => {
    const key = topicKeyForLevel(track.id, lvl);
    const arr = byTopic.get(key) ?? [];
    arr.push({ idx, id: lvl.id });
    byTopic.set(key, arr);
  });
  for (const [topicKey, levels] of byTopic) {
    const cat = PLAN[topicKey];
    if (!cat) continue;
    const nMaster = Math.round(levels.length * cat.levelFrac);
    for (let i = 0; i < levels.length; i++) {
      if (i >= nMaster) break;
      // bestScore drawn around the topic's accuracy, clamped to a passing band.
      const bestScore = Number(
        Math.max(0.8, Math.min(1, cat.acc + (rand() - 0.4) * 0.12)).toFixed(3),
      );
      const attempts = 1 + Math.floor(rand() * 3);
      const completedAt = new Date(
        NOW - Math.floor(rand() * 50 * DAY) - DAY,
      ).toISOString();
      const lp: LevelProgress = {
        bestScore,
        mastered: true,
        attempts,
        completedAt,
      };
      progress.levelProgress[levels[i].id] = lp;
      xp += Math.round(bestScore * 100) + 50;
      masteredLevels++;
    }
  }
}
progress.xp = xp;
progress.streak = 9;
progress.lastActiveDate = new Date(NOW).toISOString().slice(0, 10);

// --------------------------------------------------------------------------
// FIX 1: seed the two spaced-review surfaces so they actually populate for the
// demo account. Both are wired to genuine activity (the topic scheduler runs on
// lesson-finish; the flashcard store updates from the /review session) but were
// never seeded here, so the demo showed them empty.
// --------------------------------------------------------------------------
// (a) Topic-level SM-2 resurfacing → the dashboard "Due for Review" list. In the
// app this is written by the lesson-finish scheduler; we set it directly on a
// few already-mastered topics so some are due NOW and some are upcoming.
const REVIEW_SEED: [string, number, number][] = [
  // [topicKey, daysFromNow (negative = overdue → due now), SM-2 ladder step]
  ["mental-math::_core", -2, 3],
  ["probability::Core Probability", -1, 2],
  ["probability::Combinatorial Analysis", 0, 2],
  ["probability::Expected Value", 4, 3],
  ["probability::Conditional Probability", 9, 2],
];
for (const [topicKey, days, step] of REVIEW_SEED) {
  const m = tm[topicKey];
  if (!m) continue;
  m.reviewDue = new Date(NOW + days * DAY).toISOString();
  m.reviewStep = step;
}

// (b) Flashcard SRS store → the "Fact-Core Review" panel. Drive the REAL srs
// engine over the interview (fact-core) deck: review a chunk of cards several
// times (spaced) so the panel shows genuine Reviewed / Graduated counts, while
// the rest of the deck stays new-and-due.
let srs = emptySrsStore();
const factIds = deckCardIds("interview");
for (let i = 0; i < Math.min(46, factIds.length); i++) {
  const id = factIds[i];
  let t = NOW - 30 * DAY;
  const passes = 3 + Math.floor(rand() * 3); // 3–5 spaced reviews
  for (let r = 0; r < passes; r++) {
    const grade: SrsGrade = rand() < 0.85 ? 4 : 2; // mostly good, occasional lapse
    srs = applyReview(srs, id, grade, t);
    const card = getSrsCard(srs, id);
    // Review again when the card next comes due (cap at yesterday so we keep a
    // realistic mix of due-now vs scheduled-ahead across the deck).
    t = card ? Math.min(card.dueAtMs, NOW - DAY) : t + DAY;
  }
}
progress.srs = srs;

// --------------------------------------------------------------------------
// Diagnostic history (improving over time) + one-time UI flags.
// --------------------------------------------------------------------------
progress.diagnosticDoneAt = new Date(NOW - 55 * DAY).toISOString();
progress.onboardingTourDoneAt = new Date(NOW - 59 * DAY).toISOString();
progress.diagnosticHistory = [
  { at: new Date(NOW - 55 * DAY).toISOString(), overallScore: 0.52, itemsAnswered: 24 },
  { at: new Date(NOW - 30 * DAY).toISOString(), overallScore: 0.66, itemsAnswered: 24 },
  { at: new Date(NOW - 7 * DAY).toISOString(), overallScore: 0.79, itemsAnswered: 24 },
];

// --------------------------------------------------------------------------
// Report + write JSON snapshot.
// --------------------------------------------------------------------------
const { betaMeanCI } = await import("@/lib/mastery/beta");
console.log("\n=== Seeded topic distribution (engine output) ===");
console.log(
  ["topicKey".padEnd(52), "category".padEnd(22), "n", "mean", "ciLow", "mastered"].join("  "),
);
for (const s of summaries) {
  const m = tm[s.topicKey];
  const { mean, lo } = betaMeanCI(m.alpha, m.beta);
  console.log(
    [
      s.topicKey.padEnd(52),
      s.category.padEnd(22),
      String(m.n).padStart(2),
      mean.toFixed(2),
      lo.toFixed(2),
      lo >= 0.8 ? "YES" : "no",
    ].join("  "),
  );
}
console.log(
  `\nTotals: ${summaries.length} topics seeded, ${masteredLevels} levels mastered, xp=${progress.xp}, streak=${progress.streak}`,
);
const reviewDueTopics = Object.values(tm).filter((m) => m.reviewDue).length;
const elicited = (progress.calibrationLog ?? []).filter(
  (p) => p.topicKey === FLOOR_TOPIC_KEY || p.topicKey === topicKeyOf("fermi"),
).length;
console.log(
  `calibration pairs: ${progress.calibrationLog?.length} (elicited-confidence: ${elicited}), diagnostics: ${progress.diagnosticHistory?.length}`,
);
console.log(
  `SRS: ${progress.srs?.reviews ?? 0} reviews across ${Object.keys(progress.srs?.cards ?? {}).length} cards; topic reviews due seeded on ${reviewDueTopics} topics`,
);

// Parse minimal CLI args.
const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : undefined;
};
const shouldPut = argv.includes("--put");
const outPath = arg("out") ?? "scripts/synthetic_student.progress.json";

const fs = await import("node:fs");
fs.writeFileSync(outPath, JSON.stringify(progress, null, 2));
console.log(`\nWrote ProgressState -> ${outPath}`);

if (shouldPut) {
  const identityId = arg("identity-id");
  const table = arg("table") ?? "quant-trader-prep-progress";
  const region = arg("region") ?? "us-east-1";
  const sub = arg("sub");
  if (!identityId) throw new Error("--put requires --identity-id <cognito identityId>");

  const { DynamoDBClient } = await import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, PutCommand } = await import("@aws-sdk/lib-dynamodb");
  const ddb = new DynamoDBClient({ region });
  const doc = DynamoDBDocumentClient.from(ddb, {
    marshallOptions: { removeUndefinedValues: true },
  });
  await doc.send(
    new PutCommand({
      TableName: table,
      Item: {
        userId: identityId, // partition key the client reads (see awsStorage.ts)
        sub, // dropped when undefined (removeUndefinedValues)
        progress,
        updatedAt: new Date().toISOString(),
      },
    }),
  );
  console.log(
    `\nPutItem OK -> table=${table} userId=${identityId}${sub ? ` sub=${sub}` : ""}`,
  );
}
