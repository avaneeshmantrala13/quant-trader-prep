import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProgressProvider, useProgress } from "./context/ProgressContext";
import { shouldRedirectToDiagnostic } from "./lib/diagnostic/gate";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";

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
const ThemesPage = lazy(() =>
  import("./pages/ThemesPage").then((m) => ({ default: m.ThemesPage })),
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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProgressProvider>
          {/* A single Suspense boundary covers every lazy route. The fallback is
              intentionally minimal — route modules are small and load fast on a
              warm cache; a heavier skeleton would flash more than it helps. */}
          <Suspense fallback={null}>
            <Routes>
              {/* The landing page is the home for EVERYONE — it renders
                  auth-aware header/CTAs (see LandingPage). No separate dashboard. */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />

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
                <Route path="/themes" element={<ThemesPage />} />
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

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ProgressProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
