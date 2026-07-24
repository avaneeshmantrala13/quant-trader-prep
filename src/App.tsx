import { Navigate, Route, Routes } from "react-router-dom";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProgressProvider } from "./context/ProgressContext";
import { AppShell } from "./components/layout/AppShell";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { TrackPage } from "./pages/TrackPage";
import { ThemesPage } from "./pages/ThemesPage";
import { LessonPage } from "./pages/LessonPage";
import { TableOfContentsPage } from "./pages/TableOfContentsPage";
import type { ReactNode } from "react";

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthed } = useAuth();
  return isAuthed ? <>{children}</> : <Navigate to="/login" replace />;
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

            {/* Retired progress dashboard → redirect any stale links home. */}
            <Route path="/dashboard" element={<Navigate to="/" replace />} />

            {/* Authenticated app shell (track maps) */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/track/:trackId" element={<TrackPage />} />
              <Route path="/contents" element={<TableOfContentsPage />} />
              <Route path="/themes" element={<ThemesPage />} />
            </Route>

            {/* Immersive lesson player (its own full-screen layout) */}
            <Route
              path="/track/:trackId/level/:levelId"
              element={
                <ProtectedRoute>
                  <LessonPage />
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
