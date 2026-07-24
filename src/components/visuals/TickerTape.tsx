interface Tick {
  sym: string;
  px: string;
  chg: string;
  up: boolean;
}

const DEFAULT_TICKS: Tick[] = [
  { sym: "P(A∪B)", px: "0.4667", chg: "+0.9%", up: true },
  { sym: "E[HH]", px: "6.00", chg: "+0.0%", up: true },
  { sym: "KELLY.f", px: "0.20", chg: "-1.2%", up: false },
  { sym: "BAYES", px: "0.167", chg: "+3.4%", up: true },
  { sym: "REROLL", px: "4.25", chg: "+0.6%", up: true },
  { sym: "σ(DIE)", px: "1.708", chg: "-0.3%", up: false },
  { sym: "COUPON", px: "14.70", chg: "+1.1%", up: true },
  { sym: "1/e", px: "0.368", chg: "-0.4%", up: false },
  { sym: "ANT.CUBE", px: "10.0", chg: "+2.0%", up: true },
  { sym: "BALLOT", px: "0.250", chg: "-0.8%", up: false },
  { sym: "BIRTHDAY", px: "23", chg: "+0.5%", up: true },
  { sym: "MKT.SPRD", px: "1.20", chg: "-0.9%", up: false },
];

function Segment({ ticks }: { ticks: Tick[] }) {
  return (
    <div className="flex shrink-0 items-center">
      {ticks.map((t, i) => (
        <span key={i} className="flex items-center whitespace-nowrap px-4">
          <span className="text-secondary">{t.sym}</span>
          <span className="ml-2 num text-primary">{t.px}</span>
          <span
            className={`ml-2 num ${t.up ? "text-bull" : "text-bear"}`}
          >
            {t.up ? "▲" : "▼"}
            {t.chg}
          </span>
          <span className="ml-4 text-muted">·</span>
        </span>
      ))}
    </div>
  );
}

export function TickerTape({ ticks = DEFAULT_TICKS }: { ticks?: Tick[] }) {
  return (
    <div
      className="relative overflow-hidden border-y border-subtle bg-surface-muted py-1.5 font-mono text-[11px] font-medium uppercase tracking-wider"
      aria-hidden="true"
    >
      <div className="animate-ticker-scroll flex w-max">
        <Segment ticks={ticks} />
        <Segment ticks={ticks} />
      </div>
    </div>
  );
}
