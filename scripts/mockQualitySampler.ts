/**
 * mockQualitySampler.ts — the ADVERSARIAL interview-quality sampler.
 *
 * Assembles a large sample of firm mocks across many seeds, runs BOTH halves of
 * the interview-grade acceptance gate over every one, and writes a checked-in
 * metrics summary:
 *   • STRUCTURAL gate (`auditScript`): deterministic diversity / difficulty /
 *     decomposition / per-family-cap checks.
 *   • HEURISTIC RE-CHECK (`reviewScript`, offline): the deterministic
 *     `reviewItemHeuristic` — a SECOND deterministic pass that REUSES the same
 *     structural predicates plus a trivial-base guard. This is NOT an
 *     independent second opinion and NOT a senior-quant LLM; it is a reproducible
 *     re-check. `reviewScript` accepts a mockable `RubricLlm` so a real model
 *     COULD be wired later, but none is wired here (no network in CI).
 *
 * COVERAGE / HONESTY: only the THREE firms with a RUNNABLE preset (`PRESET_ORDER`
 * = Optiver, Jane Street, SIG) are assembled and measured. The other seven
 * (Citadel, IMC, DRW, Five Rings, Akuna, Jump, HRT) are reference profiles with
 * no preset, so they are NOT generated and are explicitly UNMEASURED — the
 * emitted markdown says so.
 *
 * Determinism: pure seeded RNG + the heuristic re-check ⇒ byte-identical metrics
 * every run, so `datasets/mock-quality-metrics.md` is a stable, reviewable
 * artifact.
 *
 * RUN
 *   npx vite-node scripts/mockQualitySampler.ts            # dry-run to stdout
 *   npx vite-node scripts/mockQualitySampler.ts --emit     # + write the metrics md
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildInterview } from "@/lib/mock/engine";
import { PRESET_ORDER } from "@/lib/mock/presets";
import {
  auditScript,
  isEasyFamily,
  EASY_FAMILY_CAP,
} from "@/lib/mock/interviewGate";
import type { TopicFamily } from "@/lib/mock/types";
import {
  reviewScript,
  summarizeVerdicts,
  type RubricVerdict,
} from "@/lib/mock/interviewRubric";

const SEED_COUNT = 300;
const SEEDS = Array.from({ length: SEED_COUNT }, (_, i) => i * 7 + 1);

interface FirmMetrics {
  preset: string;
  mocks: number;
  structuralPassMocks: number;
  structuralViolations: number;
  scoredItems: number;
  rubricItems: number;
  rubricInterviewGrade: number;
  flagCounts: Record<string, number>;
  avgDistinctFamilies: number;
  /** Largest count of ANY single easy-family item observed in one mock. */
  maxEasyFamilyCount: number;
  /** Mocks in which some easy family appeared more than {@link EASY_FAMILY_CAP}. */
  easyCapViolations: number;
}

async function sampleFirm(preset: string): Promise<FirmMetrics> {
  let structuralPassMocks = 0;
  let structuralViolations = 0;
  let scoredItems = 0;
  let familiesTotal = 0;
  let maxEasyFamilyCount = 0;
  let easyCapViolations = 0;
  const verdicts: RubricVerdict[] = [];

  for (const seed of SEEDS) {
    const script = buildInterview({ seed, preset: preset as never });
    const report = auditScript(script);
    if (report.ok) structuralPassMocks += 1;
    structuralViolations += report.violations.length;
    scoredItems += report.scoredItems;
    familiesTotal += report.families.length;
    // Easy-family hard cap: assert no "easy"/not-super-difficult family (sequences,
    // mental-math, estimation) appears more than once in any single sampled mock.
    let mockEasyMax = 0;
    for (const [fam, count] of Object.entries(report.familyCounts)) {
      if (isEasyFamily(fam as TopicFamily)) {
        mockEasyMax = Math.max(mockEasyMax, count);
      }
    }
    maxEasyFamilyCount = Math.max(maxEasyFamilyCount, mockEasyMax);
    if (mockEasyMax > EASY_FAMILY_CAP) easyCapViolations += 1;
    // Offline heuristic reviewer (deterministic). Swap in an llm for a model run.
    verdicts.push(...(await reviewScript(script)));
  }

  const summary = summarizeVerdicts(verdicts);
  return {
    preset,
    mocks: SEEDS.length,
    structuralPassMocks,
    structuralViolations,
    scoredItems,
    rubricItems: summary.total,
    rubricInterviewGrade: summary.interviewGrade,
    flagCounts: summary.flagCounts,
    avgDistinctFamilies: familiesTotal / SEEDS.length,
    maxEasyFamilyCount,
    easyCapViolations,
  };
}

function pct(n: number, d: number): string {
  return d === 0 ? "n/a" : `${((100 * n) / d).toFixed(2)}%`;
}

function renderMarkdown(metrics: FirmMetrics[]): string {
  const now = new Date().toISOString().slice(0, 10);
  const lines: string[] = [];
  lines.push("# Mock Interview — Quality Metrics");
  lines.push("");
  lines.push(
    `**Generated:** ${now} · **Sampler:** \`scripts/mockQualitySampler.ts\` · ` +
      `**Seeds per firm:** ${SEED_COUNT} (deterministic).`,
  );
  lines.push("");
  lines.push(
    "This artifact is produced by assembling every **runnable** firm preset " +
      `across ${SEED_COUNT} seeds and running the full interview-grade acceptance ` +
      "gate over each mock: the deterministic STRUCTURAL audit (`auditScript`) and " +
      "a deterministic HEURISTIC RE-CHECK (`reviewScript` in offline mode, i.e. " +
      "`reviewItemHeuristic`). Both halves must be 100% for the mocks to be " +
      "interview-grade.",
  );
  lines.push("");
  lines.push(
    "> **Coverage (honest scope).** Exactly **three** firms have a runnable " +
      `preset and are generated + measured here: **${PRESET_ORDER.join(", ")}**. ` +
      "The other **seven** firms (Citadel, IMC, DRW, Five Rings, Akuna, Jump, " +
      "HRT) are **reference profiles only** — no runnable preset, so they are " +
      "**NOT generated and are UNMEASURED** (surfaced in-app as read-only " +
      "reference profiles, never as a startable mock). " +
      "Their absence from the tables below is not a pass. " +
      "Also note the \"heuristic re-check\" column is a **deterministic second " +
      "pass that reuses the structural predicates** (plus a trivial-base guard); " +
      "it is **NOT an independent senior-quant LLM opinion**.",
  );
  lines.push("");
  lines.push("## Structural gate (deterministic)");
  lines.push("");
  lines.push(
    "| Firm | Mocks | Mocks passing | Total violations | Scored items | Avg distinct families | Max easy-family/mock | Easy-cap violations |",
  );
  lines.push("|---|---|---|---|---|---|---|---|");
  for (const m of metrics) {
    lines.push(
      `| ${m.preset} | ${m.mocks} | ${m.structuralPassMocks} (${pct(m.structuralPassMocks, m.mocks)}) | ${m.structuralViolations} | ${m.scoredItems} | ${m.avgDistinctFamilies.toFixed(2)} | ${m.maxEasyFamilyCount} | ${m.easyCapViolations} |`,
    );
  }
  lines.push("");
  lines.push(
    `> **Easy-family hard cap:** an "easy"/not-super-difficult family (sequences, ` +
      `mental-math, estimation) may appear at most ${EASY_FAMILY_CAP}× per mock. ` +
      "\"Max easy-family/mock\" is the largest single easy-family count seen across " +
      "all sampled mocks (must be ≤ 1); \"Easy-cap violations\" counts mocks that " +
      "exceeded it (must be 0).",
  );
  lines.push("");
  lines.push("## Heuristic re-check (deterministic — NOT an independent LLM)");
  lines.push("");
  lines.push(
    "> This is a deterministic re-check that reuses the structural predicates " +
      "(decomposition / floor / taxonomy) plus a trivial-base guard, extended to " +
      "cover market-making and brainteaser bases as well as conceptual math. It " +
      "is reproducible in CI and is **not** a second, independent senior-quant " +
      "opinion; a real `RubricLlm` could be wired via `reviewScript` but none is.",
  );
  lines.push("");
  lines.push("| Firm | Items re-checked | Passed re-check | Flags raised |");
  lines.push("|---|---|---|---|");
  for (const m of metrics) {
    const flags = Object.entries(m.flagCounts);
    const flagStr = flags.length
      ? flags.map(([k, v]) => `${k}=${v}`).join(", ")
      : "none";
    lines.push(
      `| ${m.preset} | ${m.rubricItems} | ${m.rubricInterviewGrade} (${pct(m.rubricInterviewGrade, m.rubricItems)}) | ${flagStr} |`,
    );
  }
  lines.push("");
  const allClean =
    metrics.every((m) => m.structuralPassMocks === m.mocks) &&
    metrics.every((m) => m.rubricInterviewGrade === m.rubricItems) &&
    metrics.every((m) => m.easyCapViolations === 0 && m.maxEasyFamilyCount <= EASY_FAMILY_CAP);
  lines.push("## Verdict");
  lines.push("");
  lines.push(
    allClean
      ? "**PASS** — every sampled RUNNABLE mock cleared both the structural gate " +
          "and the deterministic heuristic re-check: no decomposition follow-ups, " +
          "no easier-than-base follow-ups, no back-to-back topic families, no easy " +
          "family (sequences / mental-math / estimation) appearing more than once, " +
          "and no trivial items. Reference-only firms are unmeasured (see the " +
          "coverage note above)."
      : "**FAIL** — one or more sampled mocks tripped the gate; see the tables above.",
  );
  lines.push("");
  lines.push(
    "> The heuristic re-check runs OFFLINE (deterministic) so this file is " +
      "reproducible in CI. It re-uses the structural predicates rather than a " +
      "model, so it is a re-check, not an independent second opinion; wiring a " +
      "real `RubricLlm` via `reviewScript` would add a genuine model pass without " +
      "changing the sampler.",
  );
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const emit = process.argv.includes("--emit");
  const metrics: FirmMetrics[] = [];
  for (const preset of PRESET_ORDER) metrics.push(await sampleFirm(preset));

  const md = renderMarkdown(metrics);
  if (emit) {
    const out = resolve(process.cwd(), "datasets/mock-quality-metrics.md");
    writeFileSync(out, md, "utf8");
    // eslint-disable-next-line no-console
    console.log(`Wrote ${out}`);
  } else {
    // eslint-disable-next-line no-console
    console.log(md);
    // eslint-disable-next-line no-console
    console.log("\n(dry-run — pass --emit to write datasets/mock-quality-metrics.md)");
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
