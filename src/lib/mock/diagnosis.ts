/**
 * mock/diagnosis.ts — DETERMINISTIC performance aggregation + brutal diagnosis.
 *
 * The CLIENT is the source of truth for every performance number. `computePerformance`
 * projects a finished session into the exact PII-minimized `MockPerformance`
 * payload the `mock-diagnosis` contract expects. `deterministicDiagnosis` turns
 * those same numbers into an honest verdict when the AI layer is off, and
 * `normalizeDiagnosisPayload` defensively parses the LLM reply (contract-safe
 * defaults) so a malformed response never crashes the report.
 *
 * PURE: no React, DOM, storage, or network.
 */
import type { MockSession } from "./engine";
import type {
  CompetencyTally,
  MockDiagnosis,
  MockPerformance,
  MockResponse,
  MockStep,
  ReasoningTags,
} from "./types";

/** Human label for the target desk tier the candidate is measured against. */
export function tierLabel(tier: string): string {
  switch (tier) {
    case "hard":
      return "top-tier prop desk";
    case "medium":
      return "strong prop/quant desk";
    default:
      return "first-round screen";
  }
}

/**
 * Aggregate a finished (or in-progress) session into the deterministic
 * performance summary. Follow-ups are tallied SEPARATELY and fed into the
 * overall accuracy. `correctButVagueCount` counts answers that were CORRECT but
 * whose reasoning was vague/absent — NEVER attributing mental-math brevity to
 * vagueness (mental-math steps are excluded from that count).
 */
export function computePerformance(session: MockSession): MockPerformance {
  const { script, responses } = session;
  const byId = new Map<string, MockResponse>(
    responses.map((r) => [r.stepId, r]),
  );
  const stepsOf = (kind: MockStep["kind"]) =>
    script.steps.filter((s) => s.kind === kind);

  // --- Math (blended) + per-competency split by qtype ---
  const mathSteps = stepsOf("math");
  const mathResponses = mathSteps
    .map((s) => byId.get(s.id))
    .filter((r): r is MockResponse => !!r && !!r.score);
  const mathCorrect = mathResponses.filter((r) => r.score!.correct).length;
  const mathTotal = mathSteps.length;
  const elapsed = mathResponses.map((r) => r.score!.elapsedMs);
  const avgMathMs =
    elapsed.length > 0
      ? Math.round(elapsed.reduce((a, b) => a + b, 0) / elapsed.length)
      : 0;

  // Per-competency tallies, keyed off each math step's qtype. A `MathStep`
  // carries `qtype` ∈ {mental-math, probability-ev, sequences, estimation}.
  const tallyFor = (qtype: string): CompetencyTally => {
    const steps = mathSteps.filter(
      (s) => s.kind === "math" && s.qtype === qtype,
    );
    const responded = steps
      .map((s) => byId.get(s.id))
      .filter((r): r is MockResponse => !!r && !!r.score);
    return {
      correct: responded.filter((r) => r.score!.correct).length,
      total: steps.length,
    };
  };
  const speed = tallyFor("mental-math");
  const probEv = tallyFor("probability-ev");
  const sequences = tallyFor("sequences");
  const estimation = tallyFor("estimation");
  const speedElapsed = mathSteps
    .filter((s) => s.kind === "math" && s.qtype === "mental-math")
    .map((s) => byId.get(s.id))
    .filter((r): r is MockResponse => !!r && !!r.score)
    .map((r) => r.score!.elapsedMs);
  const speedAvgMs =
    speedElapsed.length > 0
      ? Math.round(speedElapsed.reduce((a, b) => a + b, 0) / speedElapsed.length)
      : 0;

  // --- Follow-ups (probe + adversarial, tallied separately then combined) ---
  const collectRole = (role: "probe" | "adversarial") =>
    mathSteps
      .map((s) => byId.get(s.id)?.followups?.[role])
      .filter((f): f is NonNullable<typeof f> => !!f && f.graded && !!f.score);
  const probeGraded = collectRole("probe");
  const adversarialGraded = collectRole("adversarial");
  const probeTotal = probeGraded.length;
  const probeCorrect = probeGraded.filter((f) => f.score!.correct).length;
  const adversarialTotal = adversarialGraded.length;
  const adversarialCorrect = adversarialGraded.filter(
    (f) => f.score!.correct,
  ).length;
  // Combined across BOTH follow-ups — the field the AI diagnosis contract uses.
  const followupTotal = probeTotal + adversarialTotal;
  const followupCorrect = probeCorrect + adversarialCorrect;

  // --- Brainteasers ---
  const btSteps = stepsOf("brainteaser");
  const brainteaserTotal = btSteps.length;
  const brainteaserCorrect = btSteps.filter(
    (s) => byId.get(s.id)?.selfAssessed === "got",
  ).length;

  // --- Reasoning tallies + correct-but-vague ---
  const reasoningTags: ReasoningTags = {
    sound: 0,
    partial: 0,
    flawed: 0,
    vague: 0,
    absent: 0,
    ambiguous: 0,
    uninterpretable: 0,
  };
  let correctButVagueCount = 0;
  for (const step of script.steps) {
    const r = byId.get(step.id);
    const grade = r?.reasoningGrade;
    if (!grade) continue;
    reasoningTags[grade.quality] = (reasoningTags[grade.quality] ?? 0) + 1;
    const answerCorrect =
      step.kind === "brainteaser"
        ? r?.selfAssessed === "got"
        : !!r?.score?.correct;
    // A demonstrably FALSE stated step ("flawed") OR an unresolved AMBIGUOUS
    // (mixed/contradictory) reasoning is a real weakness even on mental math — it
    // is NOT mere brevity — so it is charged when the answer was still correct.
    if (step.kind === "math") {
      if (
        answerCorrect &&
        (grade.quality === "flawed" ||
          grade.quality === "ambiguous" ||
          grade.quality === "uninterpretable")
      )
        correctButVagueCount += 1;
      continue;
    }
    // Non-MM: charge vague/absent (can't defend), flawed (false step),
    // ambiguous (couldn't commit to one clean answer), and uninterpretable
    // (couldn't be understood at all — the interviewer can't credit it).
    if (
      answerCorrect &&
      (grade.quality === "vague" ||
        grade.quality === "absent" ||
        grade.quality === "flawed" ||
        grade.quality === "ambiguous" ||
        grade.quality === "uninterpretable")
    ) {
      correctButVagueCount += 1;
    }
  }

  // --- Market making ---
  const mmSteps = stepsOf("marketMaking");
  const mmDone = mmSteps
    .map((s) => byId.get(s.id)?.mm)
    .filter((m): m is NonNullable<typeof m> => !!m && m.done);
  const mmPnl =
    mmDone.length > 0
      ? Math.round(mmDone.reduce((a, m) => a + m.pnl, 0) * 100) / 100
      : undefined;
  const mmVerdict = mmDone.length > 0 ? mmDone[mmDone.length - 1].verdict : undefined;

  // --- Overall accuracy (math + follow-ups + brainteasers) ---
  const correctItems = mathCorrect + followupCorrect + brainteaserCorrect;
  const totalItems = mathTotal + followupTotal + brainteaserTotal;
  const scorePct = totalItems > 0 ? Math.round((correctItems / totalItems) * 100) : 0;

  return {
    scorePct,
    mathCorrect,
    mathTotal,
    avgMathMs,
    brainteaserCorrect,
    brainteaserTotal,
    followupCorrect,
    followupTotal,
    probeCorrect,
    probeTotal,
    adversarialCorrect,
    adversarialTotal,
    ...(mmPnl !== undefined ? { mmPnl } : {}),
    ...(mmVerdict !== undefined ? { mmVerdict } : {}),
    reasoningTags,
    correctButVagueCount,
    tier: tierLabel(script.tier),
    speed,
    speedAvgMs,
    probEv,
    sequences,
    estimation,
  };
}

/* -------------------------------------------------------------------------- */
/*  Deterministic diagnosis (AI-off fallback)                                  */
/* -------------------------------------------------------------------------- */

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

/** Percentage from an optional competency tally (0 total → null: not tested). */
function cPct(t?: { correct: number; total: number }): number | null {
  return t && t.total > 0 ? Math.round((t.correct / t.total) * 100) : null;
}

/**
 * A brutally-honest-but-fair, PER-COMPETENCY diagnosis derived ENTIRELY from the
 * deterministic numbers. Used when the AI layer is off, and as the guaranteed
 * floor if the LLM reply is unusable. It grades each competency separately
 * (speed/arithmetic, probability & EV, sequences, estimation, brainteaser logic,
 * market-making, follow-up/critical-thinking, reasoning quality), calls out EVERY
 * gap — including "correct but vague" and "answered the main question but folded
 * on the adversarial follow-up" — and routes each gap to a SPECIFIC place on this
 * site.
 */
export function deterministicDiagnosis(perf: MockPerformance): MockDiagnosis {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const nextSteps: string[] = [];

  const mathPct = pct(perf.mathCorrect, perf.mathTotal);
  const fuPct = pct(perf.followupCorrect, perf.followupTotal);
  const probePct = pct(perf.probeCorrect, perf.probeTotal);
  const advPct = pct(perf.adversarialCorrect, perf.adversarialTotal);

  const speedPct = cPct(perf.speed);
  const probEvPct = cPct(perf.probEv);
  const seqPct = cPct(perf.sequences);
  const estPct = cPct(perf.estimation);
  const speedAvg = perf.speedAvgMs ?? perf.avgMathMs;

  /* -- Strengths (per competency) -- */
  if (speedPct !== null && speedPct >= 80) {
    strengths.push(`Speed & arithmetic gate cleared cleanly (${perf.speed!.correct}/${perf.speed!.total}) — the automaticity the desk expects.`);
  }
  if (probEvPct !== null && probEvPct >= 80) {
    strengths.push(`Probability & EV strong (${perf.probEv!.correct}/${perf.probEv!.total}) — the core discriminating skill.`);
  }
  if (seqPct !== null && seqPct >= 80) {
    strengths.push(`Pattern/sequence recognition solid (${perf.sequences!.correct}/${perf.sequences!.total}).`);
  }
  if (estPct !== null && estPct >= 80) {
    strengths.push(`Estimation/Fermi decomposition solid (${perf.estimation!.correct}/${perf.estimation!.total}).`);
  }
  if (speedPct === null && probEvPct === null && perf.mathTotal > 0 && mathPct >= 70) {
    strengths.push(`Math accuracy solid at ${perf.mathCorrect}/${perf.mathTotal} (${mathPct}%).`);
  }
  if (perf.reasoningTags.sound >= 2) {
    strengths.push(`${perf.reasoningTags.sound} answers with sound, well-justified reasoning.`);
  }
  if (perf.followupTotal > 0 && fuPct >= 67) {
    strengths.push(`Held up under follow-ups (${perf.followupCorrect}/${perf.followupTotal}) — you defended and extended, not just answered.`);
  }
  if (perf.mmPnl !== undefined && perf.mmPnl > 0) {
    strengths.push(`Positive market-making P&L (+${perf.mmPnl}) — captured edge without getting picked off.`);
  }

  /* -- Weaknesses (per competency; every gap called out) -- */
  if (perf.mmPnl !== undefined && perf.mmPnl < 0) {
    weaknesses.push(
      `Market-making P&L of ${perf.mmPnl}${perf.mmVerdict ? ` (${perf.mmVerdict})` : ""} — a red flag on the core skill: you're getting picked off or quoting offside.`,
    );
  }
  if (speedPct !== null && speedPct < 70) {
    weaknesses.push(`Speed/arithmetic gate: only ${perf.speed!.correct}/${perf.speed!.total} — below the automaticity bar; firms treat this as a hard filter.`);
  }
  if (speedAvg > 12000 && (perf.speed?.total ?? perf.mathTotal) > 0) {
    weaknesses.push(`Arithmetic pace (~${(speedAvg / 1000).toFixed(1)}s/item) is too slow for a ${perf.tier}; the gate is about reflexes, not just accuracy.`);
  }
  if (probEvPct !== null && probEvPct < 70) {
    weaknesses.push(`Probability & EV: ${perf.probEv!.correct}/${perf.probEv!.total} — this is THE signal for a quant trader and it's under the bar.`);
  }
  if (seqPct !== null && seqPct < 70) {
    weaknesses.push(`Sequences/pattern recognition: ${perf.sequences!.correct}/${perf.sequences!.total} — you're missing the generating rule, not just the next term.`);
  }
  if (estPct !== null && estPct < 70) {
    weaknesses.push(`Estimation: ${perf.estimation!.correct}/${perf.estimation!.total} — shaky order-of-magnitude decomposition.`);
  }
  if (perf.reasoningTags.flawed > 0) {
    weaknesses.push(
      `${perf.reasoningTags.flawed} answer${perf.reasoningTags.flawed > 1 ? "s" : ""} reached the right number through a FALSE or nonsensical step (a stated computation that doesn't hold). A correct answer via broken logic won't survive an interviewer — fix the method, not just the result.`,
    );
  }
  const ambiguousCount = perf.reasoningTags.ambiguous ?? 0;
  if (ambiguousCount > 0) {
    weaknesses.push(
      `${ambiguousCount} answer${ambiguousCount > 1 ? "s" : ""} were MIXED / contradictory — you pointed both ways and, even when pressed to commit, didn't land a clean single answer. Interviewers read this as not actually understanding it.`,
    );
  }
  const uninterpretableCount = perf.reasoningTags.uninterpretable ?? 0;
  if (uninterpretableCount > 0) {
    weaknesses.push(
      `${uninterpretableCount} response${uninterpretableCount > 1 ? "s" : ""} couldn't be understood at all — write your reasoning as a clear, plain-language claim about the problem; an interviewer can't credit what they can't parse.`,
    );
  }
  if (perf.correctButVagueCount > 0) {
    weaknesses.push(
      `${perf.correctButVagueCount} item${perf.correctButVagueCount > 1 ? "s" : ""} answered correctly but with vague or flawed reasoning — you got the number right but couldn't cleanly defend it; interviewers will press and you'll fold.`,
    );
  }
  // The critical-thinking signal: could produce the number but folded when the
  // ASSUMPTION changed / the ask generalized (exactly where offers are decided).
  if (perf.adversarialTotal > 0 && advPct < 50 && probePct >= advPct + 20) {
    weaknesses.push(
      `Converted only ${perf.adversarialCorrect}/${perf.adversarialTotal} adversarial follow-ups despite doing better on the direct probes — you can compute but fold when I change an assumption or ask you to generalize.`,
    );
  } else if (perf.followupTotal > 0 && fuPct < 67) {
    weaknesses.push(`Only ${perf.followupCorrect}/${perf.followupTotal} follow-ups converted — you lose ground the moment the question shifts off the rote version.`);
  }

  /* -- Next steps: route each gap to a SPECIFIC place on this site -- */
  if ((speedPct !== null && speedPct < 80) || speedAvg > 11000) {
    nextSteps.push("Speed: drill the Speed Arena (/arena) and EV-Timed sprints (/ev-timed) under a strict per-item clock until 2-digit×2-digit and fraction↔decimal are automatic.");
  }
  if (probEvPct !== null && probEvPct < 80) {
    nextSteps.push("Probability & EV: build a Custom Drill (/drill) on Conditional Probability, Bayes, and Expected Value; redo the Conditional Probability and Expected Value lessons until the setups are reflexive.");
  }
  if (seqPct !== null && seqPct < 80) {
    nextSteps.push("Sequences: drill pattern recognition (/drill on Sequences) and always state the generating RULE, not just the next term.");
  }
  if (estPct !== null && estPct < 80) {
    nextSteps.push("Estimation: run the Fermi drills (/fermi) — decompose, sanity-check magnitudes, and identify the dominant assumption.");
  }
  if (perf.mmPnl !== undefined && perf.mmPnl <= 0) {
    nextSteps.push("Market-making: rebuild the framework in Make-a-Market (/make-market) and Cards Market-Making (/cards-market-making) — centre your mid, keep spreads tight, skew on inventory, never quote offside.");
  }
  if (
    perf.correctButVagueCount > 0 ||
    (perf.adversarialTotal > 0 && advPct < 67) ||
    perf.reasoningTags.vague +
      perf.reasoningTags.absent +
      perf.reasoningTags.flawed +
      (perf.reasoningTags.ambiguous ?? 0) +
      (perf.reasoningTags.uninterpretable ?? 0) >
      0
  ) {
    nextSteps.push("Critical thinking: for every answer, write the full reasoning chain before revealing, then re-run this mock (/mock) and, on each follow-up, defend WHY it holds and generalize it — that's where the adversarial press decides offers.");
  }
  if (nextSteps.length === 0) {
    nextSteps.push("Keep reps up across all competencies (/games, /simulations) to hold this standard under real pressure.");
  }

  /* -- Gate: strict. A losing MM sim or a shaky core caps the ceiling. -- */
  let wouldPass: MockDiagnosis["wouldPass"];
  const mmBad = perf.mmPnl !== undefined && perf.mmPnl < 0;
  const coreWeak =
    (probEvPct !== null && probEvPct < 60) ||
    (speedPct !== null && speedPct < 60);
  if (
    perf.scorePct >= 80 &&
    !mmBad &&
    !coreWeak &&
    perf.correctButVagueCount <= 1 &&
    perf.reasoningTags.flawed === 0 &&
    (perf.reasoningTags.ambiguous ?? 0) === 0 &&
    (perf.reasoningTags.uninterpretable ?? 0) === 0 &&
    (perf.adversarialTotal === 0 || advPct >= 50)
  ) {
    wouldPass = "yes";
  } else if (perf.scorePct < 55 || (mmBad && perf.scorePct < 70) || coreWeak) {
    wouldPass = "no";
  } else {
    wouldPass = "borderline";
  }

  const gateWord =
    wouldPass === "yes"
      ? "would likely clear"
      : wouldPass === "no"
        ? "would not clear"
        : "is borderline for";
  const mmSign =
    perf.mmPnl === undefined
      ? ""
      : perf.mmPnl > 0
        ? "positive"
        : perf.mmPnl < 0
          ? "losing"
          : "break-even";
  const verdict =
    `At ${perf.scorePct}% overall against a ${perf.tier} bar` +
    `${mmSign ? `, with a ${mmSign} market-making sim` : ""}` +
    `${perf.followupTotal > 0 ? ` and ${perf.followupCorrect}/${perf.followupTotal} follow-ups converted` : ""}, ` +
    `this candidate ${gateWord} a first-round screen.`;

  if (strengths.length === 0) {
    strengths.push("Completed the full screen end-to-end without stalling.");
  }

  return { verdict, wouldPass, strengths, weaknesses, nextSteps, source: "deterministic" };
}

/**
 * Floor an AI diagnosis to the deterministic one FIELD-BY-FIELD so the report is
 * ALWAYS complete. A verbose model can emit a verdict then get truncated (empty
 * strengths/weaknesses/next-steps) or return lists as strings that normalize to
 * `[]`; surfacing that as-is shows the candidate a diagnosis with no substance.
 * Any missing/empty AI field falls back to the deterministic value for that
 * field. When NOTHING usable came from the model, the result is the pure
 * deterministic floor (`source: "deterministic"`).
 */
export function floorDiagnosis(
  ai: MockDiagnosis,
  fallback: MockDiagnosis,
): MockDiagnosis {
  const usedAi =
    ai.verdict.trim() !== "" ||
    ai.strengths.length > 0 ||
    ai.weaknesses.length > 0 ||
    ai.nextSteps.length > 0;
  return {
    verdict: ai.verdict.trim() !== "" ? ai.verdict : fallback.verdict,
    wouldPass: usedAi ? ai.wouldPass : fallback.wouldPass,
    strengths: ai.strengths.length > 0 ? ai.strengths : fallback.strengths,
    weaknesses: ai.weaknesses.length > 0 ? ai.weaknesses : fallback.weaknesses,
    nextSteps: ai.nextSteps.length > 0 ? ai.nextSteps : fallback.nextSteps,
    source: usedAi ? "ai" : "deterministic",
  };
}

/**
 * Defensively normalize a `mock-diagnosis` payload into a `MockDiagnosis`,
 * applying the contract's safe defaults for any missing/wrong-typed field. Never
 * throws. `source` is `"ai"`.
 */
export function normalizeDiagnosisPayload(
  payload: Record<string, unknown> | null,
): MockDiagnosis {
  const strArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((s): s is string => typeof s === "string" && s.trim() !== "")
      : [];
  const verdict = typeof payload?.["verdict"] === "string" ? (payload["verdict"] as string) : "";
  const rawPass = payload?.["wouldPass"];
  const wouldPass: MockDiagnosis["wouldPass"] =
    rawPass === "yes" || rawPass === "no" || rawPass === "borderline"
      ? rawPass
      : "borderline"; // contract default
  return {
    verdict,
    wouldPass,
    strengths: strArr(payload?.["strengths"]),
    weaknesses: strArr(payload?.["weaknesses"]),
    nextSteps: strArr(payload?.["nextSteps"]),
    source: "ai",
  };
}
