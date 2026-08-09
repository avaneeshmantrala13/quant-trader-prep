# Mock Interview — Quality Metrics

**Generated:** 2026-08-09 · **Sampler:** `scripts/mockQualitySampler.ts` · **Seeds per firm:** 300 (deterministic).

This artifact is produced by assembling every firm preset across 300 seeds and running the full interview-grade acceptance gate over each mock: the deterministic STRUCTURAL audit (`auditScript`) and the SENIOR-QUANT rubric reviewer (`reviewScript`, offline heuristic mode). Both halves must be 100% for the mocks to be interview-grade.

## Structural gate (deterministic)

| Firm | Mocks | Mocks passing | Total violations | Scored items | Avg distinct families | Max easy-family/mock | Easy-cap violations |
|---|---|---|---|---|---|---|---|
| optiver | 300 | 300 (100.00%) | 0 | 3600 | 9.11 | 1 | 0 |
| janestreet | 300 | 300 (100.00%) | 0 | 3300 | 7.33 | 1 | 0 |
| sig | 300 | 300 (100.00%) | 0 | 3600 | 8.36 | 1 | 0 |

> **Easy-family hard cap:** an "easy"/not-super-difficult family (sequences, mental-math, estimation) may appear at most 1× per mock. "Max easy-family/mock" is the largest single easy-family count seen across all sampled mocks (must be ≤ 1); "Easy-cap violations" counts mocks that exceeded it (must be 0).

## Senior-quant rubric reviewer (offline heuristic)

| Firm | Items reviewed | Interview-grade | Flags raised |
|---|---|---|---|
| optiver | 3000 | 3000 (100.00%) | none |
| janestreet | 1500 | 1500 (100.00%) | none |
| sig | 1800 | 1800 (100.00%) | none |

## Verdict

**PASS** — every sampled mock cleared both the structural gate and the senior-quant rubric: no decomposition follow-ups, no easier-than-base follow-ups, no back-to-back topic families, no easy family (sequences / mental-math / estimation) appearing more than once, and no trivial items.

> The rubric reviewer runs OFFLINE (deterministic heuristic) so this file is reproducible in CI. Wiring a real `RubricLlm` scores the identical items with a senior-quant LLM without changing the sampler.
