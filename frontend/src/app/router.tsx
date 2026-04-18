import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { ProtectedRoute } from "../components/auth/protected-route";
import { AppShell } from "../components/layout/app-shell";
import { PageSkeleton } from "../components/ui/skeleton";

// ── Eagerly loaded (critical path) ──────────────────────────────────────────
import { LoginPage } from "../pages/auth/login-page";

// ── Lazy-loaded pages (code split per route) ─────────────────────────────────
const OnboardingPage = lazy(() => import("../pages/onboarding/onboarding-page").then((m) => ({ default: m.OnboardingPage })));
const DashboardPage  = lazy(() => import("../pages/dashboard/dashboard-page").then((m) => ({ default: m.DashboardPage })));
const ProjectPage    = lazy(() => import("../pages/project/project-page").then((m) => ({ default: m.ProjectPage })));
const SpacePage      = lazy(() => import("../pages/space/space-page").then((m) => ({ default: m.SpacePage })));
const SpaceDocumentsPage = lazy(() => import("../pages/space/space-documents-page").then((m) => ({ default: m.SpaceDocumentsPage })));
const ChatPage       = lazy(() => import("../pages/chat/chat-page").then((m) => ({ default: m.ChatPage })));
const TopicPage      = lazy(() => import("../pages/topic/topic-page").then((m) => ({ default: m.TopicPage })));
const ProfilePage    = lazy(() => import("../pages/settings/profile-page").then((m) => ({ default: m.ProfilePage })));
const SettingsPage   = lazy(() => import("../pages/settings/settings-page").then((m) => ({ default: m.SettingsPage })));

function PageFallback() {
  return (
    <div className="animate-fade-in px-2 py-4">
      <PageSkeleton />
    </div>
  );
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/onboarding"
        element={
          <Suspense fallback={<PageFallback />}>
            <OnboardingPage />
          </Suspense>
        }
      />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route
            path="/"
            element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>}
          />
          <Route
            path="/projects/:projectSlug"
            element={<Suspense fallback={<PageFallback />}><ProjectPage /></Suspense>}
          />
          <Route
            path="/projects/:projectSlug/spaces/:spaceSlug"
            element={<Navigate to="suivi" replace />}
          />
          <Route
            path="/projects/:projectSlug/spaces/:spaceSlug/suivi"
            element={<Suspense fallback={<PageFallback />}><SpacePage /></Suspense>}
          />
          <Route
            path="/projects/:projectSlug/spaces/:spaceSlug/documents"
            element={<Suspense fallback={<PageFallback />}><SpaceDocumentsPage /></Suspense>}
          />
          <Route
            path="/projects/:projectSlug/spaces/:spaceSlug/chat"
            element={<Suspense fallback={<PageFallback />}><ChatPage /></Suspense>}
          />
          <Route
            path="/projects/:projectSlug/spaces/:spaceSlug/topics/:topicSlug"
            element={<Suspense fallback={<PageFallback />}><TopicPage /></Suspense>}
          />
          <Route
            path="/profile"
            element={<Suspense fallback={<PageFallback />}><ProfilePage /></Suspense>}
          />
          <Route
            path="/settings"
            element={<Suspense fallback={<PageFallback />}><SettingsPage /></Suspense>}
          />
        </Route>
      </Route>
    </Routes>
  );
}
