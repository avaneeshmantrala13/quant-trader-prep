/**
 * FloorGroup — the Simulations "Trading Desk" card that introduces THE TRADING
 * FLOOR as the interactive, LIVE sibling of the (policy-tuned) desk simulators
 * and links out to the full-screen `/trading-floor` experience.
 *
 * Unlike the other desk sims (which recompute a whole run from a policy), the
 * Floor is a hands-on, round-by-round make-a-market game with an adversarial
 * counterparty and a calibration debrief. This card is intentionally decoupled
 * from the sim catalog: its copy is hardcoded and it only depends on `SimCard`
 * + the route, so it can't break when the catalog changes.
 */
import { Link } from "react-router-dom";
import { SimCard } from "@/components/simulations/SimCard";

export function FloorGroup(): JSX.Element {
  return (
    <SimCard
      id="trading-floor-live"
      title="The Trading Floor: play it live"
      whatShows="An adversarial, round-by-round make-a-market game: quote a two-sided market on a hidden quantity revealed a step at a time, get picked off when your price is wrong, and beat the honest desk on the same flow."
      topics={["market making", "adverse selection", "calibration", "inventory skew"]}
      howToRead="The desk sims above let you tune a policy and watch a whole run replay. The Trading Floor puts YOU in the seat instead: every round you post a mid, half-spread, skew, and size under a shot clock while an informed-with-noise counterparty trades against you. Uninformed flow pays your spread; informed flow only trades when you're on the wrong side of fair. Finish for a full debrief: your P&L vs the desk, drawdown, pick-offs, and (for the 0/1 packs) a reliability diagram, since your mid IS your probability and honest calibration is the P&L-maximizing play."
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Feature title="Quote under a clock">
            Post mid / half-spread / skew / size each round; time out and you
            auto-stand-aside.
          </Feature>
          <Feature title="Get picked off">
            An informed counterparty only trades when your price is wrong; read
            the flow and recentre.
          </Feature>
          <Feature title="Calibration debrief">
            Binary packs score your mids as probabilities on a reliability
            diagram: minimizing Brier maximizes P&amp;L.
          </Feature>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-subtle pt-4">
          <p className="text-sm text-secondary">
            A full-screen, hands-on session with three difficulties and a live
            you-vs-desk scorecard.
          </p>
          <Link to="/trading-floor" className="btn-primary shrink-0">
            Enter the floor →
          </Link>
        </div>
      </div>
    </SimCard>
  );
}

function Feature({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <div className="border-l-2 border-accent bg-surface-muted px-3 py-2.5">
      <div className="label text-accent">{title}</div>
      <p className="mt-1 text-[13px] leading-snug text-secondary">{children}</p>
    </div>
  );
}
