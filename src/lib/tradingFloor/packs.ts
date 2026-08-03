/**
 * THE TRADING FLOOR — the rankable scenario packs. Each pack builds a fresh
 * scenario from a seed (procedural packs are seed-infinite; the Fermi pack
 * rotates through the numerically-verified `FERMI_ITEMS` bank).
 */
import type { Rng } from "@/lib/rng";
import { FERMI_ITEMS } from "@/content/fermi/items";
import { diceBinaryScenario, diceQuantityScenario } from "./scenarios/dice";
import { fermiScenario } from "./scenarios/fermi";
import type { ScenarioPack } from "./types";

/** Fermi items with a tractable number of reveal steps (3–6 factors). */
const FERMI_POOL = FERMI_ITEMS.filter(
  (it) => it.factors.length >= 3 && it.factors.length <= 6,
);

export const SCENARIO_PACKS: ScenarioPack[] = [
  {
    id: "over-under",
    title: "Over / Under",
    blurb:
      "Price a 0/1 contract on whether a running dice total clears a line — the calibration core, where your mid is your probability.",
    kind: "binary",
    build: () => diceBinaryScenario(8),
  },
  {
    id: "running-total",
    title: "Running Total",
    blurb:
      "Make a market on the final total of a dice roll revealed pip by pip — quote the mean, size your spread to the remaining variance.",
    kind: "quantity",
    build: () => diceQuantityScenario(8),
  },
  {
    id: "fermi-desk",
    title: "Fermi Desk",
    blurb:
      "Price a real Fermi quantity as its decomposition is revealed factor by factor — a live estimation market.",
    kind: "quantity",
    build: (rng: Rng) => fermiScenario(rng.pick(FERMI_POOL)),
  },
];

/** Look up a pack by id (defaults to the calibration-core Over/Under pack). */
export function packById(id: string): ScenarioPack {
  return SCENARIO_PACKS.find((p) => p.id === id) ?? SCENARIO_PACKS[0];
}
