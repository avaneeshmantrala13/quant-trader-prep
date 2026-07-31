import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GAMES,
  DIFFICULTY_ORDER,
  type GameMeta,
  type GameIconKey,
  type GameDifficulty,
  type GameRole,
} from "@/lib/games/catalog";
import {
  CandlestickIcon,
  GaugeIcon,
  CardsIcon,
  DiceIcon,
  SigmaIcon,
  BrainIcon,
  BoltIcon,
} from "@/components/icons";

/**
 * GAMES HUB (`/games`) — one section, every game, pick and play.
 *
 * Consolidates what used to be a nav entry per game into a single themed
 * gallery. Tiles read their identity from the pure `@/lib/games/catalog`, so
 * the picker stays in sync as games are added. A role filter lets the learner
 * jump straight to the seat they want to practise (Maker / Taker / Bettor /
 * Estimator); everything is token-styled so it works across every theme in
 * light + dark.
 */

const ICONS: Record<GameIconKey, (p: { width: number; height: number }) => JSX.Element> = {
  candlestick: (p) => <CandlestickIcon {...p} />,
  gauge: (p) => <GaugeIcon {...p} />,
  cards: (p) => <CardsIcon {...p} />,
  dice: (p) => <DiceIcon {...p} />,
  sigma: (p) => <SigmaIcon {...p} />,
  brain: (p) => <BrainIcon {...p} />,
  bolt: (p) => <BoltIcon {...p} />,
};

const ROLE_TONE: Record<GameRole, string> = {
  Maker: "border-accent text-accent",
  Taker: "border-accent-2 text-accent-2",
  Bettor: "border-bull text-bull",
  Estimator: "border-bear text-bear",
};

const DIFFICULTY_TONE: Record<GameDifficulty, string> = {
  "Warm-up": "text-bull",
  Core: "text-accent",
  Advanced: "text-bear",
};

type Filter = "all" | GameRole;
const FILTERS: Filter[] = ["all", "Maker", "Taker", "Bettor", "Estimator"];

export function GamesHubPage() {
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => (filter === "all" ? GAMES : GAMES.filter((g) => g.role === filter)),
    [filter],
  );

  // Group the visible games by difficulty so the gallery reads warm-up → core →
  // advanced, mirroring how a learner should ramp.
  const groups = useMemo(
    () =>
      DIFFICULTY_ORDER.map((d) => ({
        difficulty: d,
        games: visible.filter((g) => g.difficulty === d),
      })).filter((grp) => grp.games.length > 0),
    [visible],
  );

  return (
    <div className="space-y-8">
      {/* Masthead */}
      <header className="panel p-6">
        <div className="flex items-start gap-4">
          <span className="hidden h-12 w-12 place-items-center border border-border-strong text-accent sm:grid">
            <DiceIcon width={26} height={26} />
          </span>
          <div>
            <span className="label text-accent">Superday Games · Play to learn</span>
            <h1 className="mt-1 font-display text-3xl font-black text-primary sm:text-4xl">
              Interview Games
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
              The market-making, betting and estimation games from real quant
              superdays — rebuilt to teach. Every game deals fresh and randomised,
              so there's nothing to memorise: only the method transfers. Pick a
              seat and play.
            </p>
          </div>
        </div>
      </header>

      {/* Role filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="label mr-1 text-muted">Seat</span>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`chip transition-colors ${
              filter === f
                ? "border-accent bg-accent text-accent-contrast"
                : "border-subtle text-secondary hover:border-accent hover:text-primary"
            }`}
          >
            {f === "all" ? "All games" : f}
          </button>
        ))}
      </div>

      {/* Grouped gallery */}
      {groups.map((grp) => (
        <section key={grp.difficulty} className="space-y-4">
          <div className="flex items-center gap-3 border-b-2 border-border-strong pb-2">
            <h2 className={`font-display text-xl font-black ${DIFFICULTY_TONE[grp.difficulty]}`}>
              {grp.difficulty}
            </h2>
            <span className="num text-xs text-muted">
              {grp.games.length} {grp.games.length === 1 ? "game" : "games"}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grp.games.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      ))}

      {visible.length === 0 && (
        <p className="panel-ruled p-6 text-center text-sm text-secondary">
          No games for that seat yet.
        </p>
      )}
    </div>
  );
}

function GameCard({ game }: { game: GameMeta }) {
  const navigate = useNavigate();
  const Icon = ICONS[game.icon];

  return (
    <button
      onClick={() => navigate(game.to)}
      className="panel-ruled group flex h-full flex-col p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center border border-border-strong text-accent transition-colors group-hover:bg-accent group-hover:text-accent-contrast">
          <Icon width={20} height={20} />
        </span>
        <span className={`chip ${ROLE_TONE[game.role]}`}>{game.role}</span>
      </div>

      <h3 className="mt-3 font-display text-lg font-semibold leading-tight text-primary">
        {game.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-snug text-secondary">{game.tagline}</p>

      <ul className="mt-3 space-y-1.5">
        {game.highlights.map((h, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-snug text-muted">
            <span aria-hidden="true" className="text-accent">·</span>
            <span>{h}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex items-center justify-between border-t border-subtle pt-3">
        <span className="label text-[9px] text-muted">{game.skill}</span>
        <span className="label text-[10px] text-accent transition-transform group-hover:translate-x-0.5">
          Play →
        </span>
      </div>
    </button>
  );
}
