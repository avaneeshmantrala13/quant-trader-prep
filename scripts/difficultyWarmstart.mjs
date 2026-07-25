#!/usr/bin/env node
/**
 * difficultyWarmstart.mjs — OPTIONAL, EXPERIMENTAL offline template→difficulty
 * warm-start for the Elo tier-difficulty seeds (PHASE_7 §3/§5).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * STATUS: build-time only, PURE, and DEFERRED (not wired into the app runtime).
 * ────────────────────────────────────────────────────────────────────────────
 * What it does: maps a generator TEMPLATE + its parameter-range hand-features to
 * a predicted difficulty on the SAME logit scale as `TIER_SEED` (elo config), and
 * emits a `TierDifficultyMap`-shaped JSON (`{ "<topicKey>#<tier>": <logit-d> }`)
 * that Phase 1's `seedTierDifficulty` COULD consume as a warmer prior than the
 * fixed per-tier seed. It runs OFFLINE at build time — there is NO per-request
 * inference — and it degrades into ordinary Elo the moment real answers arrive
 * (Phase 1's `updateElo` overrides the seed as `n` grows).
 *
 * Why it's deferred (COORDINATION §4 ownership): actually FEEDING this JSON into
 * the seed path means editing Phase-1-owned `src/lib/mastery/**`, which Phase 7
 * must not touch during a parallel run. So this script only PRODUCES the artifact;
 * wiring it in is a small, safe Phase-1 follow-up. Enable it explicitly with the
 * `--emit` flag (otherwise it just prints a dry-run preview) to underline that
 * nothing consumes it yet.
 *
 * Research caveat (RESEARCH_ML_USAGE.md §1.7): R2DE/QDET offline difficulty
 * estimation is promising, but extrapolating a QDET-style estimate onto a
 * PARAMETRIC generator is flagged UNVERIFIED — treat these seeds as a mild prior
 * to be validated empirically, never as ground truth. The verifier + Elo remain
 * the source of truth for difficulty; this only nudges the cold-start.
 *
 * Determinism: pure hand-features + a fixed linear model → identical output for
 * identical input. No network, no clock, no randomness.
 *
 * Usage:
 *   node scripts/difficultyWarmstart.mjs               # dry-run preview to stdout
 *   node scripts/difficultyWarmstart.mjs --in spec.json --out warmstart.json --emit
 *
 * Input spec (JSON array); each entry describes one (topic, tier, template):
 *   {
 *     "topicKey": "probability::conditional",
 *     "tier": "medium",
 *     "template": "bayesTree",
 *     "features": { "steps": 3, "operandMagnitude": 3, "conditional": 1,
 *                   "distractorCloseness": 0.6, "fractions": 1 }
 *   }
 */
import { readFileSync, writeFileSync } from "node:fs";

/** The `TIER_SEED` logit ladder (mirrors src/lib/mastery/config.ts). */
const TIER_SEED = { intro: -1.5, easy: -0.5, medium: 0.5, hard: 1.5, expert: 2.5 };
const D_MIN = TIER_SEED.intro;
const D_MAX = TIER_SEED.expert;

/**
 * Pure, deterministic hand-feature → predicted logit-difficulty model. A simple,
 * transparent linear combination centered on the tier's own seed, nudged by
 * structural features. Clamped to the TIER_SEED range so a warm-start can never
 * push a seed off the ladder. (Weights are a defensible starting point, to be
 * empirically re-fit; see the §1.7 caveat above.)
 */
export function predictDifficulty(tier, features = {}) {
  const base = TIER_SEED[tier] ?? 0;
  const f = {
    steps: 0, // reasoning-step count (VanLehn: more steps → harder)
    operandMagnitude: 0, // digits/magnitude of operands
    conditional: 0, // 1 if it requires conditioning/Bayesian reasoning
    distractorCloseness: 0, // 0..1, how near the best distractor is to the key
    fractions: 0, // 1 if answers are fractions/decimals (harder to state)
    ...features,
  };
  const raw =
    base +
    0.18 * (f.steps - 2) +
    0.08 * (f.operandMagnitude - 2) +
    0.25 * f.conditional +
    0.4 * f.distractorCloseness +
    0.12 * f.fractions;
  return Math.max(D_MIN, Math.min(D_MAX, Number(raw.toFixed(4))));
}

/** Map a spec array → a TierDifficultyMap `{ "<topicKey>#<tier>": d }`. */
export function warmstartMap(spec) {
  const out = {};
  for (const e of spec) {
    if (!e || !e.topicKey || !e.tier) continue;
    out[`${e.topicKey}#${e.tier}`] = predictDifficulty(e.tier, e.features);
  }
  return out;
}

/** A tiny built-in demo spec so the script runs with zero inputs (dry-run). */
const DEMO_SPEC = [
  {
    topicKey: "probability::conditional",
    tier: "medium",
    template: "bayesTree",
    features: { steps: 3, operandMagnitude: 3, conditional: 1, distractorCloseness: 0.6, fractions: 1 },
  },
  {
    topicKey: "mental-math::_core",
    tier: "easy",
    template: "twoDigitMul",
    features: { steps: 1, operandMagnitude: 2, conditional: 0, distractorCloseness: 0.2, fractions: 0 },
  },
];

function parseArgs(argv) {
  const args = { emit: false, in: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--emit") args.emit = true;
    else if (a === "--in") args.in = argv[++i];
    else if (a === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const spec = args.in
    ? JSON.parse(readFileSync(args.in, "utf8"))
    : DEMO_SPEC;
  const map = warmstartMap(spec);
  const json = JSON.stringify(map, null, 2);

  if (args.emit && args.out) {
    writeFileSync(args.out, json + "\n");
    process.stderr.write(
      `[warmstart] wrote ${Object.keys(map).length} seed(s) → ${args.out}\n` +
        "[warmstart] NOTE: experimental + DEFERRED — nothing consumes this yet.\n",
    );
  } else {
    process.stderr.write(
      "[warmstart] DRY RUN (experimental, deferred). Pass --in <spec.json> --out <file> --emit to write.\n",
    );
    process.stdout.write(json + "\n");
  }
}

// Only run when invoked directly (keeps the pure helpers importable/testable).
if (import.meta.url === `file://${process.argv[1]}`) main();
