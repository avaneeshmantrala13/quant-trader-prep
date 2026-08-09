# Mock Interview — Quality Metrics

**Generated:** 2026-08-09 · **Sampler:** `scripts/mockQualitySampler.ts` · **Seeds per firm:** 300 (deterministic).

This artifact is produced by assembling every **runnable** firm preset across 300 seeds and running the full interview-grade acceptance gate over each mock: the deterministic STRUCTURAL audit (`auditScript`) and a deterministic HEURISTIC RE-CHECK (`reviewScript` in offline mode, i.e. `reviewItemHeuristic`). Both halves must be 100% for the mocks to be interview-grade.

> **Coverage (honest scope).** Only firms with a runnable preset are generated and measured here: **optiver, janestreet, sig**. Every other firm in the research (Citadel, IMC, DRW, Five Rings, Akuna, Jump, HRT, …) has **no runnable preset**, so it is **NOT generated and is UNMEASURED** — its absence from the tables below is not a pass. Also note the "heuristic re-check" column is a **deterministic second pass that reuses the structural predicates** (plus a trivial-base guard); it is **NOT an independent senior-quant LLM opinion**.

## Structural gate (deterministic)

| Firm | Mocks | Mocks passing | Total violations | Scored items | Avg distinct families | Max easy-family/mock | Easy-cap violations |
|---|---|---|---|---|---|---|---|
| optiver | 300 | 300 (100.00%) | 0 | 3900 | 10.01 | 1 | 0 |
| janestreet | 300 | 300 (100.00%) | 0 | 3300 | 7.33 | 1 | 0 |
| sig | 300 | 300 (100.00%) | 0 | 3600 | 8.36 | 1 | 0 |

> **Easy-family hard cap:** an "easy"/not-super-difficult family (sequences, mental-math, estimation) may appear at most 1× per mock. "Max easy-family/mock" is the largest single easy-family count seen across all sampled mocks (must be ≤ 1); "Easy-cap violations" counts mocks that exceeded it (must be 0).

## Heuristic re-check (deterministic — NOT an independent LLM)

> This is a deterministic re-check that reuses the structural predicates (decomposition / floor / taxonomy) plus a trivial-base guard, extended to cover market-making and brainteaser bases as well as conceptual math. It is reproducible in CI and is **not** a second, independent senior-quant opinion; a real `RubricLlm` could be wired via `reviewScript` but none is.

| Firm | Items re-checked | Passed re-check | Flags raised |
|---|---|---|---|
| optiver | 3900 | 3900 (100.00%) | none |
| janestreet | 3000 | 3000 (100.00%) | none |
| sig | 3300 | 3300 (100.00%) | none |

## Verdict

**PASS** — every sampled RUNNABLE mock cleared both the structural gate and the deterministic heuristic re-check: no decomposition follow-ups, no easier-than-base follow-ups, no back-to-back topic families, no easy family (sequences / mental-math / estimation) appearing more than once, and no trivial items. Reference-only firms are unmeasured (see the coverage note above).

> The heuristic re-check runs OFFLINE (deterministic) so this file is reproducible in CI. It re-uses the structural predicates rather than a model, so it is a re-check, not an independent second opinion; wiring a real `RubricLlm` via `reviewScript` would add a genuine model pass without changing the sampler.
