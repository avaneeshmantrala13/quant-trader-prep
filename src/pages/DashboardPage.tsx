import { useMemo } from "react";
import { useTheme } from "@/context/ThemeContext";
import { useDashboardData } from "@/components/dashboard/useDashboardData";
import { buildDashboardViewProps } from "@/components/dashboard/dashboardView";
import { BaseDashboard } from "@/themes/BaseDashboard";
import { OaTimingPanel } from "@/components/oa/OaTimingPanel";
import { SrsReviewPanel } from "@/components/dashboard/SrsReviewPanel";
import { RemediationGuidancePanel } from "@/components/dashboard/RemediationGuidancePanel";

/**
 * `/dashboard` — the Phase-5 mastery + calibration dashboard (PHASE_5 §6), now a
 * thin CONTAINER that owns all data + routes and delegates rendering to the
 * active theme (mirroring the Table-of-Contents theming pattern). It reads a
 * READ-ONLY view over deterministic Phase-1 state via `useDashboardData`, maps
 * it to the theme-agnostic `DashboardViewProps` (resolving friendly misconception
 * labels + building every route), then renders `activeTheme.Dashboard` if the
 * theme provides one, else the shared `BaseDashboard`. No mastery math, locking,
 * or state mutation happens here — it stays fully functional with every flag OFF.
 */
export function DashboardPage() {
  // One stable `now` per mount so review-due checks don't flicker across renders.
  const now = useMemo(() => new Date().toISOString(), []);
  const model = useDashboardData(now);
  const { themeDef } = useTheme();

  const props = useMemo(
    () =>
      buildDashboardViewProps(model, {
        practiceHref: (trackId, levelId) =>
          `/track/${trackId}/level/${levelId}`,
        diagnosticHref: "/diagnostic",
        contentsHref: "/contents",
        courseHref: (courseId) => `/course/${courseId}`,
      }),
    [model],
  );

  const ThemeDashboard = themeDef.Dashboard ?? BaseDashboard;
  return (
    <>
      <ThemeDashboard {...props} />
      <RemediationGuidancePanel />
      <SrsReviewPanel />
      <OaTimingPanel />
    </>
  );
}
