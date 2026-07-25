import { describe, expect, it } from "vitest";
import { MISCONCEPTION } from "@/lib/tutor/misconception";
import {
  CONDITIONAL,
  COUNTING,
  EXPECTED_VALUE,
  L0_ARITHMETIC,
  L1_MEANING,
  PREREQ_DAG,
} from "@/content/remediation/prereqDAG";
import {
  chooseDescentEdge,
  probeTierFor,
  remediationStep,
  type RemediationInput,
} from "./policy";
import { descendTo, startRemediation } from "./session";

/** A bottomed-out learner at a node: 2 misses at the floor tier, P(intro) < 0.5. */
function bottomed(
  topicKey: string,
  over: Partial<RemediationInput> = {},
): RemediationInput {
  return {
    topicKey,
    theta: -2, // sigmoid(-2 + 1.5) = 0.378 < 0.5 at the intro tier
    alpha: 1,
    beta: 3,
    n: 4,
    consecutiveMisses: 2,
    atFloorTier: true,
    depthThisSession: 0,
    ...over,
  };
}

describe("remediationStep — decision cascade", () => {
  it("first miss ⇒ retry-in-place (Kapur: don't remediate the first stumble)", () => {
    const a = remediationStep(bottomed(CONDITIONAL, { consecutiveMisses: 1 }));
    expect(a.kind).toBe("retry-in-place");
  });

  it("repeated miss but NOT at the floor tier ⇒ retry-in-place (keep easing in place)", () => {
    const a = remediationStep(bottomed(CONDITIONAL, { atFloorTier: false }));
    expect(a.kind).toBe("retry-in-place");
  });

  it("repeated miss at floor tier but P(intro) ≥ 0.5 ⇒ retry-in-place", () => {
    const a = remediationStep(bottomed(CONDITIONAL, { theta: 1 }));
    expect(a.kind).toBe("retry-in-place");
  });

  it("bottomed out (2 misses at floor tier AND P<0.5) ⇒ descend the implicated edge", () => {
    const a = remediationStep(
      bottomed(CONDITIONAL, { misconceptionTag: MISCONCEPTION.reversedConditional }),
    );
    expect(a.kind).toBe("descend");
    if (a.kind === "descend") expect(a.toTopicKey).toBe(L1_MEANING);
  });

  it("the misconception (not just the first prereq) selects the descent edge", () => {
    // ordered_vs_unordered implicates COUNTING, the SECOND prereq of Conditional.
    const a = remediationStep(
      bottomed(CONDITIONAL, { misconceptionTag: MISCONCEPTION.orderedVsUnordered }),
    );
    expect(a.kind).toBe("descend");
    if (a.kind === "descend") expect(a.toTopicKey).toBe(COUNTING);
  });

  it("probe PASS at a descended node ⇒ teach-link + STOP (outer fringe)", () => {
    const a = remediationStep({
      ...bottomed(L1_MEANING),
      consecutiveMisses: 0,
      depthThisSession: 1,
    });
    expect(a.kind).toBe("teach-link");
    if (a.kind === "teach-link") expect(a.atTopicKey).toBe(L1_MEANING);
  });

  it("a single probe FAIL at a non-floor descended node ⇒ descend one more edge (STEP D)", () => {
    // At COUNTING (depth 1) a single miss recurses to its prereq immediately —
    // the 2-miss bottom-out rule only gates the ORIGIN decision.
    const a = remediationStep({
      ...bottomed(COUNTING, { depthThisSession: 1 }),
      consecutiveMisses: 1,
    });
    expect(a.kind).toBe("descend");
    if (a.kind === "descend") expect(a.toTopicKey).toBe(L0_ARITHMETIC);
  });

  it("probe FAIL at a floor node ⇒ floor-teach (Vygotsky: don't drop below the floor)", () => {
    const a = remediationStep(bottomed(L1_MEANING, { depthThisSession: 1 }));
    expect(a.kind).toBe("floor-teach");
    if (a.kind === "floor-teach") expect(a.atTopicKey).toBe(L1_MEANING);
  });

  it("depthThisSession ≥ DEPTH_CAP ⇒ stop descending (teach-link at lowest reached)", () => {
    const a = remediationStep(bottomed(CONDITIONAL, { depthThisSession: 3 }));
    expect(a.kind).toBe("teach-link");
  });

  it("fast + confident miss ⇒ exit 'slip' (non-gap override)", () => {
    const a = remediationStep(bottomed(CONDITIONAL, { responseFast: true }));
    expect(a.kind).toBe("exit");
    if (a.kind === "exit") expect(a.reason).toBe("slip");
  });

  it("unknown topic ⇒ exit 'no-gap'", () => {
    const a = remediationStep(bottomed("no::such-topic"));
    expect(a.kind).toBe("exit");
    if (a.kind === "exit") expect(a.reason).toBe("no-gap");
  });
});

describe("remediationStep — worked-example descent trace", () => {
  it("missed Conditional (counting gap) → probe Counting: fail → L0 floor (depth 2)", () => {
    // Depth 0: bottomed at Conditional with a counting misconception ⇒ descend to Counting.
    let session = startRemediation(CONDITIONAL);
    const step0 = remediationStep(
      bottomed(CONDITIONAL, {
        misconceptionTag: MISCONCEPTION.orderedVsUnordered,
        depthThisSession: session.depth,
      }),
    );
    expect(step0.kind).toBe("descend");
    if (step0.kind === "descend") {
      expect(step0.toTopicKey).toBe(COUNTING);
      session = descendTo(session, step0.toTopicKey);
    }
    expect(session.depth).toBe(1);

    // Depth 1: probe Counting FAILS (bottomed) ⇒ descend to its only prereq, L0.
    const step1 = remediationStep(
      bottomed(COUNTING, { depthThisSession: session.depth }),
    );
    expect(step1.kind).toBe("descend");
    if (step1.kind === "descend") {
      expect(step1.toTopicKey).toBe(L0_ARITHMETIC);
      session = descendTo(session, step1.toTopicKey);
    }
    expect(session.depth).toBe(2);

    // Depth 2: L0 is a floor ⇒ floor-teach, descent stops here.
    const step2 = remediationStep(
      bottomed(L0_ARITHMETIC, { depthThisSession: session.depth }),
    );
    expect(step2.kind).toBe("floor-teach");
    expect(session.path).toEqual([CONDITIONAL, COUNTING, L0_ARITHMETIC]);
  });

  it("frontier stop: a passed probe one edge down yields teach-link at depth 1", () => {
    let session = startRemediation(EXPECTED_VALUE);
    const step0 = remediationStep(
      bottomed(EXPECTED_VALUE, {
        misconceptionTag: MISCONCEPTION.reversedConditional,
        depthThisSession: session.depth,
      }),
    );
    expect(step0.kind).toBe("descend");
    if (step0.kind === "descend") session = descendTo(session, step0.toTopicKey);
    // The prereq probe PASSES (no misses at the descended node).
    const step1 = remediationStep({
      ...bottomed(session.currentTopicKey),
      consecutiveMisses: 0,
      depthThisSession: session.depth,
    });
    expect(step1.kind).toBe("teach-link");
    expect(session.depth).toBe(1);
  });
});

describe("chooseDescentEdge", () => {
  const cond = PREREQ_DAG[CONDITIONAL];
  const noMastery = () => undefined;

  it("returns the misconception-implicated prereq when it is an edge", () => {
    expect(
      chooseDescentEdge(cond, MISCONCEPTION.orderedVsUnordered, noMastery),
    ).toBe(COUNTING);
  });

  it("falls back to the lowest-mastery prereq when there is no tag", () => {
    const masteryOf = (k: string) =>
      k === L1_MEANING
        ? { mean: 0.9, theta: 1 }
        : { mean: 0.3, theta: -1 }; // COUNTING is weaker
    expect(chooseDescentEdge(cond, undefined, masteryOf)).toBe(COUNTING);
  });

  it("falls back to lowest-mastery when the tag maps outside the node's prereqs", () => {
    // faces_not_objects → COUNTING is a prereq, so use a tag with no edge here.
    const masteryOf = (k: string) =>
      k === L1_MEANING ? { mean: 0.2, theta: -1 } : { mean: 0.8, theta: 1 };
    expect(chooseDescentEdge(cond, "unmapped_tag", masteryOf)).toBe(L1_MEANING);
  });

  it("returns undefined for a node with no prereqs", () => {
    expect(chooseDescentEdge(PREREQ_DAG[L0_ARITHMETIC], undefined, noMastery)).toBeUndefined();
  });
});

describe("probeTierFor", () => {
  it("targets the tier whose predicted success ≈ 0.85 (intro for a weak learner)", () => {
    // sigmoid(theta - (-1.5)) = 0.85 ⇒ theta ≈ 0.2346 ⇒ intro is closest.
    expect(probeTierFor(0.2346, CONDITIONAL, {})).toBe("intro");
  });

  it("climbs to a harder tier as θ rises", () => {
    // sigmoid(theta - 0.5) = 0.85 ⇒ theta ≈ 2.2346 ⇒ medium (d=0.5) is closest.
    expect(probeTierFor(2.2346, CONDITIONAL, {})).toBe("medium");
  });
});
