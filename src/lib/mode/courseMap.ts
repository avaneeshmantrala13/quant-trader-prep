import { topicKeyOf } from "@/lib/mastery/topicKey";

/**
 * CASE A COURSE → TOPIC MAPPING (WS0), grounded in
 * `datasets/KNOWLEDGE_GRAPH_CASE_A.md` + `CASE_MODE_BUILD_PLAN.md` §4.
 *
 * This is a pure REGROUPING of EXISTING `topicKey`s (each resolves to a real
 * mastery bucket + skill-graph node + content section) into the two UT course
 * tracks. It introduces NO new levels and stores no progress. The UI surfaces
 * these as **"Intro to Probability"** and **"Intro to Stochastic Processes"** —
 * the internal M362K/M362M `code`s are provenance only and are NEVER shown.
 *
 * The seven former-"Extra Relevant Knowledge" topics are first-class here:
 * MGF / Gamma / Joint Distributions / Limit Theorems → Intro to Probability;
 * Branching / CTMC / Markov Chain Structure → Intro to Stochastic Processes.
 * Conditional Probability & Poisson are genuinely SHARED — primary in Intro to
 * Probability, shown as shared/upstream in Intro to Stochastic Processes.
 */

export type CourseId = "m362k" | "m362m";

const P = (section: string) => topicKeyOf("probability", section);

/* -- Intro to Probability (M362K) primary topics ---------------------------- */
const M362K_TOPICS: string[] = [
  P("Combinatorial Analysis"),
  P("Core Probability"),
  P("Conditional Probability"),
  P("Expected Value"),
  P("Poisson Distribution & Process"),
  P("Geometric Probability"),
  P("Order Statistics"),
  P("Continuous Distributions"),
  P("Variance, Covariance & the CLT"),
  // Now first-class (ex-ERK):
  P("Moment Generating Functions"),
  P("Gamma Distribution"),
  P("Joint Distributions"),
  P("Limit Theorems"),
];

/* -- Intro to Stochastic Processes (M362M) primary topics ------------------- */
const M362M_TOPICS: string[] = [
  P("Conditional Expectation"),
  P("Markov Chains"),
  P("Brownian Motion"),
  // Now first-class (ex-ERK):
  P("Branching Processes"),
  P("Continuous-Time Markov Chains"),
  P("Markov Chain Structure"),
];

/**
 * Genuinely SHARED upstream topics whose PRIMARY home is Intro to Probability
 * but which Intro to Stochastic Processes reviews/uses (M1 conditional-prob
 * review; M5 Poisson process). Shown under Intro to Stochastic Processes as
 * "shared / upstream", not owned by it (so `courseForTopic` returns m362k).
 */
const M362M_SHARED: string[] = [
  P("Conditional Probability"),
  P("Poisson Distribution & Process"),
];

export interface CourseMeta {
  id: CourseId;
  /** UI label — the ONLY course name shown to the learner. */
  label: string;
  /** Internal UT course code (provenance; NEVER rendered in the UI). */
  code: string;
  /** Short course blurb for the course page + dashboard card. */
  blurb: string;
  /** Primary course topicKeys, in curriculum order (owned by this course). */
  topicKeys: string[];
  /** Shared/upstream topicKeys shown but owned by another course. */
  sharedTopicKeys: string[];
}

export const COURSES: CourseMeta[] = [
  {
    id: "m362k",
    label: "Intro to Probability",
    code: "M362K",
    blurb:
      "Counting, axioms, conditioning and Bayes, expectation and variance, continuous densities, and the joint / limit-theorem toolkit.",
    topicKeys: M362K_TOPICS,
    sharedTopicKeys: [],
  },
  {
    id: "m362m",
    label: "Intro to Stochastic Processes",
    code: "M362M",
    blurb:
      "Conditional expectation and the tower rule, Markov chains and random walks, branching and continuous-time chains, and Brownian motion.",
    topicKeys: M362M_TOPICS,
    sharedTopicKeys: M362M_SHARED,
  },
];

export const COURSE_BY_ID: Record<CourseId, CourseMeta> = {
  m362k: COURSES[0],
  m362m: COURSES[1],
};

/** Look up a course by id (undefined for an unknown id). */
export function getCourse(id: string): CourseMeta | undefined {
  return (COURSE_BY_ID as Record<string, CourseMeta>)[id];
}

/** Every course id, in display order. */
export function courseIds(): CourseId[] {
  return COURSES.map((c) => c.id);
}

/**
 * All topicKeys a course DISPLAYS (primary first, then shared/upstream), with no
 * duplicates. Order is stable: primary curriculum order, then shared.
 */
export function topicsInCourse(id: CourseId): string[] {
  const c = COURSE_BY_ID[id];
  if (!c) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of [...c.topicKeys, ...c.sharedTopicKeys]) {
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/**
 * The PRIMARY course that owns a topicKey (the course listing it under
 * `topicKeys`), or undefined if the topic is not part of either course
 * (e.g. beyond-the-course / foundations topics). Shared topics resolve to their
 * primary owner (Conditional Probability & Poisson → m362k).
 */
export function courseForTopic(topicKey: string): CourseId | undefined {
  for (const c of COURSES) {
    if (c.topicKeys.includes(topicKey)) return c.id;
  }
  return undefined;
}

/** True when a topicKey belongs to (is displayed by) either course. */
export function isCourseTopic(topicKey: string): boolean {
  return COURSES.some(
    (c) => c.topicKeys.includes(topicKey) || c.sharedTopicKeys.includes(topicKey),
  );
}

/** The set of every topicKey owned as a PRIMARY topic by any course. */
export function courseTopicKeySet(): Set<string> {
  const s = new Set<string>();
  for (const c of COURSES) for (const k of c.topicKeys) s.add(k);
  return s;
}
