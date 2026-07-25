import type {
  DashboardTopicEntry,
  DashboardViewProps,
} from "@/themes/types";
import {
  describeMisconception,
  topicDisplayName,
} from "@/lib/dashboard/misconceptionLabels";
import type { DashboardModel, DashboardTopic } from "./useDashboardData";

/**
 * Pure mapper: DETERMINISTIC Phase-1 dashboard model → the theme-agnostic
 * `DashboardViewProps` every theme's `Dashboard` renderer consumes.
 *
 * This is where raw misconception KEYS become SHORT, human-readable labels
 * (via `describeMisconception`) and topics get nice display names — so no theme
 * ever sees a raw key. It builds every route through the injected link helpers,
 * keeping theme components pure presentational consumers (no routing, no math).
 * No state, no I/O — same model + links → same props.
 */

export interface DashboardLinks {
  /** Deep-link to practice a topic (its first level). */
  practiceHref: (trackId: string, levelId: string) => string;
  /** Route to the calibration warm-up (diagnostic). */
  diagnosticHref: string;
  /** Route back to the Table of Contents. */
  contentsHref: string;
}

function toEntry(t: DashboardTopic, links: DashboardLinks): DashboardTopicEntry {
  const v = t.verdict;
  const name = topicDisplayName(t.topicKey, t.label);
  return {
    topicKey: t.topicKey,
    name,
    trackTitle: t.trackTitle,
    verdict: v.state,
    hasEvidence: v.n > 0,
    mean: v.mean,
    ciLow: v.lo,
    ciHigh: v.hi,
    theta: v.theta,
    gradedCount: v.n,
    reviewDue: !!v.reviewDue,
    misconceptions: v.namedMisconceptions.map((key) => ({
      key,
      label: describeMisconception(key, { topicName: name }),
    })),
    href: links.practiceHref(t.trackId, t.firstLevelId),
  };
}

/** Build the full `DashboardViewProps` from the model + route helpers. */
export function buildDashboardViewProps(
  model: DashboardModel,
  links: DashboardLinks,
): DashboardViewProps {
  const rec = model.recommended;
  return {
    diagnosticDone: model.diagnosticDone,
    diagnosticHref: links.diagnosticHref,
    contentsHref: links.contentsHref,
    recommended: rec
      ? {
          topicKey: rec.topicKey,
          name: topicDisplayName(rec.topicKey, rec.label),
          trackTitle: rec.trackTitle,
          ciLow: rec.verdict.lo,
          href: links.practiceHref(rec.trackId, rec.firstLevelId),
        }
      : undefined,
    topics: model.topics.map((t) => toEntry(t, links)),
    weaknesses: model.weaknesses.map((t) => toEntry(t, links)),
    due: model.due.map((t) => toEntry(t, links)),
    reliability: model.reliability,
  };
}
