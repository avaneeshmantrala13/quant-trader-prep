import { useMemo } from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useProgress } from "@/context/ProgressContext";
import { useTheme } from "@/context/ThemeContext";
import { getTrack } from "@/content";
import { DIFFICULTY_META, totalQuestions, type Level } from "@/types/content";
import { CheckIcon, LockIcon, MOTIF_ICON } from "@/components/icons";
import { levelLockState, type LockState } from "@/lib/locking";
import { seedUnlockedLevelIds } from "@/lib/mastery/unlockGraph";
import { firstIncompleteTopic, groupLevelsIntoTopics } from "@/lib/topics";
import { TopicSelector } from "@/components/TopicSelector";

type NodeState = LockState;

const ROW_H = 138;
const AMP = 32;
// Extra vertical room inserted above the first node of each labeled `section`,
// used to host a section-divider banner between segments. Zero effect on tracks
// whose levels carry no `section` (i.e. every track except Probability / Math).
const SECTION_GAP = 92;

export function TrackPage() {
  const { trackId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getLevelProgress, getResume, getTopicMastery } = useProgress();
  const { themeDef } = useTheme();

  const track = trackId ? getTrack(trackId) : undefined;

  const isMastered = (id: string) => !!getLevelProgress(id)?.mastered;

  // Diagnostic low-confidence unlocks (Part B): open a whole topic ahead of
  // mastery when its Beta mean is over the unlock bar; re-locks live on a swing.
  const seedUnlocked = useMemo(() => {
    const set = track
      ? seedUnlockedLevelIds(track.levels, track.id, getTopicMastery)
      : new Set<string>();
    return (id: string) => set.has(id);
    // getTopicMastery derives from progress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track, getTopicMastery]);

  // Data-driven topics: maximal contiguous runs of levels sharing a `section`,
  // in data (= difficulty) order. A track with 0/1 topics (Mental Math etc.)
  // renders normally with no selector.
  const topics = useMemo(
    () => (track ? groupLevelsIntoTopics(track.levels) : []),
    [track],
  );
  const hasSelector = topics.length > 1;

  // Resolve the topic to show. An explicit `?topic=` selection wins (persists
  // across navigation); otherwise default to the learner's current in-progress
  // topic — the earliest topic that still has an unmastered level.
  const topicParam = searchParams.get("topic");
  const defaultTopic = useMemo(
    () =>
      track
        ? firstIncompleteTopic(topics, (i) => isMastered(track.levels[i].id))
        : undefined,
    // isMastered is derived from progress via getLevelProgress.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [track, topics, getLevelProgress],
  );
  const selectedTopic =
    (hasSelector && topicParam
      ? topics.find((t) => t.slug === topicParam)
      : undefined) ?? defaultTopic;

  // Build the positioned nodes. When a selector is active we render ONLY the
  // selected topic's contiguous run, re-based to the top of the board so the
  // page height is bounded to a single topic; otherwise the whole track. Either
  // way we walk the visible levels accumulating an extra vertical offset at each
  // new labeled `section` (room for the divider banner). `localI` positions the
  // node on the (possibly shorter) board; the GLOBAL index `i` drives the node
  // number and the per-section locking so both stay exactly as before.
  const nodes = useMemo(() => {
    if (!track) return [];
    const start = hasSelector && selectedTopic ? selectedTopic.startIndex : 0;
    const end =
      hasSelector && selectedTopic
        ? selectedTopic.endIndex
        : track.levels.length - 1;
    let extra = 0;
    const out: {
      level: Level;
      i: number;
      localI: number;
      sectionStart: boolean;
      x: number;
      y: number;
    }[] = [];
    for (let g = start; g <= end; g++) {
      const localI = g - start;
      const level = track.levels[g];
      const prevSection = localI > 0 ? track.levels[g - 1].section : undefined;
      const sectionStart = !!level.section && level.section !== prevSection;
      if (sectionStart) extra += SECTION_GAP;
      out.push({
        level,
        i: g,
        localI,
        sectionStart,
        x: 50 + AMP * Math.sin(localI * 0.9),
        y: localI * ROW_H + ROW_H / 2 + extra,
      });
    }
    return out;
  }, [track, hasSelector, selectedTopic]);

  if (!track) return <Navigate to="/" replace />;
  if (track.comingSoon) return <Navigate to="/" replace />;

  // Persist the selection in the URL (`?topic=`), preserving other params.
  const handleSelectTopic = (slug: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("topic", slug);
    setSearchParams(next, { replace: true });
  };

  // Per-section progression: a level is unlocked when it is the first level of
  // its section OR the previous level *within the same section* is mastered
  // (see `@/lib/locking`). Locking is scoped per topic, not per whole track.
  const stateFor = (_level: Level, index: number): NodeState =>
    levelLockState(track.levels, index, isMastered, seedUnlocked);

  // Base height plus the extra room reserved for every section divider (the
  // last node sits ROW_H/2 above the bottom, so this stays exact).
  const totalHeight =
    nodes.length > 0 ? nodes[nodes.length - 1].y + ROW_H / 2 : 0;
  const MapBg = themeDef.MapBackground;
  const Icon = MOTIF_ICON[track.motif];
  const masteredCount = track.levels.filter((l) => isMastered(l.id)).length;

  return (
    <div className="space-y-5">
      {/* Section header */}
      <header className="panel-ruled p-5">
        <div className="flex items-start gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center border border-border-strong text-primary">
            <Icon width={26} height={26} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="label text-accent">Section · The Route</span>
            <h1 className="mt-0.5 font-display text-2xl font-black text-primary sm:text-3xl">
              {track.title}
            </h1>
            <p className="mt-1 text-sm text-secondary">{track.description}</p>
          </div>
          <div className="hidden flex-col items-end sm:flex">
            <span className="label text-[9px]">Subtopics Passed</span>
            <span className="num text-2xl font-semibold text-primary">
              {masteredCount}/{track.levels.length}
            </span>
          </div>
        </div>
      </header>

      {/* Topic selector — only on multi-topic tracks (Probability/Math). Lets
          the learner study one topic's path at a time instead of scrolling the
          full concatenated route. */}
      {hasSelector && selectedTopic && (
        <TopicSelector
          topics={topics}
          selectedSlug={selectedTopic.slug}
          onChange={handleSelectTopic}
        />
      )}

      {/* Charted route on plotting paper */}
      <div className="panel overflow-hidden">
        <div
          className={`relative ${MapBg ? "" : "tex-grid"}`}
          style={{ height: totalHeight }}
        >
          {/* Themed board background (behind path/nodes); falls back to the
              plotting-paper grid above when a theme omits MapBackground. */}
          {MapBg && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            >
              <MapBg />
            </div>
          )}

          {/* Plotted connectors, colored by state */}
          <svg
            className="absolute inset-0 z-10 h-full w-full"
            viewBox={`0 0 100 ${totalHeight}`}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {nodes.slice(0, -1).map((n, i) => {
              const next = nodes[i + 1];
              const st = stateFor(n.level, n.i);
              const color =
                st === "mastered"
                  ? "rgb(var(--color-bull))"
                  : st === "unlocked"
                    ? "rgb(var(--color-accent))"
                    : "rgb(var(--color-border-strong))";
              const dashed = st === "locked";
              return (
                <line
                  key={i}
                  x1={n.x}
                  y1={n.y}
                  x2={next.x}
                  y2={next.y}
                  stroke={color}
                  strokeWidth={2}
                  strokeDasharray={dashed ? "2 5" : undefined}
                  strokeOpacity={dashed ? 0.6 : 0.9}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </svg>

          {/* Section-divider banners: a centered, token-styled label between
              segments whenever `section` changes. Sits in the extra gap
              reserved above each segment's first node, so the numbered path
              stays continuous (this is a header, not a renumber). Only appears
              on tracks whose levels carry a `section` (Probability / Math). */}
          {nodes.map((n) =>
            n.sectionStart ? (
              <div
                key={`section-${n.level.id}`}
                className="absolute inset-x-0 z-20 flex items-center gap-3 px-4 sm:px-8"
                style={{
                  top: n.y - (ROW_H + SECTION_GAP) / 2,
                  transform: "translateY(-50%)",
                }}
              >
                <span
                  aria-hidden="true"
                  className="h-px flex-1 bg-border-strong opacity-50"
                />
                <span className="label whitespace-nowrap border border-border-strong bg-surface px-3 py-1 text-accent">
                  {n.level.section}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px flex-1 bg-border-strong opacity-50"
                />
              </div>
            ) : null,
          )}

          {nodes.map(({ level, i, localI, x, y }) => {
            const state = stateFor(level, i);
            const prog = getLevelProgress(level.id);
            const resume = getResume(level.id);
            const clickable = state !== "locked";
            const lockReason =
              i > 0 ? `Master “${track.levels[i - 1].title}” first` : "";
            // Active theme's per-node "station" decoration (falls back to the
            // plain node when a theme omits the hook / returns null).
            const Station = themeDef.getMapStation?.({
              trackId: track.id,
              levelId: level.id,
              levelIndex: i,
              motif: track.motif,
            });

            return (
              <div
                key={level.id}
                className="absolute z-20 flex flex-col items-center"
                style={{
                  left: `${x}%`,
                  top: y,
                  transform: "translate(-50%, -50%)",
                  width: 210,
                  maxWidth: "72vw",
                }}
              >
                <div className="relative flex items-center justify-center">
                  {Station && (
                    <div
                      aria-hidden="true"
                      data-station={level.id}
                      className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2"
                      style={{ width: 116, height: 116 }}
                    >
                      <Station state={state} className="h-full w-full" />
                    </div>
                  )}
                  <button
                    disabled={!clickable}
                    onClick={() =>
                      navigate(`/track/${track.id}/level/${level.id}`)
                    }
                    title={state === "locked" ? lockReason : level.title}
                    aria-label={`${level.title}: ${state}`}
                    className={[
                      "animate-node-pop relative z-10 grid h-[68px] w-[68px] place-items-center border-2 font-mono text-lg font-semibold transition-transform",
                      state === "mastered"
                        ? "border-bull bg-bull text-bg"
                        : state === "unlocked"
                          ? "border-accent bg-surface text-accent hover:scale-105"
                          : "cursor-not-allowed border-subtle bg-surface-muted text-muted",
                    ].join(" ")}
                    style={{ animationDelay: `${localI * 60}ms` }}
                  >
                    {state === "mastered" ? (
                      <CheckIcon width={30} height={30} />
                    ) : state === "locked" ? (
                      <LockIcon width={24} height={24} />
                    ) : (
                      <span>{String(i + 1).padStart(2, "0")}</span>
                    )}
                    {state === "unlocked" && (
                      <span className="absolute -right-1.5 -top-1.5 h-3 w-3 animate-blink bg-accent" />
                    )}
                    {state === "mastered" && (
                      <span className="label absolute -bottom-2 bg-bull px-1 text-[8px] text-bg">
                        Mastered
                      </span>
                    )}
                  </button>
                </div>

                <div className="mt-3 w-full text-center">
                  <div className="truncate font-display text-sm font-semibold text-primary">
                    {level.title}
                  </div>
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <span className="chip border-subtle text-secondary">
                      {DIFFICULTY_META[level.difficulty].label}
                    </span>
                    <span className="num text-[11px] text-muted">
                      {totalQuestions(level)}Q
                    </span>
                  </div>
                  {resume && state !== "mastered" && (
                    <span className="chip mt-1 border-accent text-accent">
                      Resume
                    </span>
                  )}
                  {prog && prog.bestScore > 0 && (
                    <div className="num mt-1 text-[11px] text-secondary">
                      Best {Math.round(prog.bestScore * 100)}%
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
