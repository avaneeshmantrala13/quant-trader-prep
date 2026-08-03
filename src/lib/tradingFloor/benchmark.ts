/**
 * THE TRADING FLOOR — the honest benchmark desk.
 *
 * "Beat the desk" means "quote at least as calibrated as the reference maker."
 * The desk runs the HONEST policy — `mid = textbook fair`, `half = posterior sd`
 * — against the IDENTICAL recorded counterparty stream (the basketball
 * twin-stream pattern), so the comparison isolates skill from luck. Because it
 * quotes the true fair, it is only ever picked off when the informed bot's noisy
 * edge exceeds its posterior half-spread — a high bar for the human to match.
 */
import { makerQuote, resolveFill } from "@/lib/simulations/liveMarket";
import type { FloorConfig, RoundRecord } from "./types";

/** Cumulative benchmark P&L after each recorded round (size-1 honest desk). */
export function benchmarkPnl(
  records: RoundRecord[],
  config: FloorConfig,
): number[] {
  const skew = config.benchSkew ?? 0;
  const noiseMaxHalf = config.bot.noiseMaxHalf;
  let cash = 0;
  let inventory = 0;
  const pnl: number[] = [];
  for (const rec of records) {
    const quote = makerQuote(rec.fairNow, inventory, {
      halfSpread: rec.posteriorSd,
      skew,
    });
    const fill = resolveFill(quote, rec.fairForFill, rec.noise, noiseMaxHalf);
    if (fill.side === "userSells") {
      cash += fill.price;
      inventory -= 1;
    } else if (fill.side === "userBuys") {
      cash -= fill.price;
      inventory += 1;
    }
    pnl.push(cash + inventory * rec.markFair);
  }
  return pnl;
}
