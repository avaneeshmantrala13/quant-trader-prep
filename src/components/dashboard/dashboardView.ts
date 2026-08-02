import type {
  CourseReadiness,
  CourseReadinessTopic,
  DashboardTopicEntry,
  DashboardViewProps,
} from "@/themes/types";
import {
  describeMisconception,
  topicDisplayName,
} from "@/lib/dashboard/misconceptionLabels";
import { COURSES } from "@/lib/mode/courseMap";
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
  /** Route to a course curation page (`/course/:id`). */
  courseHref: (courseId: string) => string;
}

/**
 * Build the Case-A per-course readiness cards from the model's topic verdicts.
 * Pure: reuses the topic-level mastered signal (CI_low ≥ bar), restricted to the
 * course's topicKeys. Only PRIMARY topics count toward the % (shared/upstream
 * topics are listed but not double-counted).
 */
function buildCourses(
  model: DashboardModel,
  links: DashboardLinks,
): CourseReadiness[] {
  const byKey = new Map(model.topics.map((t) => [t.topicKey, t]));
  return COURSES.map((course) => {
    const sharedSet = new Set(course.sharedTopicKeys);
    const rows: CourseReadinessTopic[] = [];
    for (const topicKey of [...course.topicKeys, ...course.sharedTopicKeys]) {
      const t = byKey.get(topicKey);
      if (!t) continue;
      const name = topicDisplayName(t.topicKey, t.label);
      rows.push({
        topicKey,
        name,
        verdict: t.verdict.state,
        hasEvidence: t.verdict.n > 0,
        mastered: t.verdict.mastered,
        shared: sharedSet.has(topicKey),
        href: links.practiceHref(t.trackId, t.firstLevelId),
      });
    }
    const primary = rows.filter((r) => !r.shared);
    const masteredCount = primary.filter((r) => r.mastered).length;
    const totalCount = primary.length;
    const next = primary.find((r) => !r.mastered);
    return {
      id: course.id,
      label: course.label,
      blurb: course.blurb,
      href: links.courseHref(course.id),
      masteredCount,
      totalCount,
      pct: totalCount > 0 ? masteredCount / totalCount : 0,
      nextTopic: next ? { name: next.name, href: next.href } : undefined,
      topics: rows,
    };
  });
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
    goalMode: model.goalMode,
    // Course-readiness cards are only meaningful in Case A; keep the array empty
    // in Case B so the mode branch never accidentally shows them.
    courses: model.goalMode === "course" ? buildCourses(model, links) : [],
    hasTimingData: model.hasTimingData,
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
