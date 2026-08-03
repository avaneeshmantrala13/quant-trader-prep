import { useState } from "react";
import { Link } from "react-router-dom";
import type { ArenaOp, ArenaPreset, BoardKind } from "@/lib/arena/config";
import { configHash } from "@/lib/arena/config";
import type { AnsweredItem } from "@/lib/arena/scoring";
import { buildReport, type RunReport } from "@/lib/arena/analytics";
import {
  recordLocalRun,
  trailing7DayMedian,
  type KeyValueStore,
  type PersonalBest,
} from "@/lib/arena/localPb";
import { perQuestionBudgetMs } from "@/lib/arena/budget";
import { speedStats, type SpeedStats } from "@/lib/arena/speedStats";
import { readSpeedProfile, recordSpeedRun } from "@/lib/arena/speedProfile";
import {
  DEFAULT_WEAK_SPOT_CONFIG,
  bucketWeights,
  selectBucketSequence,
  shapeRange,
  type WeakSpotAttempt,
} from "@/lib/arena/weakSpot";
import {
  readWeakSpotHistory,
  recordWeakSpotAttempts,
} from "@/lib/arena/weakSpotProfile";
import { Rng } from "@/lib/rng";
import { arenaQuestionStream, streamPrompt } from "@/lib/leaderboard/seed";
import { arenaItemStream, generateArenaItem } from "@/content/arena/generators";
import {
  isLeaderboardEnabled,
  requestRankedSeed,
  submitRankedRun,
  submitGameScore,
} from "@/lib/leaderboard/client";
import { browserBoardStore, submitLocalScore } from "@/lib/leaderboard/localBoard";
import { PresetPicker } from "@/components/arena/PresetPicker";
import { ArenaRunner, type PlayItem } from "@/components/arena/ArenaRunner";
import { PostRunReport } from "@/components/arena/PostRunReport";
import { Leaderboard } from "@/components/arena/Leaderboard";
import { ChevronLeftIcon } from "@/components/icons";

type Phase = "pick" | "run" | "report";

/** Minimal, SSR-safe localStorage accessor for the local PB store. */
function store(): KeyValueStore {
  return {
    getItem: (k) => {
      try {
        return typeof localStorage !== "undefined"
          ? localStorage.getItem(k)
          : null;
      } catch {
        return null;
      }
    },
    setItem: (k, v) => {
      try {
        if (typeof localStorage !== "undefined") localStorage.setItem(k, v);
      } catch {
        /* ignore quota / privacy-mode errors */
      }
    },
  };
}

function boardOf(preset: ArenaPreset): BoardKind {
  return preset.mode === "optiver" ? "optiver" : "zetamac";
}

function rankedEligible(preset: ArenaPreset): boolean {
  return (
    isLeaderboardEnabled() &&
    preset.packs.length === 1 &&
    preset.packs[0] === "int"
  );
}

/**
 * SpeedArenaPage — the /arena route (thin). Orchestrates PresetPicker →
 * ArenaRunner → PostRunReport + Leaderboard. All scoring/timing/analytics live
 * in the pure `arena/*` + `leaderboard/*` modules; this page only wires state.
 *
 * Fully functional with the AI layer AND the leaderboard OFF: casual runs play
 * the local packs generator and record a local personal best. A ranked run (only
 * when the leaderboard is enabled and the preset is integer-only) requests a
 * server seed, plays the shared deterministic stream, and submits its answers
 * for server-authoritative re-scoring.
 */
export function SpeedArenaPage() {
  const [phase, setPhase] = useState<Phase>("pick");
  const [preset, setPreset] = useState<ArenaPreset | null>(null);
  const [items, setItems] = useState<PlayItem[]>([]);
  const [runId, setRunId] = useState(0);
  const [seed, setSeed] = useState<number | null>(null);
  const [report, setReport] = useState<RunReport | null>(null);
  const [pb, setPb] = useState<PersonalBest | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);
  const [trend, setTrend] = useState<number | null>(null);
  const [speed, setSpeed] = useState<SpeedStats | null>(null);
  const [nextBudgetMs, setNextBudgetMs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const start = async (raw: ArenaPreset) => {
    setLoading(true);
    // Seed the interview-overlay budget from the persisted (possibly adaptively
    // tightened) speed profile so the pressure carries over between runs.
    let p = raw;
    if (raw.interview) {
      const profile = readSpeedProfile(
        store(),
        boardOf(raw),
        configHash(raw),
      );
      p = { ...raw, budgetMs: profile?.budgetMs ?? perQuestionBudgetMs(raw) };
    }
    try {
      const count = Math.min(
        p.questionCap ?? Math.ceil(p.durationSec * 3),
        2000,
      );
      let play: PlayItem[];
      let usedSeed: number | null = null;

      if (p.mode === "weakspot") {
        play = weakSpotItems(p, count);
      } else if (rankedEligible(p)) {
        const issued = await requestRankedSeed(boardOf(p), configHash(p));
        if (issued) {
          usedSeed = issued.seed;
          play = arenaQuestionStream(issued.seed, p).map((s) => ({
            id: s.id,
            prompt: streamPrompt(s),
            answer: s.answer,
            op: s.op as ArenaOp,
          }));
        } else {
          play = casualItems(p, count);
        }
      } else {
        play = casualItems(p, count);
      }

      setPreset(p);
      setSeed(usedSeed);
      setItems(play);
      setRunId((n) => n + 1);
      setPhase("run");
    } finally {
      setLoading(false);
    }
  };

  const casualItems = (p: ArenaPreset, count: number): PlayItem[] => {
    const localSeed = Date.now() % 2_000_000_000;
    return arenaItemStream(localSeed, p, count).map((it) => ({
      id: it.id,
      prompt: it.prompt,
      answer: it.answer,
      op: it.op,
      decimals: it.decimals,
    }));
  };

  /**
   * Weak-Spot Trainer stream: read the persisted attempt history, weight each
   * (op × shape) bucket by how often it's missed, draw a seeded over-sampled
   * bucket sequence, then generate one integer item per chosen bucket by
   * widening the operand range to that bucket's shape. Each item carries its
   * `shape` so the finish handler can record the attempt back into the history.
   */
  const weakSpotItems = (p: ArenaPreset, count: number): PlayItem[] => {
    const history = readWeakSpotHistory(store());
    const weighted = bucketWeights(history, p.ops, DEFAULT_WEAK_SPOT_CONFIG);
    const selSeed = Date.now() % 2_000_000_000;
    const genRng = new Rng((selSeed ^ 0x9e3779b9) >>> 0);
    const seq = selectBucketSequence(weighted, new Rng(selSeed), count);
    return seq.map((bucket, i) => {
      const [lo, hi] = shapeRange(bucket.shape);
      const shaped: ArenaPreset = {
        ...p,
        ops: [bucket.op],
        packs: ["int"],
        ranges: { ...p.ranges, [bucket.op]: [lo, hi] },
      };
      const it = generateArenaItem(genRng, bucket.op, "int", shaped);
      return {
        id: `${it.id}#${i}`,
        prompt: it.prompt,
        answer: it.answer,
        op: it.op,
        shape: bucket.shape,
      };
    });
  };

  const finish = (answered: AnsweredItem[], elapsedMs: number) => {
    if (!preset) return;
    const rep = buildReport(answered, preset, {});
    const board = boardOf(preset);
    const cfg = configHash(preset);
    const { pb: newPb, isNewBest: nb } = recordLocalRun(
      store(),
      board,
      cfg,
      rep.score,
      Date.now(),
    );
    setReport(rep);
    setPb(newPb);
    setIsNewBest(nb);
    setTrend(trailing7DayMedian(store(), board, cfg, Date.now()));

    // Unified competitive leaderboard: also record this run's score on the
    // cross-game local board (higher-is-better), and submit to the optional
    // server board (graceful no-op when unconfigured). Keeps Speed Arena's own
    // PB/trend above untouched — this is purely additive.
    submitLocalScore(browserBoardStore(), "speed-arena", {
      score: rep.score,
      atMs: Date.now(),
      meta: { accuracyPct: Math.round(rep.accuracy * 100) },
    });
    void submitGameScore("speed-arena", rep.score);

    // Interview overlay: compute speed stats and persist the speed profile,
    // which also derives the (optionally adaptive) budget for the next run.
    if (preset.interview) {
      const budgetMs = perQuestionBudgetMs(preset);
      const sp = speedStats(answered, budgetMs);
      const profile = recordSpeedRun(
        store(),
        board,
        cfg,
        {
          medianSolveMs: sp.medianSolveMs,
          accuracy: rep.accuracy,
          attempted: sp.attempted,
          budgetMs,
          atMs: Date.now(),
        },
        { adaptive: !!preset.adaptive },
      );
      setSpeed(sp);
      setNextBudgetMs(preset.adaptive ? profile.budgetMs : null);
    } else {
      setSpeed(null);
      setNextBudgetMs(null);
    }

    // Weak-Spot Trainer: fold this run's graded (op × shape) attempts back into
    // the persisted history so the NEXT drill over-samples whatever is still weak.
    if (preset.mode === "weakspot") {
      const shapeById = new Map(items.map((i) => [i.id, i.shape]));
      const attempts: WeakSpotAttempt[] = [];
      for (const a of answered) {
        const shape = shapeById.get(a.id);
        if (!shape) continue;
        attempts.push({
          op: a.op as ArenaOp,
          shape,
          correct: a.correct,
          skipped: a.skipped,
        });
      }
      recordWeakSpotAttempts(store(), attempts);
    }

    setPhase("report");

    // Ranked submission (server re-scores; fire-and-forget, never blocks UI).
    // The server independently regrades every value against the SAME
    // deterministic stream, so we send a value that reproduces the client's
    // grade exactly: the stream answer for a correct item, a guaranteed-wrong
    // value for a wrong item, and null for a skip. This keeps the server the
    // authoritative scorer while guaranteeing client/server score parity.
    if (seed !== null && rankedEligible(preset)) {
      const answerById = new Map(items.map((i) => [i.id, i.answer]));
      void submitRankedRun({
        board,
        configHash: cfg,
        seed,
        answers: answered.map((a) => {
          const correctVal = answerById.get(a.id) ?? 0;
          const value = a.skipped
            ? null
            : a.correct
              ? correctVal
              : correctVal + 1;
          return { id: a.id, value, rtMs: a.rtMs };
        }),
        clientElapsedMs: elapsedMs,
      });
    }
  };

  const currentPreset = preset;

  return (
    <div className="relative min-h-[100dvh] bg-bg">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="btn-ghost !px-2 !py-1 text-sm">
            <ChevronLeftIcon width={16} height={16} /> Home
          </Link>
          <span className="label text-accent">Speed Arena</span>
        </div>

        {phase === "pick" && (
          <div className="space-y-6">
            <header>
              <h1 className="font-display text-3xl font-black text-primary">
                Speed Arena
              </h1>
              <p className="mt-1 text-sm text-secondary">
                Timed mental-math drills in the Zetamac / Optiver mold. Reasoning
                stays untimed elsewhere — this is pure speed practice.
              </p>
            </header>
            <PresetPicker onStart={start} />
            {loading && (
              <p className="label text-center text-muted">Preparing run…</p>
            )}
          </div>
        )}

        {phase === "run" && currentPreset && (
          <ArenaRunner
            key={runId}
            items={items}
            preset={currentPreset}
            onFinish={finish}
          />
        )}

        {phase === "report" && report && currentPreset && (
          <div className="space-y-6">
            <PostRunReport
              report={report}
              pb={pb}
              isNewBest={isNewBest}
              trend={trend}
              speed={speed}
              nextBudgetMs={nextBudgetMs}
              onAgain={() => setPhase("pick")}
            />
            <Leaderboard
              board={boardOf(currentPreset)}
              configHash={configHash(currentPreset)}
              pb={pb}
            />
          </div>
        )}
      </div>
    </div>
  );
}
