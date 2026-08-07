import { describe, expect, it } from "vitest";
import { getLevel } from "@/content";
import { isFlashcardLevel } from "@/types/content";
import { topicKeyForLevel, topicKeyOf } from "@/lib/mastery/topicKey";
import {
  MISCONCEPTION_EDGE,
  PREREQ_DAG,
  misconceptionTagOf,
  prereqNode,
} from "./prereqDAG";

describe("PREREQ_DAG structure", () => {
  const nodes = Object.values(PREREQ_DAG);

  it("keys match each node's topicKey", () => {
    for (const [key, node] of Object.entries(PREREQ_DAG)) {
      expect(node.topicKey).toBe(key);
    }
  });

  it("every prereq references a real node", () => {
    for (const node of nodes) {
      for (const p of node.prereqs) {
        expect(PREREQ_DAG[p], `${node.topicKey} → ${p}`).toBeDefined();
      }
    }
  });

  it("is acyclic", () => {
    // DFS with a recursion stack; a back-edge ⇒ cycle.
    const state = new Map<string, "visiting" | "done">();
    const hasCycle = (key: string): boolean => {
      const s = state.get(key);
      if (s === "visiting") return true;
      if (s === "done") return false;
      state.set(key, "visiting");
      for (const p of PREREQ_DAG[key].prereqs) {
        if (hasCycle(p)) return true;
      }
      state.set(key, "done");
      return false;
    };
    for (const key of Object.keys(PREREQ_DAG)) {
      expect(hasCycle(key)).toBe(false);
    }
  });

  /** Nodes that carry an own probe level (i.e. NOT external routing stubs). */
  const probeNodes = nodes.filter((n) => n.levelRef);

  it("every (non-external) node's levelRef resolves and its section-topicKey matches the node", () => {
    for (const node of probeNodes) {
      const resolved = getLevel(node.levelRef!.trackId, node.levelRef!.levelId);
      expect(resolved, `${node.topicKey} levelRef`).toBeDefined();
      // The mastery bucket a probe from this level writes MUST equal the node.
      const derived = topicKeyForLevel(node.levelRef!.trackId, resolved!.level);
      expect(derived).toBe(node.topicKey);
    }
  });

  it("every (non-external) node's levelRef is a SCORED (non-flashcard) level — buildProbeItem needs one", () => {
    // `buildProbeItem` returns null for flashcard levels, so a flashcard
    // levelRef would silently disable remediation for that node.
    for (const node of probeNodes) {
      const resolved = getLevel(node.levelRef!.trackId, node.levelRef!.levelId);
      expect(
        isFlashcardLevel(resolved!.level),
        `${node.topicKey} levelRef must be quiz/numeric`,
      ).toBe(false);
    }
  });

  it("external drill/game nodes have NO own levelRef but descend to a real, scored prereq", () => {
    // An external node (unregistered drill/game topic) is a pure routing stub: it
    // has no probe level of its own, so it MUST have prereqs, and every prereq
    // must be a real node with a resolvable, scored levelRef so descent lands on
    // a real probe (never a dead end / no-gap exit).
    const externals = nodes.filter((n) => n.external);
    expect(externals.length, "expected external drill/game nodes").toBeGreaterThan(0);
    for (const node of externals) {
      expect(node.levelRef, `${node.topicKey} must not carry a levelRef`).toBeUndefined();
      expect(node.prereqs.length, `${node.topicKey} must route somewhere`).toBeGreaterThan(0);
      for (const p of node.prereqs) {
        const parent = PREREQ_DAG[p];
        expect(parent, `${node.topicKey} → ${p}`).toBeDefined();
        expect(parent.external, `${p} must be a real (non-external) node`).not.toBe(true);
        expect(parent.levelRef, `${p} must have a probe level`).toBeDefined();
        const resolved = getLevel(parent.levelRef!.trackId, parent.levelRef!.levelId);
        expect(resolved, `${p} levelRef`).toBeDefined();
        expect(isFlashcardLevel(resolved!.level), `${p} scored`).toBe(false);
      }
    }
  });

  it("every MISCONCEPTION_EDGE value is a node", () => {
    for (const target of Object.values(MISCONCEPTION_EDGE)) {
      expect(PREREQ_DAG[target], target).toBeDefined();
    }
  });

  it("floors have no un-floored dead ends (every leaf is a floor; every non-floor can descend)", () => {
    for (const node of nodes) {
      // A leaf (no prereqs) must be a floor — descent can always terminate.
      if (node.prereqs.length === 0) {
        expect(node.floor, `${node.topicKey} leaf must be a floor`).toBe(true);
      }
      // No non-floor node may be a total dead end.
      if (!node.floor) {
        expect(node.prereqs.length).toBeGreaterThan(0);
      }
    }
  });

  it("every misconception-edge target is a prereq of at least one parent that can trip it", () => {
    // Sanity: the implicated prereq is reachable via descent from some node.
    for (const target of Object.values(MISCONCEPTION_EDGE)) {
      const someParent = Object.values(PREREQ_DAG).some((n) =>
        n.prereqs.includes(target),
      );
      expect(someParent, target).toBe(true);
    }
  });
});

describe("PREREQ_DAG scored-topic coverage (remediation gap fix)", () => {
  /** Scored topics that were previously un-remediable (no DAG node). */
  const NEWLY_COVERED = [
    topicKeyOf("probability", "Geometric Probability"),
    topicKeyOf("probability", "Poisson Distribution & Process"),
    topicKeyOf("probability", "Betting & Sizing"),
    topicKeyOf("probability", "Order Statistics"),
    topicKeyOf("probability", "Continuous Distributions"),
    topicKeyOf("probability", "Variance, Covariance & the CLT"),
    topicKeyOf("probability", "Markov Chains"),
    topicKeyOf("probability", "Brownian Motion"),
    topicKeyOf("probability", "Game Theory & Puzzles"),
    topicKeyOf("math-questions", "Rates, Algebra & Word Problems"),
    topicKeyOf("math-questions", "Number Theory & Counting"),
    topicKeyOf("math-questions", "Geometry & Derivations"),
    topicKeyOf("interview-games"),
  ];

  it("every newly-added scored topic now returns a DAG node", () => {
    for (const key of NEWLY_COVERED) {
      expect(prereqNode(key), `${key} should be a DAG node`).toBeDefined();
    }
  });

  it("each newly-covered node draws its probe from a real scored level", () => {
    for (const key of NEWLY_COVERED) {
      const node = prereqNode(key)!;
      const resolved = getLevel(node.levelRef!.trackId, node.levelRef!.levelId);
      expect(resolved, `${key} levelRef`).toBeDefined();
      expect(isFlashcardLevel(resolved!.level), `${key} scored`).toBe(false);
      expect(topicKeyForLevel(node.levelRef!.trackId, resolved!.level)).toBe(key);
    }
  });

  it("the original five foundational nodes are still present", () => {
    for (const key of [
      topicKeyOf("mental-math"),
      topicKeyOf("probability", "Core Probability"),
      topicKeyOf("probability", "Combinatorial Analysis"),
      topicKeyOf("probability", "Conditional Probability"),
      topicKeyOf("probability", "Expected Value"),
    ]) {
      expect(prereqNode(key), key).toBeDefined();
    }
  });

  it("the newly-wired Conditional Expectation unit is covered (no silent no-gap)", () => {
    const key = topicKeyOf("probability", "Conditional Expectation");
    const node = prereqNode(key);
    expect(node, `${key} should be a DAG node`).toBeDefined();
    // Genuine upstream concepts: Conditional Probability & Bayes + Expected Value.
    expect(node!.prereqs).toEqual(
      expect.arrayContaining([
        topicKeyOf("probability", "Conditional Probability"),
        topicKeyOf("probability", "Expected Value"),
      ]),
    );
    // Probes materialize from CE's own scored intro level.
    const resolved = getLevel(node!.levelRef!.trackId, node!.levelRef!.levelId);
    expect(resolved, `${key} levelRef`).toBeDefined();
    expect(isFlashcardLevel(resolved!.level)).toBe(false);
    expect(topicKeyForLevel(node!.levelRef!.trackId, resolved!.level)).toBe(key);
  });

  it("the self-assessed Brainteaser flashcard tracks remain intentionally uncovered", () => {
    // Both Brainteasers tracks are flashcard-only (no scored attempt to probe),
    // so they are deliberately absent from the remediation DAG.
    expect(prereqNode(topicKeyOf("brainteasers", "Core Puzzles"))).toBeUndefined();
    expect(
      prereqNode(topicKeyOf("brainteasers", "Techniques Toolkit")),
    ).toBeUndefined();
  });

  it("every leaf is a scored floor (descent always bottoms out at a real, remediable floor)", () => {
    // The only prereq-less nodes are the two scored foundation floors:
    // Mental Arithmetic (L0) and Rates/Algebra (a skill-graph foundation root).
    const leaves = new Set(
      Object.values(PREREQ_DAG)
        .filter((n) => n.prereqs.length === 0)
        .map((n) => n.topicKey),
    );
    expect(leaves).toEqual(
      new Set([
        topicKeyOf("mental-math"),
        topicKeyOf("math-questions", "Rates, Algebra & Word Problems"),
      ]),
    );
    for (const n of Object.values(PREREQ_DAG)) {
      if (n.prereqs.length === 0) expect(n.floor, n.topicKey).toBe(true);
    }
  });
});

describe("ERK super-node split into seven first-class topics", () => {
  const P = (section: string) => topicKeyOf("probability", section);

  /** Each new topic → its expected prereq set + its OWN easiest scored levelRef. */
  const SPLIT: {
    section: string;
    prereqs: string[];
    levelId: string;
  }[] = [
    {
      section: "Moment Generating Functions",
      prereqs: [P("Expected Value"), P("Variance, Covariance & the CLT")],
      levelId: "ek-mgf",
    },
    {
      section: "Gamma Distribution",
      prereqs: [P("Continuous Distributions")],
      levelId: "ek-gamma",
    },
    {
      section: "Joint Distributions",
      prereqs: [P("Continuous Distributions"), P("Conditional Probability")],
      levelId: "ek-joint",
    },
    {
      section: "Limit Theorems",
      prereqs: [P("Variance, Covariance & the CLT")],
      levelId: "ek-limit",
    },
    {
      section: "Branching Processes",
      prereqs: [P("Expected Value"), P("Conditional Expectation")],
      levelId: "ek-branching",
    },
    {
      section: "Continuous-Time Markov Chains",
      prereqs: [P("Markov Chains"), P("Poisson Distribution & Process")],
      levelId: "ek-ctmc",
    },
    {
      section: "Markov Chain Structure",
      prereqs: [P("Markov Chains")],
      levelId: "ek-markov-pn",
    },
  ];

  it("the old single 'Extra Relevant Knowledge' node is gone", () => {
    expect(prereqNode(P("Extra Relevant Knowledge"))).toBeUndefined();
  });

  it("each of the seven new topics has a DAG node with the right prereqs", () => {
    for (const t of SPLIT) {
      const node = prereqNode(P(t.section));
      expect(node, `${t.section} should be a DAG node`).toBeDefined();
      expect(new Set(node!.prereqs), t.section).toEqual(new Set(t.prereqs));
      // Every prereq is itself a real node.
      for (const p of node!.prereqs) {
        expect(PREREQ_DAG[p], `${t.section} → ${p}`).toBeDefined();
      }
    }
  });

  it("each new topic's levelRef is that topic's own SCORED level", () => {
    for (const t of SPLIT) {
      const node = prereqNode(P(t.section))!;
      expect(node.levelRef!.levelId).toBe(t.levelId);
      const resolved = getLevel(node.levelRef!.trackId, node.levelRef!.levelId);
      expect(resolved, `${t.section} levelRef`).toBeDefined();
      expect(isFlashcardLevel(resolved!.level), `${t.section} scored`).toBe(false);
      // A probe from this level writes to the node's own bucket.
      expect(topicKeyForLevel(node.levelRef!.trackId, resolved!.level)).toBe(
        P(t.section),
      );
    }
  });
});

describe("PREREQ_DAG external drill/game coverage (audit Z1 / auctions no-routing)", () => {
  /** topicKey → expected prereqs for each newly-wired external routing stub. */
  const EXTERNAL: { key: string; prereqs: string[] }[] = [
    {
      key: topicKeyOf("sequences", "Sequences & Pattern Recognition"),
      prereqs: [topicKeyOf("math-questions", "Number Theory & Counting")],
    },
    {
      key: topicKeyOf("arbitrage", "No-Arbitrage"),
      prereqs: [
        topicKeyOf("probability", "Core Probability"),
        topicKeyOf("probability", "Expected Value"),
      ],
    },
    {
      key: topicKeyOf("fermi"),
      prereqs: [topicKeyOf("math-questions", "Rates, Algebra & Word Problems")],
    },
    { key: topicKeyOf("ev-timed"), prereqs: [topicKeyOf("probability", "Expected Value")] },
    { key: topicKeyOf("arena"), prereqs: [topicKeyOf("mental-math")] },
    {
      key: topicKeyOf("auctions"),
      prereqs: [
        topicKeyOf("probability", "Conditional Probability"),
        topicKeyOf("probability", "Expected Value"),
        topicKeyOf("probability", "Order Statistics"),
      ],
    },
  ];

  it("each previously-unrouted drill/game topic is now a DAG node with the right prereqs", () => {
    for (const t of EXTERNAL) {
      const node = prereqNode(t.key);
      expect(node, `${t.key} should be a DAG node`).toBeDefined();
      expect(node!.external, `${t.key} is an external routing stub`).toBe(true);
      expect(new Set(node!.prereqs), t.key).toEqual(new Set(t.prereqs));
    }
  });

  it("drill/game domain misconception tags route to a genuine prereq of the tripping node", () => {
    // Each tag → prereq mapping must be honored: the target is an actual prereq
    // of a node that emits that tag (so descent picks it, not prereqs[0]).
    const cases: { tag: string; topicKey: string; expect: string }[] = [
      // Sequences → Number Theory.
      {
        tag: "off_by_one_continuation",
        topicKey: topicKeyOf("sequences", "Sequences & Pattern Recognition"),
        expect: topicKeyOf("math-questions", "Number Theory & Counting"),
      },
      // No-Arbitrage: odds-reading ⇒ meaning of probability; basket ⇒ EV.
      {
        tag: "complement_prob",
        topicKey: topicKeyOf("arbitrage", "No-Arbitrage"),
        expect: topicKeyOf("probability", "Core Probability"),
      },
      {
        tag: "unweighted_basket",
        topicKey: topicKeyOf("arbitrage", "No-Arbitrage"),
        expect: topicKeyOf("probability", "Expected Value"),
      },
      // Auctions: winner's-curse conditioning ⇒ Conditional Probability;
      // shade-with-n ⇒ Order Statistics.
      {
        tag: "ignored_winners_curse",
        topicKey: topicKeyOf("auctions"),
        expect: topicKeyOf("probability", "Conditional Probability"),
      },
      {
        tag: "no_shading_for_n",
        topicKey: topicKeyOf("auctions"),
        expect: topicKeyOf("probability", "Order Statistics"),
      },
    ];
    for (const c of cases) {
      const target = MISCONCEPTION_EDGE[c.tag];
      expect(target, `${c.tag} should map somewhere`).toBe(c.expect);
      // And the target must actually be a prereq of the node that trips the tag.
      expect(prereqNode(c.topicKey)!.prereqs, `${c.tag} on ${c.topicKey}`).toContain(
        target,
      );
    }
  });
});

describe("PREREQ_DAG edge corrections", () => {
  const P = (section: string) => topicKeyOf("probability", section);

  it("Markov Chains requires Conditional Expectation (tower-rule first-step analysis)", () => {
    expect(prereqNode(P("Markov Chains"))!.prereqs).toContain(
      P("Conditional Expectation"),
    );
  });

  it("Poisson requires Continuous Distributions (exponential interarrivals)", () => {
    expect(prereqNode(P("Poisson Distribution & Process"))!.prereqs).toContain(
      P("Continuous Distributions"),
    );
  });

  it("Game Theory & Puzzles requires Expected Value", () => {
    expect(prereqNode(P("Game Theory & Puzzles"))!.prereqs).toContain(
      P("Expected Value"),
    );
  });
});

describe("misconceptionTagOf", () => {
  it("strips the topicKey:: prefix from a namespaced key", () => {
    expect(misconceptionTagOf("probability::Conditional Probability::reversed_conditional")).toBe(
      "reversed_conditional",
    );
  });
  it("returns a bare tag unchanged", () => {
    expect(misconceptionTagOf("base_rate_neglect")).toBe("base_rate_neglect");
  });
  it("returns undefined for empty/undefined", () => {
    expect(misconceptionTagOf(undefined)).toBeUndefined();
    expect(misconceptionTagOf("")).toBeUndefined();
  });
});

describe("prereqNode", () => {
  it("returns the node for a known topicKey and undefined otherwise", () => {
    const anyKey = Object.keys(PREREQ_DAG)[0];
    expect(prereqNode(anyKey)?.topicKey).toBe(anyKey);
    expect(prereqNode("nope::nope")).toBeUndefined();
  });
});
