import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProgressProvider, useProgress } from "./context/ProgressContext";
import { shouldRedirectToDiagnostic } from "./lib/diagnostic/gate";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { TrackPage } from "./pages/TrackPage";
import { ThemesPage } from "./pages/ThemesPage";
import { LessonPage } from "./pages/LessonPage";
import { TableOfContentsPage } from "./pages/TableOfContentsPage";
import { DiagnosticPage } from "./pages/DiagnosticPage";
import { SpeedArenaPage } from "./pages/SpeedArenaPage";
import { DashboardPage } from "./pages/DashboardPage";
import { RoadmapPage } from "./pages/RoadmapPage";
import { SimulationsPage } from "./pages/SimulationsPage";
import { FermiPage } from "./pages/FermiPage";
import { GamesHubPage } from "./pages/GamesHubPage";
import { MakeMarketPage } from "./pages/MakeMarketPage";
import { ProbabilityBettingPage } from "./pages/ProbabilityBettingPage";
import { CardsMarketMakingPage } from "./pages/CardsMarketMakingPage";
import { MarketOfCardsPage } from "./pages/MarketOfCardsPage";
import { FruitMarketPage } from "./pages/FruitMarketPage";
import { DiceAndCardsPage } from "./pages/DiceAndCardsPage";
import { NextCardBettingPage } from "./pages/NextCardBettingPage";
import type { ReactNode } from "react";

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

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProgressProvider>
          <Routes>
            {/* The landing page is the home for EVERYONE — it renders
                auth-aware header/CTAs (see LandingPage). No separate dashboard. */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />

            {/* Phase-5 mastery + calibration dashboard (reclaimed from the old redirect). */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <DashboardPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Readiness Roadmap — the ordered skill pathway + readiness meter
                (own full-screen layout, like the Dashboard). Additive. */}
            <Route
              path="/roadmap"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <RoadmapPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Authenticated app shell (track maps) */}
            <Route
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <AppShell />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            >
              <Route path="/track/:trackId" element={<TrackPage />} />
              <Route path="/contents" element={<TableOfContentsPage />} />
              <Route path="/simulations" element={<SimulationsPage />} />
              <Route path="/games" element={<GamesHubPage />} />
              <Route path="/themes" element={<ThemesPage />} />
            </Route>

            {/* Immersive lesson player (its own full-screen layout) */}
            <Route
              path="/track/:trackId/level/:levelId"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <LessonPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Dedicated Fermi estimation drill (its own full-screen layout,
                self-contained — see FermiPage). */}
            <Route
              path="/fermi"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <FermiPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Make Me a Market — market-making game (own full-screen layout,
                self-contained — see MakeMarketPage). Game 1 of QuantGames. */}
            <Route
              path="/make-market"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <MakeMarketPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Probability Betting — odds/edge/Kelly game (own full-screen
                layout, self-contained). Game 2 of QuantGames. */}
            <Route
              path="/probability-betting"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <ProbabilityBettingPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Cards Market Making — taker game (own full-screen layout,
                self-contained). Game 3 of QuantGames. */}
            <Route
              path="/cards-market-making"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <CardsMarketMakingPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Market of Cards — group/super-day maker game (own full-screen
                layout, self-contained). Game 4 of QuantGames. */}
            <Route
              path="/market-of-cards"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <MarketOfCardsPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Fruit Market — speed mental-math taker game (own full-screen
                layout, self-contained). Game 5 of QuantGames. */}
            <Route
              path="/fruit-market"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <FruitMarketPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Dice & Cards — multiplicative taker game with an SD pre-question
                (own full-screen layout, self-contained). Game 6 of QuantGames. */}
            <Route
              path="/dice-and-cards"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <DiceAndCardsPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* Next Card Betting — card-counting + Kelly bettor game (own
                full-screen layout, self-contained). Game 9 of QuantGames. */}
            <Route
              path="/next-card-betting"
              element={
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <NextCardBettingPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            {/* ls-layer routes — phases 3/5/6 append here */}
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
                <ProtectedRoute>
                  <RequireDiagnostic>
                    <SpeedArenaPage />
                  </RequireDiagnostic>
                </ProtectedRoute>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProgressProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
