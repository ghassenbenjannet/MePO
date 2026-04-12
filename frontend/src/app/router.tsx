import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../components/auth/protected-route";
import { AppShell } from "../components/layout/app-shell";
import { LoginPage } from "../pages/auth/login-page";
import { DashboardPage } from "../pages/dashboard/dashboard-page";
import { OnboardingPage } from "../pages/onboarding/onboarding-page";
import { ProjectPage } from "../pages/project/project-page";
import { ProfilePage } from "../pages/settings/profile-page";
import { SettingsPage } from "../pages/settings/settings-page";
import { SpacePage } from "../pages/space/space-page";
import { TopicPage } from "../pages/topic/topic-page";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/spaces/:spaceId/*" element={<SpacePage />} />
          <Route path="/projects/:projectId/spaces/:spaceId/topics/:topicId" element={<TopicPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
