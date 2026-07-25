import type { NaturalFrequencyTree } from "@/lib/tutor/naturalFrequency";

/**
 * Thin view for a natural-frequency tree (Gigerenzer & Hoffrage 1995). Renders
 * the branch counts out of `total` and shows the final Bayes ratio with the
 * division LEFT BLANK — the learner performs the last step (answer-withholding).
 * No logic lives here; all arithmetic comes from `naturalFrequencyTree(...)`.
 */
export function NaturalFreqTree({ tree }: { tree: NaturalFrequencyTree }) {
  return (
    <div className="panel-ruled p-4">
      <div className="label text-accent">Natural frequencies</div>
      <p className="mt-1 text-sm text-secondary">
        Imagine {tree.total.toLocaleString("en-US")} people. Follow the counts:
      </p>
      <div className="mt-3 grid gap-2">
        {tree.branches.map((b) => (
          <div
            key={b.label}
            className="flex items-center justify-between border border-subtle bg-surface px-3 py-2"
          >
            <span className="text-sm text-primary">
              {b.count.toLocaleString("en-US")} {b.label}
            </span>
            <span className="num text-sm font-semibold text-accent">
              → {b.positive.toLocaleString("en-US")} test positive
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 border-t border-subtle pt-2">
        <span className="label">Which two counts do you divide?</span>
        <div className="num mt-1 text-lg font-semibold text-primary">
          {tree.finalRatioBlank} = ?
        </div>
      </div>
    </div>
  );
}
