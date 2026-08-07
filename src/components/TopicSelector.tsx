import type { SVGProps } from "react";
import type { Topic } from "@/lib/topics";

/**
 * TOPIC SELECTOR — the in-page control at the top of a multi-topic track map
 * (the Probability/Math track). It lets the learner jump to ONE topic's path
 * instead of scrolling the whole concatenated route.
 *
 * Each option is labeled `"Level N — <topic>"`, where N is the topic's
 * data-order difficulty rank (see `@/lib/topics`), so the list visibly ramps
 * easiest → hardest as you scroll it.
 *
 * Styling flows entirely through the app's semantic tokens (`.panel-ruled`,
 * `.input`, `.label`, `text-secondary`), so it looks intentional in every
 * theme and stays WCAG-AA legible in light AND dark. A native `<select>` is
 * used deliberately: it is fully keyboard/screen-reader accessible and renders
 * a correctly-themed (via `color-scheme`) native popup on mobile at 360px+.
 */

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export interface TopicSelectorProps {
  /** Topics in difficulty (data) order; `rank` drives the "Level N" label. */
  topics: Topic[];
  /** The slug of the currently-selected topic. */
  selectedSlug: string;
  /** Called with the newly-selected topic slug. */
  onChange: (slug: string) => void;
}

export function TopicSelector({
  topics,
  selectedSlug,
  onChange,
}: TopicSelectorProps) {
  const selected = topics.find((t) => t.slug === selectedSlug) ?? topics[0];

  return (
    <div className="panel-ruled p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <label htmlFor="topic-selector" className="label text-accent">
            Topic · Choose your path
          </label>
          <p className="mt-0.5 text-xs text-secondary">
            Study one topic at a time, ordered easiest to hardest.
          </p>
        </div>

        <div className="relative w-full sm:w-auto sm:min-w-[18rem]">
          <select
            id="topic-selector"
            value={selected?.slug ?? ""}
            onChange={(e) => onChange(e.target.value)}
            className="input w-full cursor-pointer appearance-none pr-10 font-semibold"
            aria-label="Select a topic to study"
          >
            {topics.map((t) => (
              <option key={t.slug} value={t.slug}>
                {`Level ${t.rank}: ${t.label}`}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-secondary" />
        </div>
      </div>
    </div>
  );
}
