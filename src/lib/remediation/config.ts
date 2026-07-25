/**
 * Tunable constants + the mode flag for the Phase-4 remediation layer.
 *
 * Research anchors (cite in the policy modules, per PHASE_4 §1):
 *  - Bloom 1984 (2-sigma / mastery learning): remediate the SPECIFIC missing
 *    prerequisite, keep corrective work small, aim for a ~80% node-cleared bar.
 *  - Doignon & Falmagne KST / ALEKS: a precedence DAG; teach at the OUTER
 *    FRINGE = the first passed probe (one edge up from the gap).
 *  - Vygotsky ZPD: stop at scaffolded-yes / unaided-no; never drop below the
 *    graph floor.
 *  - Wilson, Shenhav, Straccia & Cohen 2019 (85% Rule): probe & climb tiers at
 *    the ~85%-predicted-success band.
 *  - Kapur 2014 (productive failure): do NOT remediate the first stumble.
 *  - Bjork (desirable difficulties): interleave + space the repair (route to
 *    the SM-2 review ladder).
 *
 * BACKUP swap ("drop one tier in place", no cross-topic descent): flip
 * {@link REMEDIATION_MODE} to `"in-place"`. The DFS/DAG modules are then simply
 * unused — Phase-1 Elo already lowers the ~85%-target tier after a miss, so the
 * lesson player just re-serves within the same topic (PHASE_4 §2).
 */

/**
 * PRIMARY `"dag"` = bounded backtracking down the static prerequisite DAG.
 * BACKUP `"in-place"` = lower the tier within the same topic and re-serve
 * (no descent). Kept as a single gate so the swap is costless.
 */
export const REMEDIATION_MODE: "dag" | "in-place" = "dag";

/** Wilson 85% Rule: probe (and climb) at the tier whose predicted success ≈ this. */
export const PROBE_P = 0.85;

/** ≥ this many consecutive misses at the floor tier is a precondition to leave a node. */
export const BOTTOM_OUT_MISSES = 2;

/** AND predicted success at the easiest (intro) tier must be below this to descend. */
export const BOTTOM_OUT_PMAX = 0.5;

/** Descend at most this many edges per remediation session (KST smoothness; 2–3). */
export const DEPTH_CAP = 3;

/** Bloom ~80% "node-cleared" bar, read as the Beta CI lower bound (CI_low ≥ this). */
export const CLEAR_BAR = 0.8;

/** OR this many correct answers at the node's target tier clears it. */
export const CLEAR_CORRECT_AT_TARGET = 2;
