import { useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import {
  SIM_GROUPS,
  SIMULATIONS,
  SIM_BY_ID,
  simsInGroup,
  type SimGroupId,
} from "@/lib/simulations/catalog";
import { CoreGroup } from "@/components/simulations/groups/CoreGroup";
import { VennGroup } from "@/components/simulations/groups/VennGroup";
import { DistributionsGroup } from "@/components/simulations/groups/DistributionsGroup";
import { EvGroup } from "@/components/simulations/groups/EvGroup";
import { ProcessesGroup } from "@/components/simulations/groups/ProcessesGroup";
import { GamesGroup } from "@/components/simulations/groups/GamesGroup";
import { StockMarketGroup } from "@/components/simulations/groups/StockMarketGroup";
import { PokerGroup } from "@/components/simulations/groups/PokerGroup";
import { TradingDeskGroup } from "@/components/simulations/groups/TradingDeskGroup";
import { ChartIcon } from "@/components/icons";

/**
 * The Simulations / Visualizations tab (`/simulations`). A themed, token-driven
 * gallery of interactive, seedable probability visualizations. Everything reads
 * its identity from the central `@/lib/simulations/catalog`, so the selector,
 * the section anchors, and the hint-ladder deep links all stay in sync.
 *
 * Rather than a long scroll of every chart, the page presents a single dropdown
 * selector (grouped by `SIM_GROUPS`) and shows ONLY the chosen simulation. All
 * sims stay mounted in the DOM so each keeps its own interactive state and the
 * `<section id>` anchors used by hint-ladder deep links still exist — we simply
 * toggle the Tailwind `hidden` class so exactly one sim is visible at a time.
 */

/** Which group component(s) render each catalog display group, in order. */
const GROUP_COMPONENTS: Record<SimGroupId, (() => JSX.Element)[]> = {
  core: [CoreGroup, VennGroup],
  distributions: [DistributionsGroup],
  "ev-processes": [EvGroup, ProcessesGroup],
  "real-world": [StockMarketGroup, PokerGroup],
  games: [GamesGroup],
  "trading-desk": [TradingDeskGroup],
};

export function SimulationsPage() {
  const { hash } = useLocation();
  const [selectedId, setSelectedId] = useState<string>(SIMULATIONS[0].id);

  // Deep-link support: arriving at `/simulations#<id>` (e.g. from a hint
  // ladder's "open the exact sim" link) selects + shows that specific sim.
  // Runs on mount and whenever the hash changes.
  useLayoutEffect(() => {
    const id = hash.slice(1);
    if (id && SIM_BY_ID[id]) {
      setSelectedId(id);
    }
  }, [hash]);

  // Show only the selected simulation: every sim's <section id> stays mounted
  // (preserving state + anchors) but all except the selected one get the
  // `hidden` class. useLayoutEffect runs before paint, so there's no flash of
  // the full stack on first render or on selection change.
  useLayoutEffect(() => {
    for (const sim of SIMULATIONS) {
      const el = document.getElementById(sim.id);
      if (!el) continue;
      if (sim.id === selectedId) {
        el.classList.remove("hidden");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.add("hidden");
      }
    }
  }, [selectedId]);

  const selectedSim = SIM_BY_ID[selectedId];
  const selectedGroup = SIM_GROUPS.find((g) => g.id === selectedSim.group);

  return (
    <div className="space-y-8">
      {/* Masthead */}
      <header className="panel p-6">
        <div className="flex items-start gap-4">
          <span className="hidden h-12 w-12 place-items-center border border-border-strong text-accent sm:grid">
            <ChartIcon width={26} height={26} />
          </span>
          <div>
            <span className="label text-accent">Interactive · Seedable</span>
            <h1 className="mt-1 font-display text-3xl font-black text-primary sm:text-4xl">
              Simulations &amp; Visualizations
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-secondary">
              Set the parameters, run the trials, and watch probability come to
              life. Every graph shows the empirical result against the true
              theoretical value — drag the trials slider and see the law of large
              numbers pull them together.
            </p>
          </div>
        </div>
      </header>

      {/* Selector — choose exactly one simulation to view */}
      <div className="panel-ruled p-5">
        <label htmlFor="sim-select" className="label text-accent">
          Choose a simulation
        </label>
        <select
          id="sim-select"
          className="input mt-3 w-full"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {SIM_GROUPS.map((group) => (
            <optgroup key={group.id} label={group.title}>
              {simsInGroup(group.id).map((sim) => (
                <option key={sim.id} value={sim.id}>
                  {sim.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <p className="mt-2 text-sm text-secondary">{selectedSim.whatShows}</p>
      </div>

      {/* Heading for the selected sim's group */}
      {selectedGroup ? (
        <div className="border-b-2 border-border-strong pb-2">
          <h2 className="font-display text-2xl font-black text-primary">
            {selectedGroup.title}
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-secondary">
            {selectedGroup.blurb}
          </p>
        </div>
      ) : null}

      {/*
        Stage — all group components stay mounted so every sim keeps its own
        state and its <section id> anchor. The useLayoutEffect above hides all
        but the selected sim's section, so only one is visible at a time.
      */}
      <div id="sim-stage" className="space-y-6">
        {SIM_GROUPS.map((group) =>
          GROUP_COMPONENTS[group.id].map((Group, i) => (
            <Group key={`${group.id}-${i}`} />
          )),
        )}
      </div>
    </div>
  );
}
