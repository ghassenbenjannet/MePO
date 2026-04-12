import { Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/app-shell";
import { DashboardPage } from "../pages/dashboard/dashboard-page";
import { ProjectPage } from "../pages/project/project-page";
import { SpacePage } from "../pages/space/space-page";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/projects/:projectId" element={<ProjectPage />} />
        <Route path="/projects/:projectId/spaces/:spaceId/*" element={<SpacePage />} />
      </Route>
    </Routes>
  );
}
