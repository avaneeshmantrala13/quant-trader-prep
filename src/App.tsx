import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProgressProvider, useProgress } from "./context/ProgressContext";
import { DevPipelineProvider, useDevPipeline } from "./context/DevPipelineContext";
import { devEffectiveStage } from "./lib/dev/devStage";
import { shouldRedirectToDiagnostic } from "./lib/diagnostic/gate";
import {
  PIPELINE_ENABLED,
  RequirePipelineStage,
  STAGE_PATH,
} from "./components/pipeline/RequirePipelineStage";
import { resolveStage, stageOrder } from "./lib/pipeline/stateMachine";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";

// The guided shell is THE authenticated experience once `PIPELINE_ENABLED` is
// on. Kept lazy so the free-roam initial chunk is unchanged while the flag is
// off (the shell pulls the roadmap projection + every stage screen).
const GuidedShell = lazy(() =>
  import("./components/pipeline/GuidedShell").then((m) => ({
    default: m.GuidedShell,
  })),
);

// Landing / Login / AppShell stay eager: they are on the first-paint path (the
// unauthenticated home + auth screen, and the authenticated layout shell). Every
// other page is code-split with React.lazy so its module — and, crucially, the
// heavy per-track question generators it pulls in — only downloads when the user
// navigates there. This is what keeps the initial JS chunk small.
const TrackPage = lazy(() =>
  import("./pages/TrackPage").then((m) => ({ default: m.TrackPage })),
);
const CourseTrackPage = lazy(() =>
  import("./pages/CourseTrackPage").then((m) => ({
    default: m.CourseTrackPage,
  })),
);
const LessonPage = lazy(() =>
  import("./pages/LessonPage").then((m) => ({ default: m.LessonPage })),
);
const TableOfContentsPage = lazy(() =>
  import("./pages/TableOfContentsPage").then((m) => ({
    default: m.TableOfContentsPage,
  })),
);
const DiagnosticPage = lazy(() =>
  import("./pages/DiagnosticPage").then((m) => ({ default: m.DiagnosticPage })),
);
const SpeedArenaPage = lazy(() =>
  import("./pages/SpeedArenaPage").then((m) => ({ default: m.SpeedArenaPage })),
);
const OaSectionsPage = lazy(() =>
  import("./pages/OaSectionsPage").then((m) => ({ default: m.OaSectionsPage })),
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((m) => ({ default: m.DashboardPage })),
);
const RoadmapPage = lazy(() =>
  import("./pages/RoadmapPage").then((m) => ({ default: m.RoadmapPage })),
);
const SimulationsPage = lazy(() =>
  import("./pages/SimulationsPage").then((m) => ({
    default: m.SimulationsPage,
  })),
);
const FermiPage = lazy(() =>
  import("./pages/FermiPage").then((m) => ({ default: m.FermiPage })),
);
const DrillPage = lazy(() =>
  import("./pages/DrillPage").then((m) => ({ default: m.DrillPage })),
);
const GamesHubPage = lazy(() =>
  import("./pages/GamesHubPage").then((m) => ({ default: m.GamesHubPage })),
);
const MakeMarketPage = lazy(() =>
  import("./pages/MakeMarketPage").then((m) => ({ default: m.MakeMarketPage })),
);
const ProbabilityBettingPage = lazy(() =>
  import("./pages/ProbabilityBettingPage").then((m) => ({
    default: m.ProbabilityBettingPage,
  })),
);
const CardsMarketMakingPage = lazy(() =>
  import("./pages/CardsMarketMakingPage").then((m) => ({
    default: m.CardsMarketMakingPage,
  })),
);
const MarketOfCardsPage = lazy(() =>
  import("./pages/MarketOfCardsPage").then((m) => ({
    default: m.MarketOfCardsPage,
  })),
);
const FruitMarketPage = lazy(() =>
  import("./pages/FruitMarketPage").then((m) => ({
    default: m.FruitMarketPage,
  })),
);
const DiceAndCardsPage = lazy(() =>
  import("./pages/DiceAndCardsPage").then((m) => ({
    default: m.DiceAndCardsPage,
  })),
);
const NextCardBettingPage = lazy(() =>
  import("./pages/NextCardBettingPage").then((m) => ({
    default: m.NextCardBettingPage,
  })),
);
const TradingFloorPage = lazy(() =>
  import("./pages/TradingFloorPage").then((m) => ({
    default: m.TradingFloorPage,
  })),
);
const EvTimedPage = lazy(() =>
  import("./pages/EvTimedPage").then((m) => ({ default: m.EvTimedPage })),
);
const MockPage = lazy(() =>
  import("./pages/MockPage").then((m) => ({ default: m.MockPage })),
);
const ArbitragePage = lazy(() =>
  import("./pages/ArbitragePage").then((m) => ({ default: m.ArbitragePage })),
);
const ReviewPage = lazy(() =>
  import("./pages/ReviewPage").then((m) => ({ default: m.ReviewPage })),
);
const NumberLogicPage = lazy(() =>
  import("./pages/NumberLogicPage").then((m) => ({
    default: m.NumberLogicPage,
  })),
);
const BeatTheOddsPage = lazy(() =>
  import("./pages/BeatTheOddsPage").then((m) => ({
    default: m.BeatTheOddsPage,
  })),
);
const StockmasterPage = lazy(() =>
  import("./pages/StockmasterPage").then((m) => ({
    default: m.StockmasterPage,
  })),
);
const NumberBoxPage = lazy(() =>
  import("./pages/NumberBoxPage").then((m) => ({ default: m.NumberBoxPage })),
);
const ShapeShiftPage = lazy(() =>
  import("./pages/ShapeShiftPage").then((m) => ({ default: m.ShapeShiftPage })),
);

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />;
}

/**
 * Required-once ONBOARDING gate (approved redesign). If the diagnostic has not
 * been completed and the learner is not already on an exempt path (`/diagnostic`
 * / `/login`), redirect to `/diagnostic`. This is NOT a lesson lock — it never
 * touches `locking.ts`, `recordAttempt`, mastery-unlock, or the v1→v2 migration;
 * once `diagnosticDoneAt` is stamped, the learner is never force-routed again.
 */
function RequireDiagnostic({ children }: { children: ReactNode }) {
  const { progress } = useProgress();
  const location = useLocation();
  if (shouldRedirectToDiagnostic(location.pathname, progress.diagnosticDoneAt)) {
    return <Navigate to="/diagnostic" replace />;
  }
  return <>{children}</>;
}

/**
 * The standard authenticated + onboarded gate. Nearly every route needs both
 * `ProtectedRoute` (must be signed in) and `RequireDiagnostic` (must have
 * finished the one-time diagnostic), so this collapses that repeated two-wrapper
 * nesting into one element. `/diagnostic` itself deliberately does NOT use this
 * (it only needs auth — see its route below).
 */
function Guarded({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <RequireDiagnostic>{children}</RequireDiagnostic>
    </ProtectedRoute>
  );
}

/**
 * The `/` entry point. Unauthenticated (or with the pipeline OFF) it is the
 * public marketing landing exactly as before. Once `PIPELINE_ENABLED` is on, a
 * signed-in, past-login user is routed straight into the guided flow at their
 * live resolved stage ({@link resolveStage}) — the guided shell, not the
 * free-roam Home, is their app (cutover runbook §2). Reversible: with the flag
 * off this is a pure pass-through to {@link LandingPage}.
 */
function HomeRoute() {
  const { isAuthed, isDeveloper } = useAuth();
  const { progress } = useProgress();
  const { forcedStage } = useDevPipeline();
  if (PIPELINE_ENABLED && isAuthed) {
    // Honor a developer's forced-stage override so a demo deep-links to the
    // stage it jumped to; real users go to the live gate-derived stage.
    const stage = devEffectiveStage(resolveStage(progress), {
      isDeveloper,
      forcedStage,
    });
    return <Navigate to={STAGE_PATH[stage]} replace />;
  }
  return <LandingPage />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProgressProvider>
          {/* Dev-only pipeline override (demo escape hatch). Inert for real
              users — it exposes a forced stage ONLY for a developer session. */}
          <DevPipelineProvider>
          {/* A single Suspense boundary covers every lazy route. The fallback is
              intentionally minimal — route modules are small and load fast on a
              warm cache; a heavier skeleton would flash more than it helps. */}
          <Suspense fallback={null}>
            <Routes>
              {/* Home: the public marketing landing when signed-out / flag-off;
                  once the guided pipeline is live it redirects a signed-in user
                  to their resolved stage (see HomeRoute). */}
              <Route path="/" element={<HomeRoute />} />
              <Route path="/login" element={<LoginPage />} />

              {/* GUIDED PIPELINE (cutover LIVE). One route per stage, each guarded
                  by auth + the stage router (which redirects a mismatched stage to
                  the resolved one) and rendering the single GuidedShell. This is
                  the sole navigation authority while PIPELINE_ENABLED is true. */}
              {PIPELINE_ENABLED &&
                stageOrder.map((stage) => (
                  <Route
                    key={stage}
                    path={STAGE_PATH[stage]}
                    element={
                      <ProtectedRoute>
                        <RequirePipelineStage stage={stage}>
                          <GuidedShell />
                        </RequirePipelineStage>
                      </ProtectedRoute>
                    }
                  />
                ))}

              {/* ────────────────────────────────────────────────────────────
                  FREE-ROAM ROUTES (spec §7.1 hide-set). Mounted ONLY while the
                  guided pipeline is OFF. The page/engine modules are NEVER
                  deleted — they stay lazy-importable so stage screens reuse them
                  internally (lesson player, mock runner, MM engine, timed-OA
                  engine, …); the cutover merely stops advertising/mounting them
                  as user navigation. Flipping PIPELINE_ENABLED back to false
                  restores this shell verbatim.
                  ──────────────────────────────────────────────────────────── */}
              {!PIPELINE_ENABLED && (
                <>
              {/* Phase-5 mastery + calibration dashboard (own full-screen layout). */}
              <Route
                path="/dashboard"
                element={
                  <Guarded>
                    <DashboardPage />
                  </Guarded>
                }
              />

              {/* Readiness Roadmap — the ordered skill pathway + readiness meter
                  (own full-screen layout, like the Dashboard). Additive. */}
              <Route
                path="/roadmap"
                element={
                  <Guarded>
                    <RoadmapPage />
                  </Guarded>
                }
              />

              {/* Authenticated app shell (track maps) */}
              <Route
                element={
                  <Guarded>
                    <AppShell />
                  </Guarded>
                }
              >
                <Route path="/track/:trackId" element={<TrackPage />} />
                {/* Case-A course curation page (additive; reuses lesson routes). */}
                <Route path="/course/:courseId" element={<CourseTrackPage />} />
                <Route path="/contents" element={<TableOfContentsPage />} />
                {/* Spaced-repetition review surface (T14 retention). In-shell so
                    it carries the standard nav; mode-scoped deck (Case A broad
                    concepts / Case B fact-core). */}
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/simulations" element={<SimulationsPage />} />
                <Route path="/games" element={<GamesHubPage />} />
              </Route>

              {/* Immersive lesson player (its own full-screen layout) */}
              <Route
                path="/track/:trackId/level/:levelId"
                element={
                  <Guarded>
                    <LessonPage />
                  </Guarded>
                }
              />

              {/* Dedicated Fermi estimation drill (its own full-screen layout,
                  self-contained — see FermiPage). */}
              <Route
                path="/fermi"
                element={
                  <Guarded>
                    <FermiPage />
                  </Guarded>
                }
              />

              {/* Custom Drill Builder — chatbot-style drill of EXISTING verified
                  questions (own full-screen layout, self-contained — see
                  DrillPage). Never writes mastery/unlock/resume. */}
              <Route
                path="/drill"
                element={
                  <Guarded>
                    <DrillPage />
                  </Guarded>
                }
              />

              {/* Make Me a Market — market-making game (own full-screen layout,
                  self-contained — see MakeMarketPage). Game 1 of QuantGames. */}
              <Route
                path="/make-market"
                element={
                  <Guarded>
                    <MakeMarketPage />
                  </Guarded>
                }
              />

              {/* Probability Betting — odds/edge/Kelly game (own full-screen
                  layout, self-contained). Game 2 of QuantGames. */}
              <Route
                path="/probability-betting"
                element={
                  <Guarded>
                    <ProbabilityBettingPage />
                  </Guarded>
                }
              />

              {/* Cards Market Making — taker game (own full-screen layout,
                  self-contained). Game 3 of QuantGames. */}
              <Route
                path="/cards-market-making"
                element={
                  <Guarded>
                    <CardsMarketMakingPage />
                  </Guarded>
                }
              />

              {/* Market of Cards — group/super-day maker game (own full-screen
                  layout, self-contained). Game 4 of QuantGames. */}
              <Route
                path="/market-of-cards"
                element={
                  <Guarded>
                    <MarketOfCardsPage />
                  </Guarded>
                }
              />

              {/* Fruit Market — speed mental-math taker game (own full-screen
                  layout, self-contained). Game 5 of QuantGames. */}
              <Route
                path="/fruit-market"
                element={
                  <Guarded>
                    <FruitMarketPage />
                  </Guarded>
                }
              />

              {/* Dice & Cards — multiplicative taker game with an SD pre-question
                  (own full-screen layout, self-contained). Game 6 of QuantGames. */}
              <Route
                path="/dice-and-cards"
                element={
                  <Guarded>
                    <DiceAndCardsPage />
                  </Guarded>
                }
              />

              {/* Next Card Betting — card-counting + Kelly bettor game (own
                  full-screen layout, self-contained). Game 9 of QuantGames. */}
              <Route
                path="/next-card-betting"
                element={
                  <Guarded>
                    <NextCardBettingPage />
                  </Guarded>
                }
              />

              {/* The Trading Floor — flagship adversarial make-a-market mock (own
                  full-screen layout, self-contained — see TradingFloorPage). */}
              <Route
                path="/trading-floor"
                element={
                  <Guarded>
                    <TradingFloorPage />
                  </Guarded>
                }
              />

              {/* EV-under-time decision drill (T4, own full-screen layout). */}
              <Route
                path="/ev-timed"
                element={
                  <Guarded>
                    <EvTimedPage />
                  </Guarded>
                }
              />

              {/* AI-voice Mock Interview (T10, own full-screen layout). */}
              <Route
                path="/mock"
                element={
                  <Guarded>
                    <MockPage />
                  </Guarded>
                }
              />

              {/* No-arbitrage / de-vig reasoning drill (T3, own full-screen layout). */}
              <Route
                path="/arbitrage"
                element={
                  <Guarded>
                    <ArbitragePage />
                  </Guarded>
                }
              />

              {/* Optiver-style Assessment cluster (Zap-N / NumberLogic / Beat
                  the Odds) — cognitive-aptitude drills mimicking Optiver's 2026
                  OA sections. Each is a self-contained, full-screen game. */}
              <Route
                path="/numberlogic"
                element={
                  <Guarded>
                    <NumberLogicPage />
                  </Guarded>
                }
              />
              <Route
                path="/beat-the-odds"
                element={
                  <Guarded>
                    <BeatTheOddsPage />
                  </Guarded>
                }
              />
              <Route
                path="/stockmaster"
                element={
                  <Guarded>
                    <StockmasterPage />
                  </Guarded>
                }
              />
              <Route
                path="/number-box"
                element={
                  <Guarded>
                    <NumberBoxPage />
                  </Guarded>
                }
              />
              <Route
                path="/shape-shift"
                element={
                  <Guarded>
                    <ShapeShiftPage />
                  </Guarded>
                }
              />

              {/* ls-layer routes — phases 3/5/6 append here. `/diagnostic` needs
                  auth only (it IS the diagnostic gate, so RequireDiagnostic would
                  loop) — so it uses ProtectedRoute directly, not Guarded. */}
              <Route
                path="/diagnostic"
                element={
                  <ProtectedRoute>
                    <DiagnosticPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/arena"
                element={
                  <Guarded>
                    <SpeedArenaPage />
                  </Guarded>
                }
              />
              {/* Timed interview/OA practice sections (Case B). Its own
                  full-screen layout like the Speed Arena; wall-clock timed +
                  cross-session resumable (see src/lib/oa/*). */}
              <Route
                path="/oa"
                element={
                  <Guarded>
                    <OaSectionsPage />
                  </Guarded>
                }
              />
                </>
              )}

              {/* Catch-all: unknown URLs go to `/`. With the pipeline live and a
                  user signed in, HomeRoute then forwards them to their resolved
                  stage — so no free-roam URL is reachable by hand. */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
          </DevPipelineProvider>
        </ProgressProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
