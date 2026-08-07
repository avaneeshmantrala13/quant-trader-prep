import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  GAMES,
  DIFFICULTY_ORDER,
  type GameMeta,
  type GameIconKey,
  type GameDifficulty,
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
 * GAMES HUB (`/games`) — one calm page that lists every game, grouped from
 * easiest to hardest so a first-time visitor can start at the top and know
 * exactly what each game asks them to do.
 *
 * Tiles read their identity from the pure `@/lib/games/catalog`, so the page
 * stays in sync as games are added. Everything is token-styled so it works
 * across every theme in light + dark.
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

/** Plain-English, first-timer-friendly framing for each difficulty tier. */
const GROUP_BLURB: Record<GameDifficulty, string> = {
  "Warm-up": "Quick, easy games to get started.",
  Core: "The main skills quant interviews test.",
  Advanced: "Tougher games once you're warmed up.",
};

export function GamesHubPage() {
  // Group games easiest → hardest so the page reads as a ramp.
  const groups = useMemo(
    () =>
      DIFFICULTY_ORDER.map((d) => ({
        difficulty: d,
        games: GAMES.filter((g) => g.difficulty === d),
      })).filter((grp) => grp.games.length > 0),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      {/* Intro */}
      <header className="space-y-3">
        <h1 className="font-display text-3xl font-semibold text-primary sm:text-4xl">
          Quant Games
        </h1>
        <p className="max-w-xl text-[15px] leading-relaxed text-secondary">
          Short, hands-on games that build the skills quant interviews test.
          Every round is fresh, so there's nothing to memorize — just pick one
          and play.
        </p>
      </header>

      {/* Grouped gallery, easiest first */}
      {groups.map((grp) => (
        <section key={grp.difficulty} className="space-y-4">
          <div className="space-y-0.5">
            <h2 className="font-display text-xl font-semibold text-primary">
              {grp.difficulty}
            </h2>
            <p className="text-sm text-muted">{GROUP_BLURB[grp.difficulty]}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grp.games.map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function GameCard({ game }: { game: GameMeta }) {
  const navigate = useNavigate();
  const Icon = ICONS[game.icon];

  return (
    <button
      onClick={() => navigate(game.to)}
      className="panel group flex h-full flex-col p-5 text-left transition-all hover:-translate-y-0.5 hover:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="grid h-10 w-10 place-items-center border border-border-strong text-accent transition-colors group-hover:bg-accent group-hover:text-accent-contrast">
        <Icon width={20} height={20} />
      </span>

      <h3 className="mt-4 font-display text-lg font-semibold leading-tight text-primary">
        {game.title}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-secondary">
        {game.tagline}
      </p>

      <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-semibold text-accent transition-transform group-hover:translate-x-0.5">
        Play →
      </span>
    </button>
  );
}
