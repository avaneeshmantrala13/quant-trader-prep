# Firm Timed Assessments — Master List (Top-20 Quant Trading Firms)

> **Purpose.** One consolidated view of the **timed** online-assessment (OA) and interview formats in **undergrad quant-TRADER internship** pipelines, to decide what timed-drill features to build. Merged from two research passes; full per-firm detail + inline sources live in **`FIRM_TIMED_ASSESSMENTS_part1.md`** (Optiver, Jane Street, Citadel Securities, Jump, IMC, SIG, DRW, HRT, Five Rings, Akuna) and **`FIRM_TIMED_ASSESSMENTS_part2.md`** (Flow, Maven, Old Mission, Belvedere, PEAK6, CTC, Wolverine, XTX, Group One, Two Sigma Sec., Virtu, Tower, Radix + synthesis).
>
> **Confidence & freshness.** Research date **2026-07-28**. Nearly all specifics are **community/prep-vendor reported** and rotate by cycle — treat the *skill categories tested* as durable and exact counts/timers as approximate. Nothing fabricated; gaps stated as gaps.

---

## 1. Executive summary — the three OA archetypes

1. **Pure arithmetic sprint (the gate).** Optiver & Akuna **80-in-8** (~6 s/q), Flow **60-in-6**, Maven **50-in-5**, IMC (50–80 Qs), Jump (30–60 Qs), Citadel Securities (~50 Qs/12 min). Optiver adds fractions/negatives + **+1/−1 penalty**; Akuna/Flow are integer/decimal free-response (Zetamac transfers cleanly).
2. **Short, brutal problem set.** Five Rings **~15–20 typed Qs / 20 min** (reputed hardest), DRW **~6–8 Qs / 45–60 min** (recursion/EV-heavy), HRT **~8–12 MC math Qs / 60 min** (after a CodeSignal gate), XTX **90–120 min** (research-track).
3. **Mixed cognitive/probability battery.** SIG (Mercer|Mettl ~20 or ~60 min), PEAK6 (1–2 hr IQ-style), CTC (aptitude), Belvedere (30–40 Qs/60 min), Maven (numerical + sequences + probability + Arctic Shores).

**Jane Street** is the outlier: arithmetic is embedded in interviews and graded on **answer + stated confidence**, not raw sprint speed. Almost every firm also carries timed elements into interviews (rapid-fire math, **market-making games**, SIG's **poker round**).

---

## 2. Master comparison table — timed categories × firm

Legend: ✅ core/prominent · ➖ secondary/present · ❔ reported but varies · ✖ not notable · (blank) = out of scope. MM = market-making.

| Firm | Standalone timed OA? | Mental math | Sequences | Prob / EV timed | Combinatorics | MM / spread / arb | Estimation / Fermi | Logic / verbal | Coding | Signature timing |
|---|---|---|---|---|---|---|---|---|---|---|
| **Optiver** | ✅ SHL suite | ✅ (neg/frac, +1/−1) | ✅ | ✅ (~15 min) | ➖ | ✅ arb + MM game | ✅ | ➖ | ➖ | **80-in-8**, fail-one-fail-all |
| **Jane Street** | ❔ interview-embedded | ✅ (~7–8 min) | ✖ | ✅ (+confidence) | ➖ | ✅ MM game | ➖ | ➖ | ➖ (some) | Mental math + **confidence per answer** |
| **Citadel Sec.** | ✅ own OA | ✅ (~50/12 min) | ➖ | ➖ | ➖ | ➖ (MM in interview) | ➖ | ✅ verbal+logic | ➖ | **50 Qs / 12 min** cognitive |
| **Jump** | ✅ (60–90 min) | ✅ (speed-obsessed) | ➖ | ✅ | ➖ | ➖ | ➖ | ➖ | ✅ (C++/Py) | Raw arithmetic speed + coding |
| **IMC** | ✅ (60–75 min) | ✅ (<3 s/q edge) | ✅ | ➖ | ➖ | ✅ make-a-market | ➖ | ➖ | ✅ (SWE) | Accuracy-under-speed gate |
| **SIG** | ✅ Mercer\|Mettl | ✅ (15–30 s/q) | ✅ | ✅ (calc on PSA) | ✅ | ➖ | ✅ | ✅ logic/optim | ➖ | 20-min eval / 60-min PSA; **poker round** |
| **DRW** | ✅ (45–75 min) | ✅ | ✅ | ✅ (recursion/DP) | ➖ | ➖ | ➖ | ✅ | ✅ (SWE; QR numpy) | **6–8 Qs / 45–60 min** |
| **HRT** | ✅ CodeSignal + math | ✅ (trader path) | ➖ | ✅ (8–12/60 min MC) | ➖ | ➖ | ➖ estimation chat | ✅ | ✅ CodeSignal ≥78 | Multi-stage, one-pass |
| **Five Rings** | ✅ HackerRank | ✅ (estimation-math) | ✖ | ✅ (unsolvable-exact) | ✅ | ➖ | ✅ Fermi/olympiad | ➖ | ➖ | **15–20 Qs / 20 min**, typed, hardest |
| **Akuna** | ✅ HackerRank | ✅ (80-in-8, no frac) | ✅ (24–30/12–16 min) | ➖ (game) | ➖ | ✅ betting game | ➖ | ➖ | ✅ 2nd OA | **80-in-8** free-response + sequences |
| **Flow Traders** | ✅ (official host) | ✅ (60-in-6, no skip) | ✅ (~26/25 min) | ➖ | ➖ | ➖ (sims later) | ➖ | ➖ | ➖ (tech: HR) | **60-in-6** + dedicated sequences |
| **Maven** | ✅ multi-part | ✅ (50-in-5) | ✅ (num+alpha) | ✅ (18/30 min) | ➖ | ➖ | ✅ approximations | ➖ | ✅ HackerRank | Numerical + sequences + prob + Arctic Shores |
| **Old Mission** | ✅ (2-part) | ✅ (Optiver-spirit) | ➖ | ✅ | ✅ | ✅ MM + **CI elicitation** | ✅ Fermi | ➖ | ➖ (median coding Q) | Hard math gate + MM interview |
| **Belvedere** | ✅ (30–40/60 min) | ✅ (2-digit <3 s) | ✅ | ✅ | ➖ | ➖ (intuition) | ➖ | ➖ | ➖ | **30–40 Qs / 60 min**, ~25–30% pass |
| **PEAK6** | ✅ (1–2 hr) | ✅ | ✅ | ✅ | ➖ | ➖ (poker program) | ✅ market-sizing | ✅ grid/matrix | ➖ | IQ-style cognitive battery |
| **CTC** | ✅ aptitude test | ✅ | ✅ (aptitude) | ➖ | ➖ | ✅ **mock trading** | ➖ | ✅ critical-think | ➖ (SE track) | Aptitude OA + trading-sim superweek |
| **Wolverine** | ✅ role-dependent | ✅ | ➖ | ✅ (dice/EV) | ➖ | ✅ live MM sim | ➖ | ➖ | ✅ (tech track) | Mental-math/prob **or** CodeSignal |
| **Group One** | ❔ likely (thin) | ✅ (inferred) | ➖ | ✅ (inferred) | ➖ | ✅ (inferred) | ➖ | ➖ | ➖ | *Likely Optiver-family + MM* (low confidence) |
| **XTX** | ✅ hard take-home | ➖ (as prep) | ➖ | ✅ (under time) | ✅ | ✖ | ✅ | ➖ | ✅ ML/algo | 90–120 min; **research track, not trader** |
| **Two Sigma Sec.** | — | | | ✅ (research) | ✅ | ✖ | ➖ | ➖ | ✅ | Research/dev seat, not trader-speed OA |
| **Virtu** | — | | | ✅ (research) | ➖ | ✖ | ➖ | ➖ | ✅ C/C++ | Quant-research screen |
| **Tower** | — | | | ✅ | ➖ | ✖ | ➖ | ➖ | ✅ | HFT research/dev, coding screen |
| **Radix** | — | | | ✅ (inferred) | ➖ | ✖ | ➖ | ➖ | ✅ C++ | Research/engineering (inferred) |

---

## 3. Recurring timed skill categories — ranked (whole landscape)

1. **Fast mental arithmetic (int/decimal/fraction/%)** — near-universal gate (essentially every MM firm).
2. **Probability / EV under time** — very high; OA and/or interview at almost every firm.
3. **Market-making game** (quote a spread, update on info, manage inventory/P&L) — high; the highest interview signal.
4. **Sequences / pattern recognition** — high (Flow, Maven, PEAK6, Optiver, Akuna, CTC).
5. **Estimation / Fermi / market-sizing** — medium-high (Optiver, Jump, HRT, Citadel, PEAK6, Old Mission CIs, Maven).
6. **Arbitrage / spread reading / de-vig** — medium (Optiver-signature; implicit in every MM round).
7. **Logic / matrix / critical-thinking** — medium (PEAK6, CTC, Wolverine, Citadel).
8. **Combinatorics / counting under time** — medium (folds into probability).
9. **Rules reading-comprehension** — low/implicit (inside trading games).
10. **Coding under time** — role-dependent (research/dev gate; "a plus" for pure traders).

---

## 4. Feature recommendations vs. the existing Speed Arena

**Speed Arena today = category #1 (mental arithmetic) done very well** — `zetamac`, `optiver` (80/8, +1/−1), and `custom` modes; strong analytics (pacing, rushing-mistake detector, EV coaching, penalty scoring); a server-authoritative leaderboard; firm attribution for Optiver/Jane Street only. All the timing/analytics scaffolding is reusable by any new timed drill.

| # | Category | Status | Feature idea |
|---|---|---|---|
| 1 | Mental arithmetic | ✅ Covered | **Add firm presets** Flow **60/6** (no-skip, MCQ), Maven **50/5**, Belvedere ~35/60min; add **no-skip/no-back** + **MCQ-vs-free-entry** toggles; expand `firmFormats.ts`. *Highest ROI, lowest effort.* |
| 2 | Probability / EV under time | ❌ **Gap** | **Timed Probability Sprint** (soft timer, dice/cards/EV, "~90 s/q"), reuse pacing + rushing analytics; leaderboard off. |
| 3 | Market-making game | ❌ **Gap (biggest signal)** | **Timed MM drill**: bot posts fair value + noise, you quote two-sided, it hits/lifts + reveals info, you re-quote each round while UI tracks **P&L / drawdown / inventory**. (Note: the just-built live trading sims — Basketball/Marble/ETF — are close cousins; this would be the *arena* speed version.) |
| 4 | Sequences | ❌ **Gap** | **Timed Sequences drill**: numeric **and alphabetic**, ~30 Q, longer per-item budget. |
| 5 | Estimation / Fermi | ❌ **Gap** | **Timed Estimation + interval elicitation** ("90% CI in 60 s"), scored on calibration + speed — ties to the Fermi drill just built + Calibration Gym. |
| 6 | Arbitrage / de-vig | ❌ **Gap** | **Timed Arbitrage drill**: show quotes/odds, ask fair value / spot the arb / de-vig under ~30–60 s. Optiver-signature, no good free trainer. |
| 7 | Logic / matrix | ⚠️ partial | Optional **timed toggle** on Brainteasers (grid/matching) — lower priority. |
| 8 | Combinatorics | ❌ gap | Bundle as a sub-pack of the Timed Probability Sprint. |
| 9 | Rules reading-comp | implicit | Covered by the MM game's "read rules, act fast" framing. |
| 10 | Coding | out of scope | Leave out of arena; belongs to an optional coding track. |

**Prior planning already covers** the arithmetic gate, penalty scoring, rushing detection, EV coaching, leaderboard/leagues, and a soft "timed toggle" for reasoning tabs (`DESIGN_TIMING_LEADERBOARD.md`), plus Estimation/Fermi + MM + poker as course gaps (`FIRM_REQUIREMENTS.md §3`). **Net-new, research-justified additions:** the concrete firm presets (Flow 60/6, Maven 50/5, Belvedere), no-skip/MCQ toggles, dedicated timed **Sequences** and timed **Arbitrage/de-vig** drills, and the **P&L-tracking market-making shot clock**.

**Suggested build order (by ROI):** (1) firm presets + toggles → (2) timed MM shot-clock → (3) timed sequences → (4) timed arbitrage/de-vig → (5) timed probability sprint → (6) timed estimation/CI.

---

## 5. Honesty notes
- **Best-documented:** Flow, Maven, Belvedere, CTC, Old Mission, Optiver, Five Rings, Akuna, IMC, SIG, Citadel Sec.
- **Thin / low-confidence:** PEAK6, Wolverine (mixed trader/tech), Group One (inferred).
- **Role-mismatch (not trader-speed OAs):** XTX, Two Sigma Securities, Virtu, Tower, Radix — undergrad seats are research/engineering; don't let them drive trader speed-drill design.
- All exact counts/timers are point-in-time and mostly community/vendor-reported; see the two part files for inline source links + per-claim confidence tags.
