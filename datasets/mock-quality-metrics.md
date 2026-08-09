# Mock Interview — Quality Metrics

**Generated:** 2026-08-09 · **Sampler:** `scripts/mockQualitySampler.ts` · **Seeds per firm:** 300 (deterministic).

This artifact is produced by assembling every firm preset across 300 seeds and running the full interview-grade acceptance gate over each mock: the deterministic STRUCTURAL audit (`auditScript`) and the SENIOR-QUANT rubric reviewer (`reviewScript`, offline heuristic mode). Both halves must be 100% for the mocks to be interview-grade.

## Structural gate (deterministic)

| Firm | Mocks | Mocks passing | Total violations | Scored items | Avg distinct families |
|---|---|---|---|---|---|
| optiver | 300 | 300 (100.00%) | 0 | 3600 | 7.81 |
| janestreet | 300 | 300 (100.00%) | 0 | 3300 | 7.33 |
| sig | 300 | 300 (100.00%) | 0 | 3600 | 8.36 |

## Senior-quant rubric reviewer (offline heuristic)

| Firm | Items reviewed | Interview-grade | Flags raised |
|---|---|---|---|
| optiver | 3000 | 3000 (100.00%) | none |
| janestreet | 1500 | 1500 (100.00%) | none |
| sig | 1800 | 1800 (100.00%) | none |

## Verdict

**PASS** — every sampled mock cleared both the structural gate and the senior-quant rubric: no decomposition follow-ups, no easier-than-base follow-ups, no back-to-back topic families, and no trivial items.

> The rubric reviewer runs OFFLINE (deterministic heuristic) so this file is reproducible in CI. Wiring a real `RubricLlm` scores the identical items with a senior-quant LLM without changing the sampler.
